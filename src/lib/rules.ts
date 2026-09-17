// Compliance rules called out explicitly in phase0_data_model.md and the
// company context doc. Kept as small, pure, testable functions so the
// server actions that call them stay thin.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * A unit can have many leases on file (its full history), but at most one
 * is actually in effect on a given day: started, and either periodic or
 * not yet ended. Shared definition of "active" so it stays consistent
 * everywhere it's used (unit.currentRent sync, "current tenant" display,
 * etc.) rather than being re-derived slightly differently in each place.
 */
export function pickActiveLease<
  T extends { startDate: Date; endDate: Date | null; periodic: boolean },
>(leases: T[], asOf: Date = new Date()): T | null {
  const sorted = [...leases].sort(
    (a, b) => b.startDate.getTime() - a.startDate.getTime(),
  );
  return (
    sorted.find(
      (l) => l.startDate <= asOf && (l.periodic || !l.endDate || l.endDate >= asOf),
    ) ?? null
  );
}

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

/**
 * Rent is assumed due on the 1st of each month (this app has no per-lease
 * due-day field, so `period` itself — always the 1st — doubles as the due
 * date). A reminder is due once inside a window starting `daysBefore` the
 * due date, and never again once one's actually been sent for that period
 * — checked separately from "already paid" so a same-day payment and a
 * same-day reminder can't race each other into double-texting.
 */
export function isRentReminderDue({
  period,
  paidDate,
  reminderSentAt,
  daysBefore = 3,
  asOf = new Date(),
}: {
  period: Date;
  paidDate: Date | null;
  reminderSentAt: Date | null;
  daysBefore?: number;
  asOf?: Date;
}): boolean {
  if (paidDate || reminderSentAt) return false;
  const windowStart = new Date(period.getTime() - daysBefore * MS_PER_DAY);
  return asOf >= windowStart;
}

// Calgary — the only timezone this business operates in (same reasoning as
// tour scheduling's and rent reminders' own timezone handling).
const RENT_TIMEZONE = "America/Edmonton";

function mountainDateKey(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: RENT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${day}`;
}

/**
 * Rent is due through the end of the due date itself, Mountain time — a
 * charge isn't overdue until the calendar day after `period`. `period` is
 * stored as UTC midnight of the 1st (a calendar-month marker, not a real
 * instant — see rent-reminders.ts), so comparing it directly against a
 * real-time `asOf` instant would flag it overdue several hours *before*
 * the due date even starts in Mountain time. Comparing Mountain calendar
 * dates instead means a charge stays "unpaid" (not overdue) for all of
 * its due date and only flips to overdue starting the next day.
 */
/**
 * Orchestrator inbox: a contact (tenant/lead/vendor) needs attention when
 * their most recent text is inbound and hasn't been handled yet — either a
 * real reply went out (attentionClearedAt gets set whenever one does, see
 * sendText() in actions/sms.ts) or staff dismissed it by hand. A contact
 * whose last text was outbound (staff already had the last word) never
 * needs attention, regardless of attentionClearedAt.
 */
export function threadNeedsAttention({
  lastMessage,
  attentionClearedAt,
}: {
  lastMessage: { direction: "INBOUND" | "OUTBOUND"; timestamp: Date } | null;
  attentionClearedAt: Date | null;
}): boolean {
  if (!lastMessage || lastMessage.direction !== "INBOUND") return false;
  if (attentionClearedAt && attentionClearedAt >= lastMessage.timestamp) return false;
  return true;
}

export function isRentOverdue({
  period,
  paidDate,
  asOf = new Date(),
}: {
  period: Date;
  paidDate: Date | null;
  asOf?: Date;
}): boolean {
  if (paidDate) return false;
  const dueDateKey = `${period.getUTCFullYear()}-${String(period.getUTCMonth() + 1).padStart(2, "0")}-01`;
  return mountainDateKey(asOf) > dueDateKey;
}
