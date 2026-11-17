import { Fragment } from "react";
import { prisma } from "@/lib/prisma";
import { Table, Th, Td, LinkButton, Badge, EmptyState } from "@/components/ui";
import { pickActiveLease, isDepositOverdue, isRentOverdue } from "@/lib/rules";
import Link from "next/link";

const COLUMN_COUNT = 7;

export default async function UnitsPage() {
  const units = await prisma.unit.findMany({
    orderBy: [{ projectEntity: { displayOrder: "asc" } }, { unitNumber: "asc" }],
    include: {
      projectEntity: true,
      leases: {
        include: {
          tenants: { include: { tenant: true } },
          securityDeposit: true,
          // Only the unpaid ones — isRentOverdue still needs paidDate on
          // each row it checks, but there's no point fetching rows that
          // are already settled just to immediately filter them out below.
          rentPayments: { where: { paidDate: null } },
        },
      },
    },
  });

  // Units are already sorted by project display order above, so grouping
  // is just folding consecutive same-project rows together — not a
  // re-sort — to show each project's name once as a heading instead of
  // repeating it on every unit's row.
  const groups: { projectName: string; units: typeof units }[] = [];
  for (const u of units) {
    const projectName = u.projectEntity.internalName;
    const lastGroup = groups[groups.length - 1];
    if (lastGroup?.projectName === projectName) {
      lastGroup.units.push(u);
    } else {
      groups.push({ projectName, units: [u] });
    }
  }

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <LinkButton href="/units/new">+ New unit</LinkButton>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Unit #</Th>
            <Th>Bedrooms</Th>
            <Th>Designation</Th>
            <Th>Current rent</Th>
            <Th>Current tenant</Th>
            <Th>Phone</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {groups.map((group) => (
            <Fragment key={group.projectName}>
              <tr className="bg-neutral-50">
                <td
                  colSpan={COLUMN_COUNT}
                  className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  {group.projectName}
                </td>
              </tr>
              {group.units.map((u) => {
                const activeLease = pickActiveLease(u.leases);
                const tenants = activeLease?.tenants.map((t) => t.tenant) ?? [];
                const depositOverdue = u.leases.some(
                  (l) =>
                    l.securityDeposit &&
                    !l.securityDeposit.dateReturned &&
                    isDepositOverdue({
                      tenancyEndDate: l.endDate,
                      dateReturned: l.securityDeposit.dateReturned,
                    }),
                );
                const rentOverdue = u.leases.some((l) =>
                  l.rentPayments.some((rp) =>
                    isRentOverdue({ period: rp.period, paidDate: rp.paidDate }),
                  ),
                );
                return (
                  <tr key={u.id} className="hover:bg-neutral-50">
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
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {depositOverdue && <Badge tone="red">Deposit overdue</Badge>}
                        {rentOverdue && <Badge tone="red">Rent overdue</Badge>}
                        {!depositOverdue && !rentOverdue && (
                          <span className="text-neutral-400">—</span>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </Table>
      {units.length === 0 && <EmptyState>No units yet.</EmptyState>}
    </div>
  );
}
