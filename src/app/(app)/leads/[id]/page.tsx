import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PageHeader, Button } from "@/components/ui";
import { LeadForm } from "@/components/lead-form";
import { ScreeningPanel } from "@/components/screening-panel";
import { TourPanel } from "@/components/tour-panel";
import { updateLead, deleteLead } from "@/lib/actions/leads";
import { getActiveConnection } from "@/lib/google-calendar";

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const [lead, units, staff, calendarConnection] = await Promise.all([
    prisma.lead.findUnique({
      where: { id },
      include: {
        screening: { include: { decidedBy: true } },
        tourStaff: true,
      },
    }),
    prisma.unit.findMany({
      orderBy: { projectEntity: { displayOrder: "asc" } },
      include: { projectEntity: true },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    getActiveConnection(),
  ]);
  if (!lead) notFound();

  const updateWithId = updateLead.bind(null, id);
  const deleteWithId = deleteLead.bind(null, id);

  return (
    <div className="space-y-8">
      <PageHeader title={lead.contactName ?? "Lead"} />
      <LeadForm action={updateWithId} units={units} defaultValues={lead} error={error} />
      <TourPanel
        leadId={id}
        tour={{ tourAt: lead.tourAt, tourStaff: lead.tourStaff }}
        staff={staff}
        calendarConnected={!!calendarConnection}
      />
      <ScreeningPanel leadId={id} screening={lead.screening} />
      <form action={deleteWithId}>
        <Button type="submit" variant="danger">
          Delete lead
        </Button>
      </form>
    </div>
  );
}
