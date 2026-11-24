import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { PageHeader, Card, Button, Table, Th, Td, Badge } from "@/components/ui";
import { UnitForm } from "@/components/unit-form";
import { RentRecommendationForm } from "@/components/rent-recommendation-form";
import { updateUnit } from "@/lib/actions/units";
import {
  createRentRecommendation,
  decideRentRecommendation,
} from "@/lib/actions/rent-recommendations";
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
  const session = await auth();
  const isOwner =
    (session?.user as { role?: string } | undefined)?.role === "owner";

  const [unit, projects, rentRecommendations] = await Promise.all([
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
    prisma.rentRecommendation.findMany({
      where: { unitId: id },
      orderBy: { createdAt: "desc" },
      include: { proposedBy: true, decidedBy: true },
    }),
  ]);
  if (!unit) notFound();

  const updateWithId = updateUnit.bind(null, id);
  const createRecommendationWithId = createRentRecommendation.bind(null, id);

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
        lockCurrentRent={!isOwner}
      />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">
          Rent recommendations
        </h2>
        <div className="space-y-4">
          <RentRecommendationForm action={createRecommendationWithId} />
          {rentRecommendations.length > 0 && (
            <Card>
              <ul className="space-y-4 text-sm">
                {rentRecommendations.map((r) => (
                  <li
                    key={r.id}
                    className="border-b border-neutral-100 pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between">
                      <p>
                        <span className="font-medium">
                          ${r.currentRent.toString()} → ${r.proposedRent.toString()}
                        </span>{" "}
                        <span className="text-neutral-500">
                          recommended by {r.proposedBy.name}
                        </span>
                      </p>
                      <Badge
                        tone={
                          r.decision === "APPROVED"
                            ? "green"
                            : r.decision === "DECLINED"
                              ? "red"
                              : "amber"
                        }
                      >
                        {r.decision === "PENDING" ? "Awaiting approval" : r.decision}
                      </Badge>
                    </div>
                    <p className="mt-1 text-neutral-600">{r.reasoning}</p>
                    {r.decidedBy && (
                      <p className="mt-1 text-xs text-neutral-500">
                        {r.decision === "APPROVED" ? "Approved" : "Declined"} by{" "}
                        {r.decidedBy.name}
                        {r.decisionNote ? ` — "${r.decisionNote}"` : ""}
                      </p>
                    )}
                    {r.decision === "PENDING" && isOwner && (
                      <form
                        action={decideRentRecommendation.bind(null, r.id)}
                        className="mt-3 flex flex-wrap items-center gap-2"
                      >
                        <input
                          type="text"
                          name="decisionNote"
                          placeholder="Optional note"
                          className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
                        />
                        <Button type="submit" name="decision" value="APPROVED">
                          Approve
                        </Button>
                        <Button
                          type="submit"
                          name="decision"
                          value="DECLINED"
                          variant="secondary"
                        >
                          Decline
                        </Button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

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
    </div>
  );
}
