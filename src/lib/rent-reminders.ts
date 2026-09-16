import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/twilio";
import { isRentReminderDue } from "@/lib/rules";

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
// charge). Call before sendRentReminders() so there's always something
// current to check.
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

// Texts every tenant with a phone on file for each unpaid, un-reminded
// rent payment that's due soon (see isRentReminderDue). A lease with no
// tenant phone on file is simply skipped, not marked reminded — it'll be
// checked again tomorrow rather than silently given up on forever.
export async function sendRentReminders(
  asOf: Date = new Date(),
): Promise<{ sent: number; failed: number }> {
  const payments = await prisma.rentPayment.findMany({
    where: { paidDate: null, reminderSentAt: null },
    include: {
      lease: {
        include: {
          tenants: { include: { tenant: true } },
          unit: { include: { projectEntity: true } },
        },
      },
    },
  });

  let sent = 0;
  let failed = 0;

  for (const payment of payments) {
    if (
      !isRentReminderDue({
        period: payment.period,
        paidDate: payment.paidDate,
        reminderSentAt: payment.reminderSentAt,
        asOf,
      })
    ) {
      continue;
    }

    const tenantsWithPhone = payment.lease.tenants
      .map((lt) => lt.tenant)
      .filter((t): t is typeof t & { phone: string } => Boolean(t.phone));
    if (tenantsWithPhone.length === 0) continue;

    // period is a calendar-month marker stored as UTC midnight of the 1st
    // — format with timeZone: "UTC", not Mountain time, or the 6-7 hour
    // shift crosses the month boundary and texts tenants the wrong date
    // (e.g. "August 31" instead of "September 1").
    const dueDateLabel = payment.period.toLocaleDateString("en-CA", {
      timeZone: "UTC",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const body = `Rent reminder — ${payment.lease.unit.projectEntity.internalName}, Unit ${payment.lease.unit.unitNumber}: $${payment.amountDue} is due ${dueDateLabel}. Thanks!`;

    for (const tenant of tenantsWithPhone) {
      try {
        const sid = await sendSms({ to: tenant.phone, body });
        await prisma.communicationLog.create({
          data: {
            tenantId: tenant.id,
            channel: "TEXT",
            direction: "OUTBOUND",
            summary: body,
            handledById: null, // automated
            externalRef: `twilio:${sid}`,
          },
        });
        sent++;
      } catch (e) {
        console.error("[sendRentReminders] sendSms failed:", e);
        failed++;
      }
    }

    // Mark it attempted either way — a persistent send failure (e.g. bad
    // Twilio config) shouldn't retry every single day forever; a real
    // fix means someone looked at the logs regardless.
    await prisma.rentPayment.update({
      where: { id: payment.id },
      data: { reminderSentAt: new Date() },
    });
  }

  return { sent, failed };
}
