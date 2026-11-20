import { prisma } from "@/lib/prisma";
import { Table, Th, Td, LinkButton, Badge, EmptyState } from "@/components/ui";
import Link from "next/link";

export default async function LeasesPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const { all } = await searchParams;
  const showAll = all === "1";
  const now = new Date();

  const leases = await prisma.lease.findMany({
    // Past leases pile up forever (each unit keeps its full history) —
    // default to what's actually live today; "Show all" opts back into
    // the full record.
    where: showAll ? undefined : { OR: [{ endDate: null }, { endDate: { gt: now } }] },
    // Same project order as the Projects/Units pages, then unit number
    // within a project, then most-recent-first for a unit's own lease
    // history (multiple leases per unit over time).
    orderBy: [
      { unit: { projectEntity: { displayOrder: "asc" } } },
      { unit: { unitNumber: "asc" } },
      { startDate: "desc" },
    ],
    include: {
      unit: { include: { projectEntity: true } },
      tenants: { include: { tenant: true } },
    },
  });

  const isActive = (endDate: Date | null) => !endDate || endDate > now;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={showAll ? "/leases" : "/leases?all=1"}
          className="text-sm text-neutral-600 underline"
        >
          {showAll ? "Show active only" : "Show all leases (including ended)"}
        </Link>
        <LinkButton href="/leases/new">+ New lease</LinkButton>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Project</Th>
            <Th>Unit</Th>
            <Th>Tenant(s)</Th>
            <Th>Rent</Th>
            <Th>Start</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {leases.map((l) => (
            <tr key={l.id} className="hover:bg-neutral-50">
              <Td>{l.unit.projectEntity.internalName}</Td>
              <Td>
                <Link href={`/leases/${l.id}`} className="underline">
                  {l.unit.unitNumber}
                </Link>
              </Td>
              <Td>{l.tenants.map((t) => t.tenant.name).join(", ") || "—"}</Td>
              <Td>${l.rentAmount.toString()}</Td>
              <Td>{l.startDate.toLocaleDateString()}</Td>
              <Td>
                {!isActive(l.endDate) ? (
                  <Badge tone="neutral">Ended</Badge>
                ) : l.signedDate ? (
                  <Badge tone="green">Active</Badge>
                ) : (
                  <Badge tone="amber">Unsigned</Badge>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {leases.length === 0 && (
        <EmptyState>{showAll ? "No leases yet." : "No active leases right now."}</EmptyState>
      )}
    </div>
  );
}
