import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PageHeader, Button } from "@/components/ui";
import { LeaseForm } from "@/components/lease-form";
import { DepositPanel } from "@/components/deposit-panel";
import { updateLease, deleteLease } from "@/lib/actions/leases";

export default async function LeaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const [lease, units, tenants] = await Promise.all([
    prisma.lease.findUnique({
      where: { id },
      include: {
        tenants: true,
        securityDeposit: { include: { deductions: true } },
      },
    }),
    prisma.unit.findMany({
      orderBy: { projectEntity: { displayOrder: "asc" } },
      include: { projectEntity: true },
    }),
    prisma.tenant.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!lease) notFound();

  const updateWithId = updateLease.bind(null, id);
  const deleteWithId = deleteLease.bind(null, id);

  return (
    <div className="space-y-8">
      <PageHeader title="Lease" />

      {/* Both the lease form and the deposit panel below can produce this
          error via a redirect — shown once here since either can fail. */}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <LeaseForm
        action={updateWithId}
        units={units}
        tenants={tenants}
        defaultValues={{
          ...lease,
          tenantIds: lease.tenants.map((t) => t.tenantId),
        }}
      />

      <DepositPanel
        leaseId={lease.id}
        deposit={lease.securityDeposit}
        monthlyRent={Number(lease.rentAmount)}
        tenancyEndDate={lease.endDate}
      />

      <form action={deleteWithId}>
        <Button type="submit" variant="danger">
          Delete lease
        </Button>
      </form>
    </div>
  );
}
