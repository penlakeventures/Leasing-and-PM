import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui";
import {
  isDepositOverdue,
  isRentOverdue,
  pickActiveLease,
  needsRenewalDecision,
  rentIncreaseNoticeWindow,
  isRentIncreaseNoticeDeadlineNear,
} from "@/lib/rules";
import { getInboxRows } from "@/lib/inbox";
import Link from "next/link";

export default async function DashboardPage() {
  const [
    projectCount,
    unitCount,
    activeLeaseCount,
    openTickets,
    activeLeads,
    depositsPastDue,
    rentUnpaid,
    inboxRows,
    unitsWithLeases,
  ] = await Promise.all([
    prisma.projectEntity.count(),
    prisma.unit.count(),
    prisma.lease.count({
      where: {
        OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
      },
    }),
    prisma.maintenanceTicket.count({
      where: { status: { not: "RESOLVED" } },
    }),
    prisma.lead.count({
      where: { status: { notIn: ["LEASED", "LOST"] } },
    }),
    // Candidates: any ended lease with an unreturned deposit. The actual
    // 10-day-grace-period filtering happens below via isDepositOverdue() —
    // don't duplicate that math here, a lease that ended yesterday isn't
    // overdue yet even though it matches this broader query.
    prisma.securityDeposit.findMany({
      where: {
        dateReturned: null,
        lease: { endDate: { not: null } },
      },
      include: { lease: { include: { unit: { include: { projectEntity: true } } } } },
    }),
    prisma.rentPayment.findMany({
      where: { paidDate: null },
      include: { lease: { include: { unit: { include: { projectEntity: true } } } } },
    }),
    getInboxRows(),
    prisma.unit.findMany({ include: { leases: true } }),
  ]);

  const overdueDeposits = depositsPastDue.filter((d) =>
    isDepositOverdue({
      tenancyEndDate: d.lease.endDate,
      dateReturned: d.dateReturned,
    }),
  );
  const overdueRent = rentUnpaid.filter((p) =>
    isRentOverdue({ period: p.period, paidDate: p.paidDate }),
  );

  // Same logic as the Renewals page itself, just counted here rather than
  // rendered in full — one active lease per unit, checked for either a
  // renewal decision or an approaching rent-increase notice deadline.
  const now = new Date();
  let renewalsDueCount = 0;
  for (const unit of unitsWithLeases) {
    const active = pickActiveLease(unit.leases, now);
    if (!active) continue;
    if (!active.periodic && active.endDate) {
      const hasSuccessorLease = unit.leases.some(
        (l) => l.renewedFromLeaseId === active.id,
      );
      if (
        needsRenewalDecision({
          periodic: active.periodic,
          endDate: active.endDate,
          hasSuccessorLease,
          asOf: now,
        })
      ) {
        renewalsDueCount += 1;
        continue;
      }
    }
    if (active.periodic) {
      const { noticeDeadline } = rentIncreaseNoticeWindow({
        lastRentIncreaseDate: active.lastRentIncreaseDate,
        leaseStartDate: active.startDate,
      });
      if (isRentIncreaseNoticeDeadlineNear({ noticeDeadline, asOf: now })) {
        renewalsDueCount += 1;
      }
    }
  }

  const stats = [
    { label: "Needs a reply", value: inboxRows.length, href: "/inbox" },
    { label: "Renewals due", value: renewalsDueCount, href: "/renewals" },
    { label: "Projects", value: projectCount, href: "/projects" },
    { label: "Units", value: unitCount, href: "/units" },
    { label: "Active leases", value: activeLeaseCount, href: "/leases" },
    { label: "Open tickets", value: openTickets, href: "/tickets" },
    { label: "Active leads", value: activeLeads, href: "/leads" },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="border-t-4 border-t-brand">
              <p className="text-2xl font-semibold text-neutral-900">
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-neutral-500">{stat.label}</p>
            </Card>
          </Link>
        ))}
      </div>

      {overdueDeposits.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">
            Security deposits overdue for return{" "}
            <Badge tone="red">10-day deadline passed</Badge>
          </h2>
          <Card>
            <ul className="space-y-2 text-sm">
              {overdueDeposits.map((d) => (
                <li key={d.id} className="flex justify-between">
                  <span>
                    {d.lease.unit.projectEntity.internalName} — Unit{" "}
                    {d.lease.unit.unitNumber}
                  </span>
                  <Link
                    href={`/leases/${d.lease.id}`}
                    className="text-neutral-900 underline"
                  >
                    Review lease
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {overdueRent.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">
            Rent overdue <Badge tone="red">past due date</Badge>
          </h2>
          <Card>
            <ul className="space-y-2 text-sm">
              {overdueRent.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>
                    {p.lease.unit.projectEntity.internalName} — Unit{" "}
                    {p.lease.unit.unitNumber}
                  </span>
                  <Link href="/rent" className="text-neutral-900 underline">
                    Review rent
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
