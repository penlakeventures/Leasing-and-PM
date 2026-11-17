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
      // Owner's specified project order (ProjectEntity.displayOrder), not
      // whatever order Postgres happens to return rows in — otherwise this
      // list jumps between projects unpredictably instead of reading top
      // to bottom the way the portfolio is actually organized.
      orderBy: [
        { lease: { unit: { projectEntity: { displayOrder: "asc" } } } },
        { lease: { unit: { unitNumber: "asc" } } },
      ],
    }),
    prisma.rentPayment.findMany({
      where: { paidDate: null },
      include: { lease: { include: { unit: { include: { projectEntity: true } } } } },
      orderBy: [
        { lease: { unit: { projectEntity: { displayOrder: "asc" } } } },
        { lease: { unit: { unitNumber: "asc" } } },
      ],
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

  // Both lists are already sorted by project display order (see the
  // queries above), so grouping is just folding consecutive same-project
  // rows together — not a re-sort — to show each project's name once
  // instead of repeating it on every unit's row.
  function groupByProject<T extends { lease: { unit: { projectEntity: { internalName: string }; unitNumber: string } } }>(
    items: T[],
  ): { projectName: string; items: T[] }[] {
    const groups: { projectName: string; items: T[] }[] = [];
    for (const item of items) {
      const projectName = item.lease.unit.projectEntity.internalName;
      const lastGroup = groups[groups.length - 1];
      if (lastGroup?.projectName === projectName) {
        lastGroup.items.push(item);
      } else {
        groups.push({ projectName, items: [item] });
      }
    }
    return groups;
  }

  const overdueDepositsByProject = groupByProject(overdueDeposits);
  const overdueRentByProject = groupByProject(overdueRent);

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
      {/* Fixed-position row, same reasoning as the tab bar: flex-nowrap +
          overflow-x-auto instead of a responsive grid, so narrowing the
          window scrolls the row instead of reflowing tiles onto new lines. */}
      <div className="flex flex-nowrap gap-4 overflow-x-auto pb-1">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="w-36 shrink-0">
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
            <div className="space-y-4">
              {overdueDepositsByProject.map((group) => (
                <div key={group.projectName}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {group.projectName}
                  </p>
                  <ul className="space-y-2 text-sm">
                    {group.items.map((d) => (
                      <li key={d.id} className="flex justify-between">
                        <span>Unit {d.lease.unit.unitNumber}</span>
                        <Link
                          href={`/leases/${d.lease.id}`}
                          className="text-neutral-900 underline"
                        >
                          Review lease
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {overdueRent.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">
            Rent overdue <Badge tone="red">past due date</Badge>
          </h2>
          <Card>
            <div className="space-y-4">
              {overdueRentByProject.map((group) => (
                <div key={group.projectName}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {group.projectName}
                  </p>
                  <ul className="space-y-2 text-sm">
                    {group.items.map((p) => (
                      <li key={p.id} className="flex justify-between">
                        <span>Unit {p.lease.unit.unitNumber}</span>
                        <Link href="/rent" className="text-neutral-900 underline">
                          Review rent
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
