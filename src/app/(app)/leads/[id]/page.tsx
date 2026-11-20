import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PageHeader, Button, LinkButton } from "@/components/ui";
import { LeadForm } from "@/components/lead-form";
import { ScreeningPanel } from "@/components/screening-panel";
import { TourPanel } from "@/components/tour-panel";
import { MessagePanel } from "@/components/message-panel";
import { updateLead, deleteLead, generateLeadReplyDraft } from "@/lib/actions/leads";
import { sendLeadText } from "@/lib/actions/sms";
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
        communications: {
          where: { channel: "TEXT" },
          orderBy: { timestamp: "asc" },
        },
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
  const sendTextWithId = sendLeadText.bind(null, id);
  const draftReplyWithId = generateLeadReplyDraft.bind(null, id);

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
      <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-neutral-600">
          Ready to move forward? This creates a new tenant record from this
          lead&apos;s contact info, then takes you straight to creating the
          lease with that tenant (and unit, if set) preselected.
        </p>
        <LinkButton href={`/tenants/new?leadId=${id}`}>
          Create lease from this lead
        </LinkButton>
      </div>
      <MessagePanel
        messages={lead.communications}
        phone={lead.contactPhone}
        sendAction={sendTextWithId}
        draftReply={lead.draftReply}
        draftAction={draftReplyWithId}
      />
      <form action={deleteWithId}>
        <Button type="submit" variant="danger">
          Delete lead
        </Button>
      </form>
    </div>
  );
}
