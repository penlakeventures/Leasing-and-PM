import { prisma } from "@/lib/prisma";

// This business operates in exactly one timezone — Calgary/Mountain — same
// reasoning as tour scheduling's own timezone handling.
const RENT_TIMEZONE = "America/Edmonton";

// A "period" is always the 1st of a calendar month, stored as UTC midnight
// of that date — a calendar-month key more than a precise instant, so the
// few hours' difference between that and true Mountain midnight doesn't
// matter for a reminder window measured in days.
function currentRentPeriod(asOf: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: RENT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(asOf);
  const year = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value);
  return new Date(Date.UTC(year, month - 1, 1));
}

function isLeaseActiveOn(
  lease: { startDate: Date; endDate: Date | null; periodic: boolean },
  asOf: Date,
): boolean {
  return lease.startDate <= asOf && (lease.periodic || !lease.endDate || lease.endDate >= asOf);
}

// Creates this month's rent charge for every currently-active lease that
// doesn't already have one — safe to call repeatedly (a lease that
// already has this period's row is left untouched, amountDue included,
// so a later rent change doesn't silently rewrite an already-created
// charge).
export async function ensureCurrentPeriodPayments(asOf: Date = new Date()): Promise<number> {
  const period = currentRentPeriod(asOf);
  const leases = await prisma.lease.findMany({
    where: { startDate: { lte: asOf } },
  });
  const active = leases.filter((l) => isLeaseActiveOn(l, asOf));

  let created = 0;
  for (const lease of active) {
    const existing = await prisma.rentPayment.findUnique({
      where: { leaseId_period: { leaseId: lease.id, period } },
    });
    if (existing) continue;
    await prisma.rentPayment.create({
      data: { leaseId: lease.id, period, amountDue: lease.rentAmount },
    });
    created++;
  }
  return created;
}
