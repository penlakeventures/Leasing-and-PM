import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PageHeader, Button, Table, Th, Td } from "@/components/ui";
import { TenantForm } from "@/components/tenant-form";
import { updateTenant, deleteTenant } from "@/lib/actions/tenants";
import Link from "next/link";

export default async function TenantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      leases: { include: { lease: { include: { unit: { include: { projectEntity: true } } } } } },
    },
  });
  if (!tenant) notFound();

  const updateWithId = updateTenant.bind(null, id);
  const deleteWithId = deleteTenant.bind(null, id);

  return (
    <div className="space-y-8">
      <PageHeader title={tenant.name} />
      <TenantForm action={updateWithId} defaultValues={tenant} error={error} />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">Leases</h2>
        <Table>
          <thead>
            <tr>
              <Th>Project</Th>
              <Th>Unit</Th>
              <Th>Start</Th>
              <Th>Rent</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {tenant.leases.map(({ lease }) => (
              <tr key={lease.id} className="hover:bg-neutral-50">
                <Td>{lease.unit.projectEntity.internalName}</Td>
                <Td>
                  <Link href={`/leases/${lease.id}`} className="underline">
                    Unit {lease.unit.unitNumber}
                  </Link>
                </Td>
                <Td>{lease.startDate.toLocaleDateString()}</Td>
                <Td>${lease.rentAmount.toString()}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <form action={deleteWithId}>
        <Button type="submit" variant="danger">
          Delete tenant
        </Button>
      </form>
    </div>
  );
}
