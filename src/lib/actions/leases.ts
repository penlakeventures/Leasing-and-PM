"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { checkRentEscalation, checkRentIncreaseNotice, pickActiveLease } from "@/lib/rules";
import { prepareLeaseFolder } from "@/lib/dropbox";

function parseLeaseForm(formData: FormData) {
  const endDateRaw = formData.get("endDate") as string;
  const signedDateRaw = formData.get("signedDate") as string;
  const prepaidRaw = formData.get("lastMonthRentPrepaid") as string;
  const noticeGivenRaw = formData.get("rentIncreaseNoticeGivenDate") as string;
  return {
    unitId: formData.get("unitId") as string,
    tenantIds: formData.getAll("tenantIds") as string[],
    startDate: new Date(formData.get("startDate") as string),
    endDate: endDateRaw ? new Date(endDateRaw) : null,
    periodic: formData.get("periodic") === "on",
    rentAmount: Number(formData.get("rentAmount")),
    noticeGivenDate: noticeGivenRaw ? new Date(noticeGivenRaw) : null,
    lastMonthRentPrepaid: prepaidRaw ? Number(prepaidRaw) : null,
    pets: (formData.get("pets") as string)?.trim() || null,
    signedDate: signedDateRaw ? new Date(signedDateRaw) : null,
    documentLink: (formData.get("documentLink") as string)?.trim() || null,
  };
}

async function currentCpiRate(): Promise<number | null> {
  const rate = await prisma.cpiRate.findUnique({
    where: { year: new Date().getFullYear() },
  });
  return rate ? Number(rate.ratePercent) : null;
}

// The unit detail page keeps a full lease history, not just the current
// tenancy — so saving *any* lease (e.g. correcting a typo on a tenant who
// moved out years ago) must not blindly overwrite the unit's advertised
// currentRent with whatever's on the lease being edited. Instead, after
// any create/update/delete, recompute currentRent from whichever lease is
// actually in effect today (started, and either periodic or not yet
// ended). If no lease is currently active for the unit (vacant, or only
// future-dated leases on file), leave the last-known rent as-is rather
// than clearing it.
async function syncUnitCurrentRent(unitId: string) {
  const leases = await prisma.lease.findMany({ where: { unitId } });
  const active = pickActiveLease(leases);
  if (active) {
    await prisma.unit.update({
      where: { id: unitId },
      data: { currentRent: active.rentAmount },
    });
  }
}

async function checkAffordableRent(unitId: string, rentAmount: number) {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit || unit.cmhcDesignation !== "AFFORDABLE") return null;

  const cpiRatePercent = await currentCpiRate();
  const check = checkRentEscalation({
    cmhcDesignation: "AFFORDABLE",
    currentRent: Number(unit.currentRent),
    proposedRent: rentAmount,
    cpiRatePercent,
  });
  return check.allowed ? null : check.reason!;
}

export async function createLease(formData: FormData) {
  const data = parseLeaseForm(formData);

  const rentError = await checkAffordableRent(data.unitId, data.rentAmount);
  if (rentError) {
    redirect(
      `/leases/new?unitId=${data.unitId}&error=${encodeURIComponent(rentError)}`,
    );
  }

  const lease = await prisma.lease.create({
    data: {
      unitId: data.unitId,
      startDate: data.startDate,
      endDate: data.endDate,
      periodic: data.periodic,
      rentAmount: data.rentAmount,
      lastMonthRentPrepaid: data.lastMonthRentPrepaid,
      pets: data.pets,
      signedDate: data.signedDate,
      documentLink: data.documentLink,
      tenants: {
        create: data.tenantIds.map((tenantId) => ({ tenantId })),
      },
    },
  });

  await syncUnitCurrentRent(data.unitId);

  // Auto-file: create this unit's Dropbox folder for the new tenancy —
  // archiving the previous tenant's folder into that project's Past
  // tenants folder first, if one's still there — and store the resulting
  // shared link as the lease's document link. Never blocks lease creation:
  // if Dropbox isn't connected yet or the call fails, the lease is still
  // saved and staff can paste a link in by hand as before.
  try {
    const [unit, tenants] = await Promise.all([
      prisma.unit.findUnique({
        where: { id: data.unitId },
        include: { projectEntity: true },
      }),
      prisma.tenant.findMany({ where: { id: { in: data.tenantIds } } }),
    ]);
    if (unit) {
      const documentLink = await prepareLeaseFolder({
        projectDisplayOrder: unit.projectEntity.displayOrder,
        projectName: unit.projectEntity.internalName,
        unitNumber: unit.unitNumber,
        tenantNames: tenants.map((t) => t.name),
      });
      await prisma.lease.update({ where: { id: lease.id }, data: { documentLink } });
    }
  } catch (e) {
    console.error("[createLease] prepareLeaseFolder failed:", e);
  }

  revalidatePath("/leases");
  revalidatePath(`/units/${data.unitId}`);
  redirect(`/leases/${lease.id}`);
}

