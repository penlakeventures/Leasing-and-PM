import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/ui";
import { LeasesGrid, type LeaseRow } from "@/components/leases-grid";
import { unitTypeFromAddress } from "@/lib/unit-type";
import Link from "next/link";

// Modeled on Alina's lease-expiry Excel tracker — the sortable/filterable
// lease roster, not the leasing-decision/notice-deadline tracking this
// page used to show (dropped for now, see git history; the owner's plan
// is to reintegrate that separately later rather than keep it bolted onto
// this page).
export default async function RenewalsPage({
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
    // The grid itself always re-sorts client-side (defaulting to Lease
    // end, same as this), but a defined base order still matters for
    // anything that reads this list without JS, and for a stable first
    // paint before the client takes over.
    orderBy: [
      { unit: { projectEntity: { displayOrder: "asc" } } },
      { unit: { unitNumber: "asc" } },
    ],
    include: {
      unit: { include: { projectEntity: true } },
      tenants: { include: { tenant: true } },
    },
  });

  const rows: LeaseRow[] = leases.map((l) => ({
    id: l.id,
    address: l.unit.unitNumber,
    community: l.unit.projectEntity.internalName,
    type: unitTypeFromAddress(l.unit.unitNumber),
    tenants: l.tenants.map((t) => t.tenant.name).join(", ") || "—",
    rent: Number(l.rentAmount),
    leaseEnd: l.endDate ? l.endDate.toISOString() : null,
    periodic: l.periodic,
    status: !l.endDate || l.endDate > now ? (l.signedDate ? "Active" : "Unsigned") : "Ended",
    notes: l.notes ?? "",
  }));

  return (
    <div>
      <div className="mb-6">
        <Link
          href={showAll ? "/renewals" : "/renewals?all=1"}
          className="text-sm text-neutral-600 underline"
        >
          {showAll ? "Show active only" : "Show all leases (including ended)"}
        </Link>
      </div>
      {rows.length > 0 ? (
        <LeasesGrid rows={rows} />
      ) : (
        <EmptyState>{showAll ? "No leases yet." : "No active leases right now."}</EmptyState>
      )}
    </div>
  );
}
