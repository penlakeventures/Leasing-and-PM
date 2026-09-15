// Compliance rules called out explicitly in phase0_data_model.md and the
// company context doc. Kept as small, pure, testable functions so the
// server actions that call them stay thin.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * CMHC MLI Select / Alberta rule: rent on an AFFORDABLE unit may rise only
 * by the annual CPI published by Statistics Canada. The system should
 * refuse (or at least flag) any change that exceeds it. Market units are
 * not capped here.
 */
export function checkRentEscalation({
  cmhcDesignation,
  currentRent,
  proposedRent,
  cpiRatePercent,
}: {
  cmhcDesignation: "MARKET" | "AFFORDABLE";
  currentRent: number;
  proposedRent: number;
  cpiRatePercent: number | null;
}): { allowed: boolean; maxAllowedRent: number | null; reason?: string } {
  if (cmhcDesignation !== "AFFORDABLE") {
    return { allowed: true, maxAllowedRent: null };
  }

  if (cpiRatePercent === null) {
    return {
      allowed: false,
      maxAllowedRent: null,
      reason:
        "No CPI rate is on file for the current year. Set it under Rates before changing an affordable unit's rent.",
    };
  }

  const maxAllowedRent =
    Math.round(currentRent * (1 + cpiRatePercent / 100) * 100) / 100;

  if (proposedRent > maxAllowedRent) {
    return {
      allowed: false,
      maxAllowedRent,
      reason: `Affordable-unit rent is capped at annual CPI (${cpiRatePercent}%). Max allowed is $${maxAllowedRent.toFixed(2)}, proposed was $${proposedRent.toFixed(2)}.`,
    };
  }

  return { allowed: true, maxAllowedRent };
}

/**
 * Alberta RTA: a security deposit cannot exceed one month's rent, and
 * cannot be increased once set.
 */
export function checkSecurityDepositAmount({
  depositAmount,
  monthlyRent,
  existingAmount,
}: {
  depositAmount: number;
  monthlyRent: number;
  existingAmount?: number | null;
}): { allowed: boolean; reason?: string } {
  if (depositAmount > monthlyRent) {
    return {
      allowed: false,
      reason: `Alberta RTA caps a security deposit at one month's rent ($${monthlyRent.toFixed(2)}). Entered amount was $${depositAmount.toFixed(2)}.`,
    };
  }

  if (
    existingAmount !== undefined &&
    existingAmount !== null &&
    depositAmount > existingAmount
  ) {
    return {
      allowed: false,
      reason: `A security deposit cannot be increased after it's been set (was $${existingAmount.toFixed(2)}).`,
    };
  }

  return { allowed: true };
}

/**
 * Alberta RTA: for a periodic (month-to-month) tenancy, rent can be raised
 * at most once every 365 days, and only with at least 3 months' written
 * notice before the increase takes effect. Fixed-term leases (periodic:
 * false) aren't covered here — a fixed-term agreement generally can't
 * change rent mid-term at all unless the agreement itself provides for
 * it, which this app doesn't model.
 *
 * This app applies a rent change immediately on save (it doesn't hold a
 * "pending" rent until a future date), so the workflow this assumes is:
 * notice was already given in writing outside the app, and this is
 * recorded — checked, not just logged — when the increase actually takes
 * effect. `lastRentIncreaseDate` becomes the anchor for the next check.
 *
 * Caveat worth knowing: for a lease imported without prior rent-increase
 * history, the lease's start date is used as the anchor since that's all
 * that's on file — if the real rent was already raised once before this
 * app existed, that's not reflected, and the 365-day check will be more
 * permissive than it should be until an increase is recorded here.
 */
export function checkRentIncreaseNotice({
  periodic,
  leaseStartDate,
  lastRentIncreaseDate,
  currentRent,
  proposedRent,
  noticeGivenDate,
  asOf = new Date(),
}: {
  periodic: boolean;
  leaseStartDate: Date;
  lastRentIncreaseDate: Date | null;
  currentRent: number;
  proposedRent: number;
  noticeGivenDate: Date | null;
  asOf?: Date;
}): { allowed: boolean; reason?: string } {
  if (!periodic || proposedRent <= currentRent) {
    return { allowed: true };
  }

  const anchor = lastRentIncreaseDate ?? leaseStartDate;
  const nextAllowedDate = new Date(anchor.getTime() + 365 * MS_PER_DAY);
  if (asOf < nextAllowedDate) {
    return {
      allowed: false,
      reason: `Alberta RTA allows a periodic tenancy's rent to be raised only once every 365 days. This lease's rent last changed (or the tenancy started) on ${anchor.toLocaleDateString()}; the next increase isn't allowed until ${nextAllowedDate.toLocaleDateString()}.`,
    };
  }

  if (!noticeGivenDate) {
    return {
      allowed: false,
      reason:
        "Raising rent on a periodic tenancy requires written notice at least 3 months before it takes effect. Enter the date notice was given.",
    };
  }

  const minNoticeDate = new Date(asOf);
  minNoticeDate.setMonth(minNoticeDate.getMonth() - 3);
  if (noticeGivenDate > minNoticeDate) {
    const earliestEffective = new Date(noticeGivenDate);
    earliestEffective.setMonth(earliestEffective.getMonth() + 3);
    return {
      allowed: false,
      reason: `Alberta RTA requires at least 3 months' written notice before a rent increase takes effect. Notice given on ${noticeGivenDate.toLocaleDateString()} is too recent — the increase can't take effect until ${earliestEffective.toLocaleDateString()}.`,
    };
  }

  return { allowed: true };
}

/**
 * Alberta RTA: a landlord has 10 days after the tenancy ends to return the
 * deposit (less any itemized deductions).
 */
export function depositReturnDeadline(tenancyEndDate: Date): Date {
  return new Date(tenancyEndDate.getTime() + 10 * MS_PER_DAY);
}

export function isDepositOverdue({
  tenancyEndDate,
  dateReturned,
  asOf = new Date(),
}: {
  tenancyEndDate: Date | null;
  dateReturned: Date | null;
  asOf?: Date;
}): boolean {
  if (!tenancyEndDate || dateReturned) return false;
  return asOf > depositReturnDeadline(tenancyEndDate);
}
