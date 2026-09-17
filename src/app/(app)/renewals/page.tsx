import { prisma } from "@/lib/prisma";
import { Card, Table, Th, Td, Badge, EmptyState } from "@/components/ui";
import {
  pickActiveLease,
  needsRenewalDecision,
  rentIncreaseNoticeWindow,
  isRentIncreaseNoticeDeadlineNear,
} from "@/lib/rules";
import Link from "next/link";

const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

export default async function RenewalsPage() {
  const units = await prisma.unit.findMany({
    orderBy: [
      { projectEntity: { displayOrder: "asc" } },
      { unitNumber: "asc" },
    ],
    include: {
      projectEntity: true,
      leases: {
        include: { tenants: { include: { tenant: true } } },
      },
    },
  });

  const decisionsNeeded: {
    unitLabel: string;
    leaseId: string;
    tenantNames: string;
    endDate: Date;
    overdue: boolean;
  }[] = [];

  const noticeDeadlinesNear: {
    unitLabel: string;
    leaseId: string;
    tenantNames: string;
    rentAmount: number;
    nextEligibleDate: Date;
    noticeDeadline: Date;
    deadlinePassed: boolean;
  }[] = [];

  const now = new Date();

  for (const unit of units) {
    const active = pickActiveLease(unit.leases, now);
    if (!active) continue;

    const unitLabel = `${unit.projectEntity.internalName} — Unit ${unit.unitNumber}`;
    const tenantNames =
      active.tenants.map((t) => t.tenant.name).join(", ") || "—";

    if (!active.periodic && active.endDate) {
      const hasSuccessorLease = unit.leases.some(
        (l) => l.id !== active.id && l.startDate > active.endDate!,
      );
      if (
        needsRenewalDecision({
          periodic: active.periodic,
          endDate: active.endDate,
          hasSuccessorLease,
          asOf: now,
        })
      ) {
        decisionsNeeded.push({
          unitLabel,
          leaseId: active.id,
          tenantNames,
          endDate: active.endDate,
          overdue: active.endDate < now,
        });
      }
    }

    if (active.periodic) {
      const { nextEligibleDate, noticeDeadline } = rentIncreaseNoticeWindow({
        lastRentIncreaseDate: active.lastRentIncreaseDate,
        leaseStartDate: active.startDate,
      });
      if (isRentIncreaseNoticeDeadlineNear({ noticeDeadline, asOf: now })) {
        noticeDeadlinesNear.push({
          unitLabel,
          leaseId: active.id,
          tenantNames,
          rentAmount: Number(active.rentAmount),
          nextEligibleDate,
          noticeDeadline,
          deadlinePassed: noticeDeadline < now,
        });
      }
    }
  }

  decisionsNeeded.sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
  noticeDeadlinesNear.sort(
    (a, b) => a.noticeDeadline.getTime() - b.noticeDeadline.getTime(),
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-sm font-semibold text-neutral-900">
          Renewal decisions needed
        </h2>
        <p className="mb-3 text-sm text-neutral-500">
          Fixed-term leases ending within 90 days (or already past their end
          date) with no new lease arranged yet — renew, switch to periodic,
          or confirm the tenant&apos;s moving out.
        </p>
        <Table>
          <thead>
            <tr>
              <Th>Project / Unit</Th>
              <Th>Tenant(s)</Th>
              <Th>End date</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {decisionsNeeded.map((d) => (
              <tr key={d.leaseId} className="hover:bg-neutral-50">
                <Td>
                  <Link href={`/leases/${d.leaseId}`} className="underline">
                    {d.unitLabel}
                  </Link>
                </Td>
                <Td>{d.tenantNames}</Td>
                <Td>{d.endDate.toLocaleDateString()}</Td>
                <Td>
                  {d.overdue ? (
                    <Badge tone="red">Past end date</Badge>
                  ) : (
                    <Badge tone="amber">Decision needed</Badge>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {decisionsNeeded.length === 0 && (
          <EmptyState>Nothing needs a renewal decision right now.</EmptyState>
        )}
      </div>

      <div>
        <h2 className="mb-1 text-sm font-semibold text-neutral-900">
          Rent-increase notice deadlines approaching
        </h2>
        <p className="mb-3 text-sm text-neutral-500">
          Periodic leases where the 3-months&apos;-notice deadline for the
          next allowed rent increase is coming up within 30 days — give
          written notice by the date shown to raise rent as soon as it&apos;s
          eligible.
        </p>
        <Table>
          <thead>
            <tr>
              <Th>Project / Unit</Th>
              <Th>Tenant(s)</Th>
              <Th>Current rent</Th>
              <Th>Notice deadline</Th>
              <Th>Next eligible increase</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {noticeDeadlinesNear.map((n) => (
              <tr key={n.leaseId} className="hover:bg-neutral-50">
                <Td>
                  <Link href={`/leases/${n.leaseId}`} className="underline">
                    {n.unitLabel}
                  </Link>
                </Td>
                <Td>{n.tenantNames}</Td>
                <Td>{money(n.rentAmount)}</Td>
                <Td>
                  <Badge tone={n.deadlinePassed ? "red" : "amber"}>
                    {n.noticeDeadline.toLocaleDateString()}
                  </Badge>
                </Td>
                <Td>{n.nextEligibleDate.toLocaleDateString()}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {noticeDeadlinesNear.length === 0 && (
          <EmptyState>No rent-increase notice deadlines coming up.</EmptyState>
        )}
      </div>

      <Card>
        <p className="text-sm text-neutral-500">
          A renewal decision clears itself once a new lease is created for
          the unit (a fresh fixed term, or a switch to periodic) — nothing to
          dismiss by hand. A notice deadline clears itself once the increase
          is actually recorded on the lease.
        </p>
      </Card>
    </div>
  );
}
