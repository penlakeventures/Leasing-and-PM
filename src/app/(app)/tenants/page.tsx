import { prisma } from "@/lib/prisma";
import { Table, Th, Td, LinkButton, Badge, EmptyState } from "@/components/ui";
import { EntitySearch } from "@/components/entity-search";
import { pickActiveLease } from "@/lib/rules";
import Link from "next/link";

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const { all } = await searchParams;
  const showAll = all === "1";

  const allTenants = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    include: {
      leases: {
        include: { lease: { include: { unit: { include: { projectEntity: true } } } } },
      },
    },
  });

  // A tenant with no currently-active lease is a past tenant. Same pattern
  // as the Leases list: past records pile up forever, so default to who's
  // actually here today, with a link back to the full roster.
  const withActiveLease = allTenants.map((t) => ({
    tenant: t,
    activeLease: pickActiveLease(t.leases.map((lt) => lt.lease)),
  }));
  const tenants = showAll
    ? withActiveLease
    : withActiveLease.filter((t) => t.activeLease);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={showAll ? "/tenants" : "/tenants?all=1"}
          className="text-sm text-neutral-600 underline"
        >
          {showAll ? "Show current only" : "Show all tenants (including past)"}
        </Link>
        <LinkButton href="/tenants/new">+ New tenant</LinkButton>
      </div>
      <EntitySearch
        items={allTenants.map((t) => ({ id: t.id, label: t.name }))}
        basePath="/tenants"
        placeholder="Search tenants by name…"
      />
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Project</Th>
            <Th>Unit #</Th>
            <Th>Phone</Th>
            <Th>Email</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {tenants.map(({ tenant: t, activeLease }) => {
            // No active lease — fall back to whichever lease started most
            // recently, so a past tenant still shows where they used to
            // live instead of blank dashes.
            const mostRecentLease = activeLease
              ? null
              : [...t.leases]
                  .map((lt) => lt.lease)
                  .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0] ?? null;
            const displayLease = activeLease ?? mostRecentLease;
            return (
              <tr key={t.id} className="hover:bg-neutral-50">
                <Td>
                  <Link href={`/tenants/${t.id}`} className="font-medium text-neutral-900 underline">
                    {t.name}
                  </Link>
                </Td>
                <Td>{displayLease?.unit.projectEntity.internalName ?? "—"}</Td>
                <Td>{displayLease?.unit.unitNumber ?? "—"}</Td>
                <Td>{t.phone ?? "—"}</Td>
                <Td>{t.email ?? "—"}</Td>
                <Td>
                  {activeLease ? (
                    <Badge tone="green">Active</Badge>
                  ) : (
                    <Badge tone="red">Past tenant</Badge>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {tenants.length === 0 && (
        <EmptyState>{showAll ? "No tenants yet." : "No current tenants right now."}</EmptyState>
      )}
    </div>
  );
}
