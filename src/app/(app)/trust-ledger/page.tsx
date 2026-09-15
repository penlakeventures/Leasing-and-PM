import { prisma } from "@/lib/prisma";
import { Card, Table, Th, Td, Badge, EmptyState } from "@/components/ui";
import { isDepositOverdue, depositReturnDeadline } from "@/lib/rules";
import Link from "next/link";

const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

export default async function TrustLedgerPage() {
  const deposits = await prisma.securityDeposit.findMany({
    include: {
      lease: {
        include: {
          unit: { include: { projectEntity: true } },
          tenants: { include: { tenant: true } },
        },
      },
      deductions: true,
    },
    // Same project order as the Projects/Units/Leases pages, then unit
    // number within a project, then most-recent-first for a unit's own
    // deposit history.
    orderBy: [
      { lease: { unit: { projectEntity: { displayOrder: "asc" } } } },
      { lease: { unit: { unitNumber: "asc" } } },
      { dateReceived: "desc" },
    ],
  });

  const held = deposits.filter((d) => !d.dateReturned);
  const totalHeld = held.reduce((sum, d) => sum + Number(d.amount), 0);
  const totalInterestAccrued = held.reduce(
    (sum, d) => sum + Number(d.interestAccrued ?? 0),
    0,
  );
  const overdue = held.filter((d) =>
    isDepositOverdue({
      tenancyEndDate: d.lease.endDate,
      dateReturned: d.dateReturned,
    }),
  );

  // Reconciliation aid: what the app says should be sitting in each trust
  // sub-account right now, so it can be checked against the actual bank
  // balance for that account.
  const byAccount = new Map<string, { total: number; count: number }>();
  for (const d of held) {
    const ref = d.trustAccountRef?.trim() || "(no trust account on file)";
    const entry = byAccount.get(ref) ?? { total: 0, count: 0 };
    entry.total += Number(d.amount);
    entry.count += 1;
    byAccount.set(ref, entry);
  }
  const accountRows = [...byAccount.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-2xl font-semibold text-neutral-900">
            {money(totalHeld)}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Held across {held.length} deposit{held.length === 1 ? "" : "s"}
          </p>
        </Card>
        <Card>
          <p className="text-2xl font-semibold text-neutral-900">
            {money(totalInterestAccrued)}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Interest accrued, held deposits
          </p>
        </Card>
        <Card>
          <p className="text-2xl font-semibold text-neutral-900">
            {overdue.length}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Overdue for return (10-day deadline passed)
          </p>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">
          By trust account
        </h2>
        <Table>
          <thead>
            <tr>
              <Th>Trust account reference</Th>
              <Th>Deposits held</Th>
              <Th>Should be on deposit</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {accountRows.map(([ref, entry]) => (
              <tr key={ref} className="hover:bg-neutral-50">
                <Td>{ref}</Td>
                <Td>{entry.count}</Td>
                <Td>{money(entry.total)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {accountRows.length === 0 && (
          <EmptyState>No deposits currently held.</EmptyState>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">
          All deposits
        </h2>
        <Table>
          <thead>
            <tr>
              <Th>Project / Unit</Th>
              <Th>Tenant(s)</Th>
              <Th>Trust account</Th>
              <Th>Amount</Th>
              <Th>Date received</Th>
              <Th>Refundable</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {deposits.map((d) => {
              const totalDeductions = d.deductions.reduce(
                (sum, x) => sum + Number(x.amount),
                0,
              );
              const refundable = Number(d.amount) - totalDeductions;
              const tenantNames =
                d.lease.tenants.map((t) => t.tenant.name).join(", ") || "—";
              const isOverdue = isDepositOverdue({
                tenancyEndDate: d.lease.endDate,
                dateReturned: d.dateReturned,
              });
              return (
                <tr key={d.id} className="hover:bg-neutral-50">
                  <Td>
                    <Link href={`/leases/${d.leaseId}`} className="underline">
                      {d.lease.unit.projectEntity.internalName} — Unit{" "}
                      {d.lease.unit.unitNumber}
                    </Link>
                  </Td>
                  <Td>{tenantNames}</Td>
                  <Td>{d.trustAccountRef || "—"}</Td>
                  <Td>{money(Number(d.amount))}</Td>
                  <Td>{d.dateReceived.toLocaleDateString()}</Td>
                  <Td>{money(refundable)}</Td>
                  <Td>
                    {d.dateReturned ? (
                      <Badge tone="neutral">
                        Returned {d.dateReturned.toLocaleDateString()}
                      </Badge>
                    ) : isOverdue ? (
                      <Badge tone="red">
                        Overdue — due{" "}
                        {d.lease.endDate
                          ? depositReturnDeadline(
                              d.lease.endDate,
                            ).toLocaleDateString()
                          : ""}
                      </Badge>
                    ) : (
                      <Badge tone="green">Held</Badge>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        {deposits.length === 0 && (
          <EmptyState>No security deposits on file yet.</EmptyState>
        )}
      </div>
    </div>
  );
}
