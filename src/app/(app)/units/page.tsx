import { prisma } from "@/lib/prisma";
import { PageHeader, Table, Th, Td, LinkButton, Badge, EmptyState } from "@/components/ui";
import Link from "next/link";

export default async function UnitsPage() {
  const units = await prisma.unit.findMany({
    orderBy: [{ projectEntity: { internalName: "asc" } }, { unitType: "asc" }],
    include: { projectEntity: true },
  });

  return (
    <div>
      <PageHeader
        title="Units"
        description="Towns, suites, and the barn — across all 7 projects."
        action={<LinkButton href="/units/new">+ New unit</LinkButton>}
      />
      <Table>
        <thead>
          <tr>
            <Th>Project</Th>
            <Th>Type</Th>
            <Th>Bedrooms</Th>
            <Th>Designation</Th>
            <Th>Current rent</Th>
            <Th>Tenancy</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {units.map((u) => (
            <tr key={u.id} className="hover:bg-neutral-50">
              <Td>{u.projectEntity.internalName}</Td>
              <Td>
                <Link href={`/units/${u.id}`} className="underline">
                  {u.unitType}
                </Link>
              </Td>
              <Td>{u.bedrooms}</Td>
              <Td>
                <Badge tone={u.cmhcDesignation === "AFFORDABLE" ? "blue" : "neutral"}>
                  {u.cmhcDesignation}
                </Badge>
              </Td>
              <Td>${u.currentRent.toString()}</Td>
              <Td>{u.tenancyType}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {units.length === 0 && <EmptyState>No units yet.</EmptyState>}
    </div>
  );
}
