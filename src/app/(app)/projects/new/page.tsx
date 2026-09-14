import { PageHeader } from "@/components/ui";
import { ProjectForm } from "@/components/project-form";
import { createProject } from "@/lib/actions/projects";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div>
      <PageHeader title="New project" />
      <ProjectForm action={createProject} error={error} />
    </div>
  );
}
