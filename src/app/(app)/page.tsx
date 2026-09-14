import { prisma } from "@/lib/prisma";
import { Card, PageHeader, Badge } from "@/components/ui";
import Link from "next/link";

export default async function DashboardPage() {
  const [
    projectCount,
    unitCount,
    activeLeaseCount,
    openTickets,
    activeLeads,
    depositsPastDue,
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
    // Deposits on leases that have ended but haven't been returned within
    // 10 days — the Alberta RTA deadline the data model flags.
    prisma.securityDeposit.findMany({
      where: {
        dateReturned: null,
        lease: { endDate: { not: null, lt: new Date() } },
      },
      include: { lease: { include: { unit: { include: { projectEntity: true } } } } },
    }),
  ]);

  const stats = [
    { label: "Projects", value: projectCount, href: "/projects" },
    { label: "Units", value: unitCount, href: "/units" },
    { label: "Active leases", value: activeLeaseCount, href: "/leases" },
    { label: "Open tickets", value: openTickets, href: "/tickets" },
    { label: "Active leads", value: activeLeads, href: "/leads" },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Portfolio snapshot across all 7 projects."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card>
              <p className="text-2xl font-semibold text-neutral-900">
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-neutral-500">{stat.label}</p>
            </Card>
          </Link>
        ))}
      </div>

      {depositsPastDue.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">
            Security deposits overdue for return{" "}
            <Badge tone="red">10-day deadline passed</Badge>
          </h2>
          <Card>
            <ul className="space-y-2 text-sm">
              {depositsPastDue.map((d) => (
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
    </div>
  );
}
