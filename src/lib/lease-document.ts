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

function formatMoney(amount: number): string {
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

// Legal entity name is a simple, confirmed rule across all seven current
// projects — "{project name} Inc." — rather than a stored field, so it
// can't drift out of sync with the project's own name. If a future
// project's real legal name doesn't follow this pattern, that's a
// one-line change here, not a data migration.
export function projectLegalEntityName(internalName: string): string {
  return `${internalName} Inc.`;
}
