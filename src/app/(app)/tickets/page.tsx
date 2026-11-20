import { prisma } from "@/lib/prisma";
import { Table, Th, Td, LinkButton, Badge, EmptyState } from "@/components/ui";
import Link from "next/link";

const statusTone: Record<string, "neutral" | "green" | "amber" | "red" | "blue"> = {
  NEW: "blue",
  ASSIGNED: "amber",
  IN_PROGRESS: "amber",
  RESOLVED: "green",
};

const priorityTone: Record<string, "neutral" | "green" | "amber" | "red" | "blue"> = {
  LOW: "neutral",
  MEDIUM: "blue",
  HIGH: "amber",
  URGENT: "red",
};

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const { all } = await searchParams;
  const showAll = all === "1";

  const tickets = await prisma.maintenanceTicket.findMany({
    // Resolved tickets pile up forever, same as ended leases/past tenants —
    // default to what's actually open, matching the nav badge's own
    // definition of "needs attention" (status !== RESOLVED).
    where: showAll ? undefined : { status: { not: "RESOLVED" } },
    // Postgres enums sort by declaration order (LOW < MEDIUM < HIGH <
    // URGENT), so priority desc surfaces the most urgent first; createdAt
    // desc breaks ties within a priority.
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: { unit: { include: { projectEntity: true } }, vendor: true },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={showAll ? "/tickets" : "/tickets?all=1"}
          className="text-sm text-neutral-600 underline"
        >
          {showAll ? "Show open only" : "Show all tickets (including resolved)"}
        </Link>
        <LinkButton href="/tickets/new">+ New ticket</LinkButton>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Unit</Th>
            <Th>Description</Th>
            <Th>Priority</Th>
            <Th>Status</Th>
            <Th>Vendor</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {tickets.map((t) => (
            <tr key={t.id} className="hover:bg-neutral-50">
              <Td>
                {t.unit.projectEntity.internalName} — Unit {t.unit.unitNumber}
              </Td>
              <Td>
                <Link href={`/tickets/${t.id}`} className="underline">
                  {t.description.slice(0, 60)}
                </Link>
              </Td>
              <Td>
                <Badge tone={priorityTone[t.priority]}>{t.priority}</Badge>
              </Td>
              <Td>
                <Badge tone={statusTone[t.status]}>{t.status.replace("_", " ")}</Badge>
              </Td>
              <Td>{t.vendor?.name ?? "—"}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {tickets.length === 0 && (
        <EmptyState>{showAll ? "No maintenance tickets yet." : "No open tickets right now."}</EmptyState>
      )}
    </div>
  );
}
