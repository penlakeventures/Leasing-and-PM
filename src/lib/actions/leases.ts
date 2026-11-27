"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { checkRentEscalation, checkRentIncreaseFrequency, pickActiveLease } from "@/lib/rules";
import { prepareLeaseFolder, uploadFile } from "@/lib/dropbox";
import { sendForSignature } from "@/lib/dropbox-sign";
import { unitTypeFromAddress } from "@/lib/unit-type";
import { buildLeaseRenewalMergeFields, projectLegalEntityName, splitLongDate, unitPremises } from "@/lib/lease-document";

function parseLeaseForm(formData: FormData) {
  const endDateRaw = formData.get("endDate") as string;
  const signedDateRaw = formData.get("signedDate") as string;
  const firstPrepaidRaw = formData.get("firstMonthRentPrepaid") as string;
  const prepaidRaw = formData.get("lastMonthRentPrepaid") as string;
  return {
    unitId: formData.get("unitId") as string,
    tenantIds: formData.getAll("tenantIds") as string[],
    startDate: new Date(formData.get("startDate") as string),
    endDate: endDateRaw ? new Date(endDateRaw) : null,
    periodic: formData.get("periodic") === "on",
    rentAmount: Number(formData.get("rentAmount")),
    firstMonthRentPrepaid: firstPrepaidRaw ? Number(firstPrepaidRaw) : null,
    lastMonthRentPrepaid: prepaidRaw ? Number(prepaidRaw) : null,
    pets: (formData.get("pets") as string)?.trim() || null,
    signedDate: signedDateRaw ? new Date(signedDateRaw) : null,
    renewedFromLeaseId: (formData.get("renewedFromLeaseId") as string)?.trim() || null,
    notes: (formData.get("notes") as string)?.trim() || null,
  };
}

