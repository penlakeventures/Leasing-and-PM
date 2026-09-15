import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PageHeader, Button } from "@/components/ui";
import { LeadForm } from "@/components/lead-form";
import { updateLead, deleteLead } from "@/lib/actions/leads";

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const [lead, units] = await Promise.all([
    prisma.lead.findUnique({ where: { id } }),
    prisma.unit.findMany({
      orderBy: { projectEntity: { displayOrder: "asc" } },
      include: { projectEntity: true },
    }),
  ]);
  if (!lead) notFound();

  const updateWithId = updateLead.bind(null, id);
  const deleteWithId = deleteLead.bind(null, id);

  return (
    <div className="space-y-8">
      <PageHeader title={lead.contactName ?? "Lead"} />
      <LeadForm action={updateWithId} units={units} defaultValues={lead} error={error} />
      <form action={deleteWithId}>
        <Button type="submit" variant="danger">
          Delete lead
        </Button>
      </form>
    </div>
  );
}
