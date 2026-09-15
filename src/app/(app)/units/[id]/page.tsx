import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PageHeader, Button, Table, Th, Td } from "@/components/ui";
import { UnitForm } from "@/components/unit-form";
import { updateUnit, deleteUnit } from "@/lib/actions/units";
import Link from "next/link";

export default async function UnitDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const [unit, projects] = await Promise.all([
    prisma.unit.findUnique({
      where: { id },
      include: {
        leases: {
          orderBy: { startDate: "desc" },
          include: { tenants: { include: { tenant: true } } },
        },
        projectEntity: true,
      },
    }),
    prisma.projectEntity.findMany({
      orderBy: { displayOrder: "asc" },
      select: { id: true, internalName: true },
    }),
  ]);
  if (!unit) notFound();

  const updateWithId = updateUnit.bind(null, id);
  const deleteWithId = deleteUnit.bind(null, id);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${unit.projectEntity.internalName} — Unit ${unit.unitNumber}`}
        description={`${unit.bedrooms} bd`}
      />
      <UnitForm
        action={updateWithId}
        projects={projects}
        defaultValues={unit}
        error={error}
      />

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">
            Lease history
          </h2>
          <Link
            href={`/leases/new?unitId=${unit.id}`}
            className="text-sm text-neutral-900 underline"
          >
            + New lease
          </Link>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Start</Th>
              <Th>End</Th>
              <Th>Rent</Th>
              <Th>Tenant(s)</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {unit.leases.map((l) => (
              <tr key={l.id} className="hover:bg-neutral-50">
                <Td>
                  <Link href={`/leases/${l.id}`} className="underline">
                    {l.startDate.toLocaleDateString()}
                  </Link>
                </Td>
                <Td>{l.periodic ? "Periodic" : l.endDate?.toLocaleDateString() ?? "—"}</Td>
                <Td>${l.rentAmount.toString()}</Td>
                <Td>
                  {l.tenants.map((t) => t.tenant.name).join(", ") || "—"}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <form action={deleteWithId}>
        <Button type="submit" variant="danger">
          Delete unit
        </Button>
      </form>
    </div>
  );
}
