"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { checkRentEscalation, checkRentIncreaseNotice, pickActiveLease } from "@/lib/rules";
import { prepareLeaseFolder, uploadFile } from "@/lib/dropbox";
import { sendForSignature } from "@/lib/dropbox-sign";

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
    renewedFromLeaseId: (formData.get("renewedFromLeaseId") as string)?.trim() || null,
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

  // A renewal for the same tenant(s) carries the predecessor lease's own
  // Dropbox folder straight across instead of the normal new-tenancy
  // auto-filing below — that logic assumes a new lease means a new
  // tenant and archives whatever's currently there, which would be wrong
  // for the same tenant continuing in the unit. If the tenant set doesn't
  // actually match (renewedFromLeaseId was carried through but the form
  // was edited to a different tenant), fall through to the normal path
  // instead of trusting the button's original intent.
  let carriedOverFolder: { documentLink: string | null; documentsFolderPath: string | null } | null = null;
  if (data.renewedFromLeaseId) {
    const predecessor = await prisma.lease.findUnique({
      where: { id: data.renewedFromLeaseId },
      include: { tenants: true },
    });
    const sameTenants =
      predecessor &&
      predecessor.tenants.length === data.tenantIds.length &&
      predecessor.tenants.every((lt) => data.tenantIds.includes(lt.tenantId));
    if (predecessor && sameTenants && predecessor.documentsFolderPath) {
      carriedOverFolder = {
        documentLink: predecessor.documentLink,
        documentsFolderPath: predecessor.documentsFolderPath,
      };
    }
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
      documentLink: carriedOverFolder?.documentLink ?? data.documentLink,
      documentsFolderPath: carriedOverFolder?.documentsFolderPath ?? null,
      renewedFromLeaseId: data.renewedFromLeaseId,
      tenants: {
        create: data.tenantIds.map((tenantId) => ({ tenantId })),
      },
    },
  });

  await syncUnitCurrentRent(data.unitId);

  // Auto-file: create this unit's Dropbox folder for the new tenancy —
  // archiving the previous tenant's folder into that project's Past
  // tenants folder first, if one's still there — and store the resulting
  // shared link as the lease's document link. Skipped entirely for a
  // same-tenant renewal, which already got its folder carried over above.
  // Never blocks lease creation: if Dropbox isn't connected yet or the
  // call fails, the lease is still saved and staff can paste a link in by
  // hand as before.
  if (!carriedOverFolder) {
    try {
      const [unit, tenants] = await Promise.all([
        prisma.unit.findUnique({
          where: { id: data.unitId },
          include: { projectEntity: true },
        }),
        prisma.tenant.findMany({ where: { id: { in: data.tenantIds } } }),
      ]);
      if (unit) {
        const { path, link } = await prepareLeaseFolder({
          projectDisplayOrder: unit.projectEntity.displayOrder,
          projectName: unit.projectEntity.internalName,
          unitNumber: unit.unitNumber,
          tenantNames: tenants.map((t) => t.name),
        });
        await prisma.lease.update({
          where: { id: lease.id },
          data: { documentLink: link, documentsFolderPath: path },
        });
      }
    } catch (e) {
      console.error("[createLease] prepareLeaseFolder failed:", e);
    }
  }

  revalidatePath("/leases");
  revalidatePath("/renewals");
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

// Uploads a document (a SingleKey report once an applicant's approved, or
// anything else) straight into this lease's already-created Dropbox
// folder. Only offered when documentsFolderPath is on file — a lease from
// before this existed, or one where staff pasted a link in by hand, has
// no known upload target, so staff drag the file in via Dropbox directly
// instead, same as always.
export async function uploadLeaseDocument(leaseId: string, formData: FormData) {
  const lease = await prisma.lease.findUnique({ where: { id: leaseId } });
  if (!lease) redirect("/leases");
  if (!lease.documentsFolderPath) {
    redirect(
      `/leases/${leaseId}?error=${encodeURIComponent("This lease has no Dropbox folder on file to upload into.")}`,
    );
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    redirect(`/leases/${leaseId}?error=${encodeURIComponent("Choose a file to upload first.")}`);
  }

  try {
    const content = await file.arrayBuffer();
    await uploadFile({ path: lease.documentsFolderPath, filename: file.name, content });
  } catch (e) {
    console.error("[uploadLeaseDocument] uploadFile failed:", e);
    redirect(
      `/leases/${leaseId}?error=${encodeURIComponent("Couldn't upload that file to Dropbox — check the connection under Settings and try again.")}`,
    );
  }

  revalidatePath(`/leases/${leaseId}`);
  redirect(`/leases/${leaseId}`);
}

