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

export default async function TicketsPage() {
  const tickets = await prisma.maintenanceTicket.findMany({
    orderBy: { createdAt: "desc" },
    include: { unit: { include: { projectEntity: true } }, vendor: true },
  });

  return (
    <div>
      <div className="mb-6 flex justify-end">
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
      {tickets.length === 0 && <EmptyState>No maintenance tickets yet.</EmptyState>}
    </div>
  );
}
