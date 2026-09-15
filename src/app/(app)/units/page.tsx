import { prisma } from "@/lib/prisma";
import { Table, Th, Td, LinkButton, Badge, EmptyState } from "@/components/ui";
import { pickActiveLease } from "@/lib/rules";
import Link from "next/link";

export default async function UnitsPage() {
  const units = await prisma.unit.findMany({
    orderBy: [{ projectEntity: { displayOrder: "asc" } }, { unitNumber: "asc" }],
    include: {
      projectEntity: true,
      leases: { include: { tenants: { include: { tenant: true } } } },
    },
  });

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <LinkButton href="/units/new">+ New unit</LinkButton>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Project</Th>
            <Th>Unit #</Th>
            <Th>Bedrooms</Th>
            <Th>Designation</Th>
            <Th>Current rent</Th>
            <Th>Current tenant</Th>
            <Th>Phone</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {units.map((u) => {
            const activeLease = pickActiveLease(u.leases);
            const tenants = activeLease?.tenants.map((t) => t.tenant) ?? [];
            return (
              <tr key={u.id} className="hover:bg-neutral-50">
                <Td>{u.projectEntity.internalName}</Td>
                <Td>
                  <Link href={`/units/${u.id}`} className="underline">
                    {u.unitNumber}
                  </Link>
                </Td>
                <Td>{u.bedrooms}</Td>
                <Td>
                  <Badge tone={u.cmhcDesignation === "AFFORDABLE" ? "blue" : "neutral"}>
                    {u.cmhcDesignation}
                  </Badge>
                </Td>
                <Td>${u.currentRent.toString()}</Td>
                <Td>
                  {tenants.length > 0 ? (
                    tenants.map((t) => t.name).join(", ")
                  ) : (
                    <span className="text-neutral-400">Vacant</span>
                  )}
                </Td>
                <Td>
                  {tenants
                    .map((t) => t.phone)
                    .filter(Boolean)
                    .join(", ") || "—"}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {units.length === 0 && <EmptyState>No units yet.</EmptyState>}
    </div>
  );
}