export async function updateLease(id: string, formData: FormData) {
  const data = parseLeaseForm(formData);
  const existing = await prisma.lease.findUnique({ where: { id } });
  if (!existing) redirect("/leases");

  const rentError = await checkAffordableRent(data.unitId, data.rentAmount);
  if (rentError) {
    redirect(`/leases/${id}?error=${encodeURIComponent(rentError)}`);
  }

  const isIncrease = data.rentAmount > Number(existing.rentAmount);
  const noticeCheck = checkRentIncreaseNotice({
    periodic: data.periodic,
    leaseStartDate: existing.startDate,
    lastRentIncreaseDate: existing.lastRentIncreaseDate,
    currentRent: Number(existing.rentAmount),
    proposedRent: data.rentAmount,
    noticeGivenDate: data.noticeGivenDate,
  });
  if (!noticeCheck.allowed) {
    redirect(`/leases/${id}?error=${encodeURIComponent(noticeCheck.reason!)}`);
  }

  await prisma.$transaction([
    prisma.leaseTenant.deleteMany({ where: { leaseId: id } }),
    prisma.lease.update({
      where: { id },
      data: {
        unitId: data.unitId,
        startDate: data.startDate,
        endDate: data.endDate,
        periodic: data.periodic,
        rentAmount: data.rentAmount,
        // Only touch these when this save is actually a rent increase on a
        // periodic lease — otherwise leave whatever's on file untouched.
        ...(isIncrease && data.periodic
          ? {
              lastRentIncreaseDate: new Date(),
              rentIncreaseNoticeGivenDate: data.noticeGivenDate,
            }
          : {}),
        lastMonthRentPrepaid: data.lastMonthRentPrepaid,
        pets: data.pets,
        signedDate: data.signedDate,
        documentLink: data.documentLink,
        tenants: {
          create: data.tenantIds.map((tenantId) => ({ tenantId })),
        },
      },
    }),
  ]);

  // If this save moved the lease to a different unit, the unit it left
  // behind may no longer have this as its active lease either — resync
  // both, not just the destination.
  await syncUnitCurrentRent(data.unitId);
  if (existing.unitId !== data.unitId) {
    await syncUnitCurrentRent(existing.unitId);
  }

  revalidatePath("/leases");
  revalidatePath(`/leases/${id}`);
  revalidatePath(`/units/${data.unitId}`);
  redirect(`/leases/${id}`);
}

export async function deleteLease(id: string) {
  const existing = await prisma.lease.findUnique({ where: { id } });
  if (!existing) redirect("/leases");

  try {
    await prisma.lease.delete({ where: { id } });
  } catch {
    redirect(
      `/leases/${id}?error=${encodeURIComponent("Can't delete a lease with a security deposit on file — resolve that first.")}`,
    );
  }
  await syncUnitCurrentRent(existing.unitId);
  revalidatePath("/leases");
  redirect("/leases");
}
