import { prisma } from "@/lib/prisma";
import { Card, Table, Th, Td, Badge, EmptyState } from "@/components/ui";
import { markRentPaid, markRentUnpaid } from "@/lib/actions/rent-payments";
import { ensureCurrentPeriodPayments } from "@/lib/rent-reminders";
import { isRentOverdue } from "@/lib/rules";
import Link from "next/link";

export default async function RentPage() {
  // Guarantees the current month's charges exist even if the daily cron
  // hasn't run yet today — cheap and idempotent, safe to do on every load.
  await ensureCurrentPeriodPayments();

  const payments = await prisma.rentPayment.findMany({
    orderBy: [
      { lease: { unit: { projectEntity: { displayOrder: "asc" } } } },
      { lease: { unit: { unitNumber: "asc" } } },
      { period: "desc" },
    ],
    include: {
      lease: {
        include: {
          unit: { include: { projectEntity: true } },
          tenants: { include: { tenant: true } },
        },
      },
    },
  });

  const unpaid = payments.filter((p) => !p.paidDate);
  const overdue = payments.filter((p) => isRentOverdue({ period: p.period, paidDate: p.paidDate }));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-2xl font-semibold text-neutral-900">{unpaid.length}</p>
          <p className="mt-1 text-sm text-neutral-500">Unpaid rent charges</p>
        </Card>
        <Card>
          <p className="text-2xl font-semibold text-neutral-900">{overdue.length}</p>
          <p className="mt-1 text-sm text-neutral-500">Overdue (past the due date)</p>
        </Card>
      </div>

      <Table>
        <thead>
          <tr>
            <Th>Project</Th>
            <Th>Unit</Th>
            <Th>Tenant(s)</Th>
            <Th>Period</Th>
            <Th>Amount due</Th>
            <Th>Status</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {payments.map((p) => {
            const isOverdue = isRentOverdue({ period: p.period, paidDate: p.paidDate });
            const markPaidWithId = markRentPaid.bind(null, p.id);
            const markUnpaidWithId = markRentUnpaid.bind(null, p.id);
            return (
              <tr key={p.id} className="hover:bg-neutral-50">
                <Td>{p.lease.unit.projectEntity.internalName}</Td>
                <Td>
                  <Link href={`/leases/${p.leaseId}`} className="underline">
                    Unit {p.lease.unit.unitNumber}
                  </Link>
                </Td>
                <Td>{p.lease.tenants.map((t) => t.tenant.name).join(", ") || "—"}</Td>
                <Td>
                  {/* period is a calendar-month marker stored as UTC
                      midnight of the 1st (see rent-reminders.ts) — format
                      with timeZone: "UTC", not Mountain time, or a
                      6-7 hour shift crosses the month boundary and shows
                      the wrong month entirely. */}
                  {p.period.toLocaleDateString("en-CA", {
                    timeZone: "UTC",
                    month: "long",
                    year: "numeric",
                  })}
                </Td>
                <Td>${p.amountDue.toString()}</Td>
                <Td>
                  {p.paidDate ? (
                    <Badge tone="green">Paid {p.paidDate.toLocaleDateString()}</Badge>
                  ) : isOverdue ? (
                    <Badge tone="red">Overdue</Badge>
                  ) : (
                    <Badge tone="amber">Unpaid</Badge>
                  )}
                </Td>
                <Td>
                  <form action={p.paidDate ? markUnpaidWithId : markPaidWithId}>
                    <button type="submit" className="text-sm text-neutral-600 underline">
                      {p.paidDate ? "Undo" : "Mark paid"}
                    </button>
                  </form>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {payments.length === 0 && <EmptyState>No rent charges yet.</EmptyState>}
    </div>
  );
}