// A brand-new lease's tenant(s), typed in on the form itself rather than
// picked from the existing roster — there's no separate CRM step
// beforehand anymore that would already have created a Tenant record. All
// three fields are repeated once per tenant block in DOM order, so the
// i-th entry of each array belongs to the same tenant; a block with no
// name typed in (an unused extra "+ Add another tenant" slot) is dropped.
function parseNewTenants(
  formData: FormData,
): { name: string; phone: string | null; email: string | null }[] {
  const names = formData.getAll("newTenantName") as string[];
  const phones = formData.getAll("newTenantPhone") as string[];
  const emails = formData.getAll("newTenantEmail") as string[];
  return names
    .map((name, i) => ({
      name: name.trim(),
      phone: phones[i]?.trim() || null,
      email: emails[i]?.trim() || null,
    }))
    .filter((t) => t.name);
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

  // Brand-new lease, brand-new tenant(s): entered right here on the form
  // instead of picked from the existing roster, since there's no CRM step
  // beforehand anymore that would already have created a Tenant record.
  // A renewal instead carries its tenantIds straight through as hidden
  // fields (see lease-form.tsx), so tenantIds is already populated and
  // nothing here runs for that case.
  let tenantIds = data.tenantIds;
  if (tenantIds.length === 0) {
    const newTenants = parseNewTenants(formData);
    const created = await Promise.all(
      newTenants.map((t) =>
        prisma.tenant.create({ data: { name: t.name, phone: t.phone, email: t.email } }),
      ),
    );
    tenantIds = created.map((t) => t.id);
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
      predecessor.tenants.length === tenantIds.length &&
      predecessor.tenants.every((lt) => tenantIds.includes(lt.tenantId));
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
      firstMonthRentPrepaid: data.firstMonthRentPrepaid,
      lastMonthRentPrepaid: data.lastMonthRentPrepaid,
      pets: data.pets,
      signedDate: data.signedDate,
      // No Document link field on the form any more — a brand-new lease
      // relies entirely on the auto-file block below to set this (or a
      // renewal's carried-over folder, above); there's no manual entry
      // path left for staff to paste one in by hand instead.
      documentLink: carriedOverFolder?.documentLink ?? null,
      documentsFolderPath: carriedOverFolder?.documentsFolderPath ?? null,
      renewedFromLeaseId: data.renewedFromLeaseId,
      notes: data.notes,
      tenants: {
        create: tenantIds.map((tenantId) => ({ tenantId })),
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
        prisma.tenant.findMany({ where: { id: { in: tenantIds } } }),
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

// The Renewals tab's one-click "Send renewal for signature": creates the
// renewal lease and immediately sends it for e-signature in one step,
// rather than the two-step save-then-send flow a brand-new lease uses.
// Only reachable from the renewal form (lease-form.tsx), which always
// carries renewedFromLeaseId through as a hidden field — the predecessor
// lease is the source of truth for the tenant(s), the Dropbox folder, and
// the rent-prepaid figures that aren't changing on a renewal, none of
// which this form asks for again.
export async function createLeaseRenewalAndSend(formData: FormData) {
  const renewedFromLeaseId = (formData.get("renewedFromLeaseId") as string)?.trim();
  if (!renewedFromLeaseId) redirect("/renewals");

  const predecessor = await prisma.lease.findUnique({
    where: { id: renewedFromLeaseId },
    include: { tenants: { include: { tenant: true } }, unit: { include: { projectEntity: true } } },
  });
  if (!predecessor) redirect("/renewals");

  const errorRedirect = (reason: string) =>
    redirect(`/leases/new?renewFromLeaseId=${renewedFromLeaseId}&error=${encodeURIComponent(reason)}`);

  const unitId = (formData.get("unitId") as string) || predecessor.unitId;
  const startDate = new Date(formData.get("startDate") as string);
  const endDateRaw = formData.get("endDate") as string;
  const endDate = endDateRaw ? new Date(endDateRaw) : null;
  const periodic = formData.get("periodic") === "on";
  const rentAmount = Number(formData.get("rentAmount"));
  const pets = (formData.get("pets") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const testMode = formData.get("test_mode") === "on";

  if (periodic || !endDate) {
    errorRedirect("A renewal needs a fixed end date to send for signature — periodic renewals are handled outside the app.");
  }

  const rentError = await checkAffordableRent(unitId, rentAmount);
  if (rentError) errorRedirect(rentError);

  const tenants = predecessor.tenants.map((lt) => lt.tenant);
  if (tenants.length === 0) {
    errorRedirect("This lease has no tenant on file — add one before renewing.");
  }
  if (tenants.length > 2) {
    errorRedirect(
      "This lease has more than 2 tenants — the renewal template only supports 2. Renew this one manually instead.",
    );
  }
  const missingEmail = tenants.find((t) => !t.email);
  if (missingEmail) {
    errorRedirect(`${missingEmail!.name} has no email on file — add one on their tenant page before sending a renewal.`);
  }

  const settings = await prisma.signingSettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.landlordSignerName || !settings.landlordSignerEmail || !settings.leaseRenewalTemplateId) {
    errorRedirect(
      "Renewal signing isn't fully set up yet — fill in the landlord signer and the Lease renewal template ID under Settings → Signing.",
    );
  }

  const lease = await prisma.lease.create({
    data: {
      unitId,
      startDate,
      endDate,
      periodic: false,
      rentAmount,
      firstMonthRentPrepaid: predecessor.firstMonthRentPrepaid,
      lastMonthRentPrepaid: predecessor.lastMonthRentPrepaid,
      pets,
      signedDate: null,
      documentLink: predecessor.documentsFolderPath ? predecessor.documentLink : null,
      documentsFolderPath: predecessor.documentsFolderPath,
      renewedFromLeaseId: predecessor.id,
      notes,
      tenants: { create: tenants.map((t) => ({ tenantId: t.id })) },
    },
  });

  await syncUnitCurrentRent(unitId);

  const mergeFields = buildLeaseRenewalMergeFields({
    landlordName: projectLegalEntityName(predecessor.unit.projectEntity.internalName),
    tenantNames: tenants.map((t) => t.name),
    premises: unitPremises(predecessor.unit.unitNumber),
    originalLeaseDate: predecessor.signedDate ?? predecessor.startDate,
    renewalStart: startDate,
    renewalEnd: endDate!,
    rentChanged: rentAmount !== Number(predecessor.rentAmount),
    newRentAmount: rentAmount,
    newPets: pets,
    newLeaseTerms: notes,
  });

  const signers: { role: "Landlord" | "Tenant 1" | "Tenant 2"; name: string; email: string }[] = [
    { role: "Landlord", name: settings!.landlordSignerName!, email: settings!.landlordSignerEmail! },
    { role: "Tenant 1", name: tenants[0].name, email: tenants[0].email! },
  ];
  if (tenants[1]) {
    signers.push({ role: "Tenant 2", name: tenants[1].name, email: tenants[1].email! });
  }

  try {
    const { signatureRequestId } = await sendForSignature({
      templateIds: [settings!.leaseRenewalTemplateId!],
      subject: `Lease renewal for ${predecessor.unit.projectEntity.internalName} — Unit ${predecessor.unit.unitNumber}`,
      message: "Please review and sign your lease renewal. Reach out if you have any questions.",
      signers,
      customFields: mergeFields,
      testMode,
    });
    await prisma.lease.update({
      where: { id: lease.id },
      data: { signatureRequestId, signatureSentAt: new Date(), signatureTestMode: testMode },
    });
  } catch (e) {
    console.error("[createLeaseRenewalAndSend] sendForSignature failed:", e);
    revalidatePath("/leases");
    revalidatePath("/renewals");
    redirect(
      `/leases/${lease.id}?error=${encodeURIComponent("The renewal was saved, but sending it for signature failed — check the Dropbox Sign connection under Settings and try Send for signature again from this page.")}`,
    );
  }

  revalidatePath("/leases");
  revalidatePath("/renewals");
  revalidatePath(`/units/${unitId}`);
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
  // The 3-month written-notice side of this (giving it, and confirming it
  // was given early enough) is handled outside the app entirely, per the
  // owner — only the 365-day frequency cap is still enforced here.
  const frequencyCheck = checkRentIncreaseFrequency({
    periodic: data.periodic,
    leaseStartDate: existing.startDate,
    lastRentIncreaseDate: existing.lastRentIncreaseDate,
    currentRent: Number(existing.rentAmount),
    proposedRent: data.rentAmount,
  });
  if (!frequencyCheck.allowed) {
    redirect(`/leases/${id}?error=${encodeURIComponent(frequencyCheck.reason!)}`);
  }

  // Tenant(s) on an existing lease aren't editable from this form anymore
  // (see lease-form.tsx) — correcting a tenant's own contact info happens
  // on their page instead, and who's on the lease essentially never
  // changes once it's signed; a new tenant means a new lease.
  await prisma.lease.update({
    where: { id },
    data: {
      unitId: data.unitId,
      startDate: data.startDate,
      endDate: data.endDate,
      periodic: data.periodic,
      rentAmount: data.rentAmount,
      // Only touch this when this save is actually a rent increase on a
      // periodic lease — otherwise leave whatever's on file untouched.
      ...(isIncrease && data.periodic ? { lastRentIncreaseDate: new Date() } : {}),
      firstMonthRentPrepaid: data.firstMonthRentPrepaid,
      lastMonthRentPrepaid: data.lastMonthRentPrepaid,
      pets: data.pets,
      signedDate: data.signedDate,
      notes: data.notes,
    },
  });

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

// Quick inline edit from the Leases list grid — same field as the
// Additional lease terms textarea on the lease's own page, just without
// round-tripping the rest of that form for what's usually a one-line note.
export async function updateLeaseNotes(leaseId: string, notes: string) {
  await prisma.lease.update({
    where: { id: leaseId },
    data: { notes: notes.trim() || null },
  });
  revalidatePath("/leases");
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

// Sends this lease, the Smoking/Cannabis Addendum, and the Additional
// Lease Terms addendum (always, filled from this lease's own "Additional
// lease terms" notes, or "None") as one combined Dropbox Sign signature
// request. Every other value here comes from the submitted form, not
// recomputed — the LeaseSigningPanel pre-fills it from
// buildLeaseMergeFields() but staff can edit anything before sending,
// since this is what actually ends up on a binding document.
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
  // Suite vs. Townhome used to come from a unit's own "Utilities included
  // in rent" checkbox, but that field was never actually set on any real
  // unit — deriving it from the unit's address instead (the same rule
  // already trusted for the Renewals grid's Type column) means every
  // lease sent for signature actually picks the right template, not
  // silently Townhome every time.
  const leaseTemplateId = unitTypeFromAddress(lease.unit.unitNumber) === "Suite"
    ? settings?.leaseSuiteTemplateId
    : settings?.leaseTownhomeTemplateId;
  if (
    !settings?.landlordSignerName ||
    !settings.landlordSignerEmail ||
    !leaseTemplateId ||
    !settings.smokingAddendumTemplateId ||
    !settings.additionalTermsTemplateId
  ) {
    redirect(
      `/leases/${leaseId}?error=${encodeURIComponent("Signing isn't fully set up yet — fill in the landlord signer and template IDs under Settings → Signing.")}`,
    );
  }

  // The Additional Lease Terms addendum is always part of the send now —
  // sourced straight from this lease's own "Additional lease terms" box
  // (the notes field), not a separate box on this form, so it's never
  // silently skipped just because nobody scrolled to a second input.
  // Falls back to "None" rather than leaving the addendum's blank empty.
  const customTermsText = lease.notes?.trim() || "None";
  const templateIds = [leaseTemplateId, settings.smokingAddendumTemplateId, settings.additionalTermsTemplateId];

  const tenantName1 = (formData.get("tenant_name_1") as string) ?? "";
  const tenantName2 = (formData.get("tenant_name_2") as string) ?? "";
  const agreementDateRaw = (formData.get("agreement_date") as string) ?? "";
  const termStartRaw = (formData.get("term_start") as string) ?? "";
  const termEndRaw = (formData.get("term_end") as string) ?? "";

  const customFields: Record<string, string> = {
    landlord_name: (formData.get("landlord_name") as string) ?? "",
    tenant_name_1: tenantName1,
    tenant_name_2: tenantName2,
    // The lease/addendum templates' "BETWEEN ... - and - ___" preamble has
    // one combined blank for every tenant's name together, not one blank
    // per tenant (tenant_name_1/2 above are for the separate per-tenant
    // signature lines further down) — same split as the Lease Amendment
    // template's tenant_names field.
    tenant_names: [tenantName1, tenantName2].filter(Boolean).join(" and "),
    premises: (formData.get("premises") as string) ?? "",
    rent_amount: (formData.get("rent_amount") as string) ?? "",
    partial_rent_amount: (formData.get("partial_rent_amount") as string) ?? "",
    partial_rent_period: (formData.get("partial_rent_period") as string) ?? "",
    deposit_amount: (formData.get("deposit_amount") as string) ?? "",
    deposit_date: (formData.get("deposit_date") as string) ?? "",
  };
  // The lease (and its addendum templates sent alongside it) show the
  // landlord's and tenants' names in more than one place — the "BETWEEN"
  // preamble, and again on each signature-block page (the lease template
  // has two) — but Dropbox Sign requires every placed field's API ID to
  // be unique within a template, so the same value can't just be pasted
  // into a second spot under the same ID. Each repeat instead gets its
  // own suffixed ID carrying the identical value. Unlike agreement_date
  // below, the lease template (always part of this send) defines every
  // one of these suffixes, so they're always safe to include — Dropbox
  // Sign rejects any custom field that isn't defined by at least one
  // template actually being used in a given send, confirmed against a
  // real send once the lease's "made as of" date fields were replaced
  // (see next comment) and its old combined fields were no longer
  // defined anywhere in that send's templates.
  customFields.landlord_name_b = customFields.landlord_name;
  customFields.landlord_name_c = customFields.landlord_name;
  customFields.tenant_name_1_b = customFields.tenant_name_1;
  customFields.tenant_name_2_b = customFields.tenant_name_2;
  // The lease template's "made as of the ___ day of ___, 20___" phrasing
  // (and the same shape for its commencing/ending term dates) has printed
  // words between the blanks that a merge field can't safely overlay —
  // confirmed against a real signed lease, where "day of" and "20___"
  // showed through underneath the merged text instead of being hidden by
  // it. Split into three small fields sized to the three actual blanks
  // instead, carrying the same values apart. Safe to always include,
  // same reasoning as above — the lease template always defines these.
  Object.assign(
    customFields,
    Object.fromEntries(
      Object.entries(splitLongDate(agreementDateRaw)).map(([k, v]) => [`agreement_date_${k}`, v]),
    ),
    Object.fromEntries(
      Object.entries(splitLongDate(termStartRaw)).map(([k, v]) => [`term_start_${k}`, v]),
    ),
    Object.fromEntries(
      Object.entries(splitLongDate(termEndRaw)).map(([k, v]) => [`term_end_${k}`, v]),
    ),
  );
  // The combined (unsplit) agreement_date is only ever defined by the
  // Additional Lease Terms template's own "DATED ___" blank (a single
  // blank with no printed words around it to clash with, so no split
  // needed there) — safe to always include now that template is always
  // part of this send.
  customFields.agreement_date = agreementDateRaw;
  customFields.custom_terms_text = customTermsText;

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

// Deletes a lease outright, but only while it's still unsigned —
// signatureCompletedAt (a real Dropbox Sign completion) and signedDate (a
// lease signed some other way, on paper) both block it, so a real signed
// lease is never one click from gone. Covers two cases: cleaning up a
// test send used to verify Dropbox Sign, and a prospect who never signs
// and ghosts, so that dead lease record doesn't just sit around forever.
// RentPayment and SecurityDeposit both block a Lease delete at the
// database level (onDelete: Restrict) — in practice neither should exist
// yet on an unsigned lease, but they're cleared first regardless so the
// delete can't fail partway through.
export async function deleteLease(leaseId: string) {
  const lease = await prisma.lease.findUnique({ where: { id: leaseId } });
  if (!lease) redirect("/leases");

  if (lease.signatureCompletedAt || lease.signedDate) {
    redirect(
      `/leases/${leaseId}?error=${encodeURIComponent("This lease has already been signed — it can't be deleted.")}`,
    );
  }

  await prisma.rentPayment.deleteMany({ where: { leaseId } });
  const deposit = await prisma.securityDeposit.findUnique({ where: { leaseId } });
  if (deposit) {
    await prisma.securityDepositDeduction.deleteMany({ where: { securityDepositId: deposit.id } });
    await prisma.securityDeposit.delete({ where: { id: deposit.id } });
  }
  await prisma.lease.delete({ where: { id: leaseId } });

  await syncUnitCurrentRent(lease.unitId);

  revalidatePath("/leases");
  revalidatePath("/renewals");
  revalidatePath(`/units/${lease.unitId}`);
  redirect("/leases");
}
