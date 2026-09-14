import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { UnitForm } from "@/components/unit-form";
import { createUnit } from "@/lib/actions/units";

export default async function NewUnitPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; projectEntityId?: string }>;
}) {
  const { error, projectEntityId } = await searchParams;
  const projects = await prisma.projectEntity.findMany({
    orderBy: { internalName: "asc" },
    select: { id: true, internalName: true },
  });

  return (
    <div>
      <PageHeader title="New unit" />
      <UnitForm
        action={createUnit}
        projects={projects}
        defaultProjectId={projectEntityId}
        error={error}
      />
    </div>
  );
}