// Sends this lease (plus the Smoking/Cannabis Addendum, and Additional
// Lease Terms if custom_terms_text was filled in) as one combined
// Dropbox Sign signature request. Every value here comes from the
// submitted form, not recomputed — the LeaseSigningPanel pre-fills it
// from buildLeaseMergeFields() but staff can edit anything before
// sending, since this is what actually ends up on a binding document.
// Never re-sends once a signatureRequestId is on file (no "send again"
// from here — that'd risk two live signature requests for one lease).
export async function sendLeaseForSignature(leaseId: string, formData: FormData) {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: {
      unit: { include: { projectEntity: true } },
      tenants: { include: { tenant: true } },
    },
  });
  if (!lease) redirect("/leases");
  if (lease.signatureRequestId) redirect(`/leases/${leaseId}`);
  if (lease.periodic || !lease.endDate) {
    redirect(
      `/leases/${leaseId}?error=${encodeURIComponent("Only a fixed-term lease (with an end date) can be sent for signature from here.")}`,
    );
  }

  const tenants = lease.tenants.map((lt) => lt.tenant);
  if (tenants.length === 0) {
    redirect(`/leases/${leaseId}?error=${encodeURIComponent("Add at least one tenant to this lease first.")}`);
  }
  if (tenants.length > 2) {
    redirect(
      `/leases/${leaseId}?error=${encodeURIComponent("This lease has more than 2 tenants — the signing template only supports 2. Send this one manually instead.")}`,
    );
  }
  const missingEmail = tenants.find((t) => !t.email);
  if (missingEmail) {
    redirect(
      `/leases/${leaseId}?error=${encodeURIComponent(`${missingEmail.name} has no email on file — add one on their tenant page before sending for signature.`)}`,
    );
  }

  const settings = await prisma.signingSettings.findUnique({ where: { id: "singleton" } });
  const leaseTemplateId = lease.unit.utilitiesIncludedInRent
    ? settings?.leaseSuiteTemplateId
    : settings?.leaseTownhomeTemplateId;
  if (!settings?.landlordSignerName || !settings.landlordSignerEmail || !leaseTemplateId || !settings.smokingAddendumTemplateId) {
    redirect(
      `/leases/${leaseId}?error=${encodeURIComponent("Signing isn't fully set up yet — fill in the landlord signer and template IDs under Settings → Signing.")}`,
    );
  }

  const customTermsText = (formData.get("custom_terms_text") as string)?.trim() || null;
  const templateIds = [leaseTemplateId, settings.smokingAddendumTemplateId];
  if (customTermsText) {
    if (!settings.additionalTermsTemplateId) {
      redirect(
        `/leases/${leaseId}?error=${encodeURIComponent("Custom terms were entered, but the Additional Lease Terms template ID isn't set under Settings → Signing.")}`,
      );
    }
    templateIds.push(settings.additionalTermsTemplateId);
  }

  const customFields: Record<string, string> = {
    agreement_date: (formData.get("agreement_date") as string) ?? "",
    landlord_name: (formData.get("landlord_name") as string) ?? "",
    tenant_name_1: (formData.get("tenant_name_1") as string) ?? "",
    tenant_name_2: (formData.get("tenant_name_2") as string) ?? "",
    premises: (formData.get("premises") as string) ?? "",
    term_start: (formData.get("term_start") as string) ?? "",
    term_end: (formData.get("term_end") as string) ?? "",
    rent_amount: (formData.get("rent_amount") as string) ?? "",
    partial_rent_amount: (formData.get("partial_rent_amount") as string) ?? "",
    partial_rent_period: (formData.get("partial_rent_period") as string) ?? "",
    deposit_amount: (formData.get("deposit_amount") as string) ?? "",
    deposit_date: (formData.get("deposit_date") as string) ?? "",
  };
  if (customTermsText) customFields.custom_terms_text = customTermsText;

  const signers: { role: "Landlord" | "Tenant 1" | "Tenant 2"; name: string; email: string }[] = [
    { role: "Landlord", name: settings.landlordSignerName, email: settings.landlordSignerEmail },
    { role: "Tenant 1", name: tenants[0].name, email: tenants[0].email! },
  ];
  if (tenants[1]) {
    signers.push({ role: "Tenant 2", name: tenants[1].name, email: tenants[1].email! });
  }

  const testMode = formData.get("test_mode") === "on";

  try {
    const { signatureRequestId } = await sendForSignature({
      templateIds,
      subject: `Lease for ${lease.unit.projectEntity.internalName} — Unit ${lease.unit.unitNumber}`,
      message: "Please review and sign your lease. Reach out if you have any questions.",
      signers,
      customFields,
      testMode,
    });
    await prisma.lease.update({
      where: { id: leaseId },
      data: {
        signatureRequestId,
        signatureSentAt: new Date(),
        signatureTestMode: testMode,
        additionalTermsText: customTermsText,
      },
    });
  } catch (e) {
    console.error("[sendLeaseForSignature] sendForSignature failed:", e);
    redirect(
      `/leases/${leaseId}?error=${encodeURIComponent("Couldn't send for signature — check the Dropbox Sign connection under Settings and try again.")}`,
    );
  }

  revalidatePath(`/leases/${leaseId}`);
  redirect(`/leases/${leaseId}`);
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
