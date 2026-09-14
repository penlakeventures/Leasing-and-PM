import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { LeadForm } from "@/components/lead-form";
import { createLead } from "@/lib/actions/leads";

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const units = await prisma.unit.findMany({
    orderBy: { projectEntity: { internalName: "asc" } },
    include: { projectEntity: true },
  });

  return (
    <div>
      <PageHeader title="New lead" />
      <LeadForm action={createLead} units={units} error={error} />
    </div>
  );
}
