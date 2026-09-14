import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PageHeader, Button, Table, Th, Td } from "@/components/ui";
import { ProjectForm } from "@/components/project-form";
import { updateProject, deleteProject } from "@/lib/actions/projects";
import Link from "next/link";

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
  const deleteWithId = deleteProject.bind(null, id);

  return (
    <div className="space-y-8">
      <PageHeader title={project.internalName} />
      <ProjectForm action={updateWithId} defaultValues={project} error={error} />

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">
            Units ({project.units.length})
          </h2>
          <Link
            href={`/units/new?projectEntityId=${project.id}`}
            className="text-sm text-neutral-900 underline"
          >
            + Add unit
          </Link>
        </div>
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

      <form action={deleteWithId}>
        <Button type="submit" variant="danger">
          Delete project
        </Button>
      </form>
    </div>
  );
}
