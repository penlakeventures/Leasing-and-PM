import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { LeaseForm } from "@/components/lease-form";
import { createLease } from "@/lib/actions/leases";

export default async function NewLeasePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; unitId?: string }>;
}) {
  const { error, unitId } = await searchParams;
  const [units, tenants] = await Promise.all([
    prisma.unit.findMany({
      orderBy: { projectEntity: { internalName: "asc" } },
      include: { projectEntity: true },
    }),
    prisma.tenant.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="New lease" />
      <LeaseForm
        action={createLease}
        units={units}
        tenants={tenants}
        defaultUnitId={unitId}
        error={error}
      />
    </div>
  );
}
