import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PageHeader, Button, Card } from "@/components/ui";
import { TicketForm } from "@/components/ticket-form";
import { updateTicket, deleteTicket, notifyVendor } from "@/lib/actions/tickets";
import Link from "next/link";

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
  const deleteWithId = deleteTicket.bind(null, id);
  const notifyVendorWithId = notifyVendor.bind(null, id);

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

      {ticket.vendor && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">Vendor notification</h2>
          {ticket.vendorNotifiedAt ? (
            <p className="text-sm text-neutral-700">
              Notified{" "}
              <Link href={`/vendors/${ticket.vendor.id}`} className="underline">
                {ticket.vendor.name}
              </Link>{" "}
              by text on {ticket.vendorNotifiedAt.toLocaleString()}.
            </p>
          ) : (
            <p className="mb-3 text-sm text-neutral-700">
              {ticket.vendor.name} hasn&apos;t been texted about this ticket yet.
            </p>
          )}
          <form action={notifyVendorWithId}>
            <Button type="submit" variant="secondary">
              {ticket.vendorNotifiedAt ? "Notify again" : "Notify vendor"}
            </Button>
          </form>
        </Card>
      )}

      <form action={deleteWithId}>
        <Button type="submit" variant="danger">
          Delete ticket
        </Button>
      </form>
    </div>
  );
}
