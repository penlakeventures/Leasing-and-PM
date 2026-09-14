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
