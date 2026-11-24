import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { TicketForm } from "@/components/ticket-form";
import { updateTicket } from "@/lib/actions/tickets";

export default async function TicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const [ticket, units, tenants, vendors] = await Promise.all([
    prisma.maintenanceTicket.findUnique({ where: { id }, include: { vendor: true } }),
    prisma.unit.findMany({
      orderBy: { projectEntity: { displayOrder: "asc" } },
      include: { projectEntity: true },
    }),
    prisma.tenant.findMany({ orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!ticket) notFound();

  const updateWithId = updateTicket.bind(null, id);

  return (
    <div className="space-y-8">
      <PageHeader title="Maintenance ticket" />
      <TicketForm
        action={updateWithId}
        units={units}
        tenants={tenants}
        vendors={vendors}
        defaultValues={ticket}
        error={error}
      />
    </div>
  );
}
