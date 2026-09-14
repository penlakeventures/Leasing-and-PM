import { prisma } from "@/lib/prisma";
import { PageHeader, Table, Th, Td, LinkButton, Badge, EmptyState } from "@/components/ui";
import Link from "next/link";

export default async function LeasesPage() {
  const leases = await prisma.lease.findMany({
    orderBy: { startDate: "desc" },
    include: {
      unit: { include: { projectEntity: true } },
      tenants: { include: { tenant: true } },
    },
  });

  const isActive = (endDate: Date | null) => !endDate || endDate > new Date();

  return (
    <div>
      <PageHeader
        title="Leases"
        action={<LinkButton href="/leases/new">+ New lease</LinkButton>}
      />
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
                  {l.unit.unitType}
                </Link>
              </Td>
              <Td>{l.tenants.map((t) => t.tenant.name).join(", ") || "—"}</Td>
              <Td>${l.rentAmount.toString()}</Td>
              <Td>{l.startDate.toLocaleDateString()}</Td>
              <Td>
                {isActive(l.endDate) ? (
                  <Badge tone="green">Active</Badge>
                ) : (
                  <Badge tone="neutral">Ended</Badge>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {leases.length === 0 && <EmptyState>No leases yet.</EmptyState>}
    </div>
  );
}
