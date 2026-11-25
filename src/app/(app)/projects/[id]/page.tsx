import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PageHeader, Table, Th, Td } from "@/components/ui";
import { ProjectForm } from "@/components/project-form";
import { updateProject } from "@/lib/actions/projects";
import Link from "next/link";

// This app's seven real projects are fully built out and the owner's
// decision is that the unit mix within each never changes — so there's
// deliberately no "+ Add unit" entry point here (or anywhere else; see
// createUnit's removal in lib/actions/units.ts) to add one by accident.

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const project = await prisma.projectEntity.findUnique({
    where: { id },
    include: { units: { orderBy: { unitNumber: "asc" } } },
  });
  if (!project) notFound();

  const updateWithId = updateProject.bind(null, id);

  return (
    <div className="space-y-8">
      <PageHeader title={project.internalName} />
      <ProjectForm action={updateWithId} defaultValues={project} error={error} />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">
          Units ({project.units.length})
        </h2>
        <Table>
          <thead>
            <tr>
              <Th>Unit #</Th>
              <Th>Bedrooms</Th>
              <Th>Designation</Th>
              <Th>Current rent</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {project.units.map((u) => (
              <tr key={u.id} className="hover:bg-neutral-50">
                <Td>
                  <Link href={`/units/${u.id}`} className="underline">
                    {u.unitNumber}
                  </Link>
                </Td>
                <Td>{u.bedrooms}</Td>
                <Td>{u.cmhcDesignation}</Td>
                <Td>${u.currentRent.toString()}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
