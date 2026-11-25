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
import { resolveTicket } from "@/lib/actions/tickets";
import Link from "next/link";

const statusTone: Record<string, "neutral" | "green" | "amber" | "red" | "blue"> = {
  NEW: "blue",
  ASSIGNED: "amber",
  IN_PROGRESS: "amber",
  RESOLVED: "green",
};

const priorityTone: Record<string, "neutral" | "green" | "amber" | "red" | "blue"> = {
  LOW: "neutral",
  MEDIUM: "blue",
  HIGH: "amber",
  URGENT: "red",
};

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

  const [unit, projects, rentRecommendations, tickets] = await Promise.all([
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
    // Every ticket this unit has ever had, open or resolved — once a
    // ticket is marked complete it flushes out of the Maintenance tab's
    // default view but stays here as the unit's own permanent record.
    prisma.maintenanceTicket.findMany({
      where: { unitId: id },
      orderBy: { createdAt: "desc" },
      include: { vendor: true },
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

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">
            Maintenance history
          </h2>
          <Link
            href={`/tickets/new?unitId=${unit.id}`}
            className="text-sm text-neutral-900 underline"
          >
            + New ticket
          </Link>
        </div>
        {tickets.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Description</Th>
                <Th>Priority</Th>
                <Th>Status</Th>
                <Th>Vendor</Th>
                <Th>Cost</Th>
                <Th>Opened</Th>
                <Th>Resolved</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-neutral-50">
                  <Td>
                    <Link href={`/tickets/${t.id}`} className="underline">
                      {t.description.slice(0, 60)}
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={priorityTone[t.priority]}>{t.priority}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={statusTone[t.status]}>{t.status.replace("_", " ")}</Badge>
                  </Td>
                  <Td>{t.vendor?.name ?? "—"}</Td>
                  <Td>{t.cost ? `$${t.cost.toString()}` : "—"}</Td>
                  <Td>{t.createdAt.toLocaleDateString()}</Td>
                  <Td>{t.resolvedAt?.toLocaleDateString() ?? "—"}</Td>
                  <Td>
                    {t.status !== "RESOLVED" && (
                      <form action={resolveTicket.bind(null, t.id)}>
                        <Button type="submit" variant="secondary">
                          Mark complete
                        </Button>
                      </form>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Card>
            <p className="text-sm text-neutral-500">No maintenance tickets logged for this unit yet.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
