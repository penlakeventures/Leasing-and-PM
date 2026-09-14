import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { TicketForm } from "@/components/ticket-form";
import { createTicket } from "@/lib/actions/tickets";

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; unitId?: string }>;
}) {
  const { error, unitId } = await searchParams;
  const [units, tenants, vendors] = await Promise.all([
    prisma.unit.findMany({
      orderBy: { projectEntity: { internalName: "asc" } },
      include: { projectEntity: true },
    }),
    prisma.tenant.findMany({ orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="New maintenance ticket" />
      <TicketForm
        action={createTicket}
        units={units}
        tenants={tenants}
        vendors={vendors}
        defaultUnitId={unitId}
        error={error}
      />
    </div>
  );
}
