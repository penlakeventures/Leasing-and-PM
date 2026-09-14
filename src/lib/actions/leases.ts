"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { checkRentEscalation } from "@/lib/rules";

function parseLeaseForm(formData: FormData) {
  const endDateRaw = formData.get("endDate") as string;
  const signedDateRaw = formData.get("signedDate") as string;
  const prepaidRaw = formData.get("lastMonthRentPrepaid") as string;
  return {
    unitId: formData.get("unitId") as string,
    tenantIds: formData.getAll("tenantIds") as string[],
    startDate: new Date(formData.get("startDate") as string),
    endDate: endDateRaw ? new Date(endDateRaw) : null,
    periodic: formData.get("periodic") === "on",
    rentAmount: Number(formData.get("rentAmount")),
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

  // Keep the unit's currentRent in sync with the latest signed lease.
  await prisma.unit.update({
    where: { id: data.unitId },
    data: { currentRent: data.rentAmount },
  });

  revalidatePath("/leases");
  revalidatePath(`/units/${data.unitId}`);
  redirect(`/leases/${lease.id}`);
}

export async function updateLease(id: string, formData: FormData) {
  const data = parseLeaseForm(formData);

  const rentError = await checkAffordableRent(data.unitId, data.rentAmount);
  if (rentError) {
    redirect(`/leases/${id}?error=${encodeURIComponent(rentError)}`);
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
        lastMonthRentPrepaid: data.lastMonthRentPrepaid,
        pets: data.pets,
        signedDate: data.signedDate,
        documentLink: data.documentLink,
        tenants: {
          create: data.tenantIds.map((tenantId) => ({ tenantId })),
        },
      },
    }),
    prisma.unit.update({
      where: { id: data.unitId },
      data: { currentRent: data.rentAmount },
    }),
  ]);

  revalidatePath("/leases");
  revalidatePath(`/leases/${id}`);
  revalidatePath(`/units/${data.unitId}`);
  redirect(`/leases/${id}`);
}

export async function deleteLease(id: string) {
  try {
    await prisma.lease.delete({ where: { id } });
  } catch {
    redirect(
      `/leases/${id}?error=${encodeURIComponent("Can't delete a lease with a security deposit on file — resolve that first.")}`,
    );
  }
  revalidatePath("/leases");
  redirect("/leases");
}
