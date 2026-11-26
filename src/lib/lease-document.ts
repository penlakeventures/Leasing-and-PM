// Pure computation of the merge-field values sent to Dropbox Sign for a
// new lease's signature request — kept separate from the Dropbox Sign API
// client itself so the two can be tested/read independently. Every value
// here is a *default*, shown to staff in an editable review step before
// anything is actually sent (src/components/lease-signing-panel.tsx) —
// this file never sends anything on its own.

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

// "17th day of September, 2026" — matches the template's "made as of the
// ___ day of ___, 20__" phrasing as one merged phrase rather than three
// separate blanks, so template setup only needs one wide field there.
export function formatLongDate(d: Date): string {
  return `${ordinal(d.getDate())} day of ${MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
}

export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Only filled in when the lease doesn't start on the 1st — the template
// itself treats this as optional ("If applicable, a partial month's
// rent..."). Prorated by actual calendar days in that first month, not a
// flat 30-day convention; staff can adjust the resulting value in the
// review step if that doesn't match how they'd compute it by hand.
function partialRent(startDate: Date, monthlyRent: number): { amount: string; period: string } | null {
  if (startDate.getDate() === 1) return null;
  const year = startDate.getFullYear();
  const month = startDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysRemaining = daysInMonth - startDate.getDate() + 1;
  const amount = Math.round((monthlyRent / daysInMonth) * daysRemaining * 100) / 100;
  const monthEnd = new Date(year, month, daysInMonth);
  return {
    amount: formatMoney(amount),
    period: `${startDate.toLocaleDateString("en-CA")} to ${monthEnd.toLocaleDateString("en-CA")}`,
  };
}

export type LeaseMergeFields = Record<string, string>;

export function buildLeaseMergeFields({
  asOf = new Date(),
  landlordName,
  tenantNames,
  premises,
  startDate,
  endDate,
  rentAmount,
  depositAmount,
  depositDate,
  additionalTermsText,
}: {
  asOf?: Date;
  landlordName: string;
  tenantNames: string[];
  premises: string;
  startDate: Date;
  endDate: Date;
  rentAmount: number;
  depositAmount: number;
  depositDate: Date;
  additionalTermsText?: string | null;
}): LeaseMergeFields {
  const partial = partialRent(startDate, rentAmount);
  const fields: LeaseMergeFields = {
    agreement_date: formatLongDate(asOf),
    landlord_name: landlordName,
    tenant_name_1: tenantNames[0] ?? "",
    tenant_name_2: tenantNames[1] ?? "",
    premises,
    term_start: formatLongDate(startDate),
    term_end: formatLongDate(endDate),
    rent_amount: formatMoney(rentAmount),
    partial_rent_amount: partial?.amount ?? "",
    partial_rent_period: partial?.period ?? "",
    deposit_amount: formatMoney(depositAmount),
    deposit_date: depositDate.toLocaleDateString("en-CA"),
  };
  if (additionalTermsText) fields.custom_terms_text = additionalTermsText;
  return fields;
}

// Merge fields for the one-click "Send renewal for signature" flow on the
// Renewals tab — mapped onto the owner's own existing "Lease Amendment and
// Term Modification Agreement" document (the real form Alina/Cindy already
// use for renewals and other mid-lease changes), not a document invented
// for this feature. That document's "Extension of current fixed term"
// checkbox and its "Shortening of current fixed term" section are
// permanent marks on the template itself, not merge fields — this flow
// only ever produces an extension, never a shortening, so there's nothing
// to toggle there. The rent section's two checkboxes do need to react to
// whether this renewal actually changes the rent, so both are sent as
// real Dropbox Sign checkbox fields ("true"/"false"), with the $ amount
// and effective date left blank whenever rent isn't changing.
export function buildLeaseRenewalMergeFields({
  landlordName,
  tenantNames,
  premises,
  originalLeaseDate,
  renewalStart,
  renewalEnd,
  rentChanged,
  newRentAmount,
  newPets,
  newLeaseTerms,
}: {
  landlordName: string;
  tenantNames: string[];
  premises: string;
  // The date on the original Residential Tenancy Agreement this renewal
  // amends — the document's own opening line ("...Agreement DATED ___")
  // asks for that lease's date, not today's date.
  originalLeaseDate: Date;
  renewalStart: Date;
  renewalEnd: Date;
  rentChanged: boolean;
  newRentAmount: number;
  newPets?: string | null;
  newLeaseTerms?: string | null;
}): LeaseMergeFields {
  const petsNote = newPets?.trim() ? `Pets for this renewal: ${newPets.trim()}.` : "";
  const additionalConditions =
    [petsNote, newLeaseTerms?.trim()].filter(Boolean).join(" ") || "None.";
  return {
    original_lease_date: formatLongDate(originalLeaseDate),
    premises,
    landlord_name: landlordName,
    // The document shows the landlord's name twice (the "BETWEEN" preamble
    // and again on the signature line) — Dropbox Sign requires every
    // placed field's API ID to be unique within a template, so the second
    // occurrence needs its own suffixed field carrying the same value.
    landlord_name_b: landlordName,
    // The document's "BETWEEN... - and -" line has one blank for every
    // tenant's name together, not one blank per tenant — tenant_name_1/2
    // below are for the separate per-tenant signature lines further down.
    tenant_names: tenantNames.length > 1 ? tenantNames.join(" and ") : (tenantNames[0] ?? ""),
    tenant_name_1: tenantNames[0] ?? "",
    tenant_name_2: tenantNames[1] ?? "",
    renewal_term_start: formatLongDate(renewalStart),
    renewal_term_end: formatLongDate(renewalEnd),
    rent_unchanged: rentChanged ? "false" : "true",
    rent_amended: rentChanged ? "true" : "false",
    new_rent_amount: rentChanged ? formatMoney(newRentAmount) : "",
    rent_effective_date: rentChanged ? formatLongDate(renewalStart) : "",
    additional_conditions: additionalConditions,
  };
}

// Legal entity name is a simple, confirmed rule across all seven current
// projects — "{project name} Inc." — rather than a stored field, so it
// can't drift out of sync with the project's own name. If a future
// project's real legal name doesn't follow this pattern, that's a
// one-line change here, not a data migration.
export function projectLegalEntityName(internalName: string): string {
  return `${internalName} Inc.`;
}

// A unit's own civic address (unitNumber, e.g. "3768 23 AVE SW") already
// fully identifies it — all it needs added is the neighbourhood/city/
// province context. That used to be sliced out of the project's own
// Address field (reliably ending "{Neighbourhood}, {City}, {Province}"
// for a multi-building project like Killarney23, whose Address is a
// composite covering every street in it), but Address now holds the
// project's own separate civic address (the one the city assigns the
// site as a whole, e.g. for permits) — a different address entirely,
// not a superset of the unit's, so it can't be sliced for this anymore.
// Every current project is in Calgary, AB (same confirmed rule as
// projectLegalEntityName above) — a one-line change here, not a data
// migration, if that ever stops being true.
export function unitPremises(unitNumber: string, projectNeighbourhood: string): string {
  return `Unit ${unitNumber}, ${projectNeighbourhood}, Calgary, AB`;
}
