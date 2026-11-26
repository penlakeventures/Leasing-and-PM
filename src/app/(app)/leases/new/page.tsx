import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { LeaseForm } from "@/components/lease-form";
import { createLease, createLeaseRenewalAndSend } from "@/lib/actions/leases";

export default async function NewLeasePage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    unitId?: string;
    renewFromLeaseId?: string;
  }>;
}) {
  const { error, unitId, renewFromLeaseId } = await searchParams;
  const units = await prisma.unit.findMany({
    orderBy: { projectEntity: { displayOrder: "asc" } },
    include: { projectEntity: true },
  });

  // Prefilled from the predecessor lease when opened via the Renewals
  // page's "Create renewal" shortcut: same unit and tenant(s), same rent
  // and pets, and a suggested next term the same length as the one
  // ending — all still editable before saving, same review-before-it's-
  // real pattern as everywhere else in this app. signedDate and
  // documentLink deliberately aren't carried over — this is a fresh
  // document that hasn't been signed yet.
  let defaultValues:
    | Parameters<typeof LeaseForm>[0]["defaultValues"]
    | undefined;
  let existingTenants: { id: string; name: string }[] | undefined;
  let renewalOf: { leaseId: string; unitLabel: string } | undefined;

  if (renewFromLeaseId) {
    const predecessor = await prisma.lease.findUnique({
      where: { id: renewFromLeaseId },
      include: { tenants: { include: { tenant: true } }, unit: { include: { projectEntity: true } } },
    });
    if (predecessor && predecessor.endDate) {
      const termMs = predecessor.endDate.getTime() - predecessor.startDate.getTime();
      const newStart = new Date(predecessor.endDate.getTime() + 24 * 60 * 60 * 1000);
      const newEnd = new Date(newStart.getTime() + termMs);
      defaultValues = {
        unitId: predecessor.unitId,
        startDate: newStart,
        endDate: newEnd,
        periodic: false,
        rentAmount: predecessor.rentAmount,
        lastRentIncreaseDate: null,
        firstMonthRentPrepaid: null,
        lastMonthRentPrepaid: null,
        pets: predecessor.pets,
        signedDate: null,
        notes: null,
      };
      existingTenants = predecessor.tenants.map((lt) => ({ id: lt.tenant.id, name: lt.tenant.name }));
      renewalOf = {
        leaseId: predecessor.id,
        unitLabel: `${predecessor.unit.projectEntity.internalName} — Unit ${predecessor.unit.unitNumber}`,
      };
    }
  }

  return (
    <div>
      <PageHeader title={renewalOf ? "Renew lease" : "New lease"} />
      <LeaseForm
        action={renewalOf ? createLeaseRenewalAndSend : createLease}
        units={units}
        existingTenants={existingTenants}
        defaultValues={defaultValues}
        defaultUnitId={unitId}
        renewalOf={renewalOf}
        error={error}
      />
    </div>
  );
}
