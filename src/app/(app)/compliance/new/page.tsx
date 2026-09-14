import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Field, Input, Select, Button, LinkButton } from "@/components/ui";
import { createComplianceRecord } from "@/lib/actions/compliance";

export default async function NewComplianceRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const projects = await prisma.projectEntity.findMany({
    orderBy: { internalName: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="New compliance record"
        description="Snapshots current affordable-unit rents for the project — the CMHC annual reporting requirement."
      />
      <Card>
        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <form action={createComplianceRecord} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Project" htmlFor="projectEntityId">
              <Select id="projectEntityId" name="projectEntityId" required>
                <option value="">Select a project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.internalName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Year" htmlFor="year">
              <Input
                id="year"
                name="year"
                type="number"
                required
                defaultValue={new Date().getFullYear()}
              />
            </Field>
            <Field label="Submitted date" htmlFor="submittedDate" hint="Optional — set once filed">
              <Input id="submittedDate" name="submittedDate" type="date" />
            </Field>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit">Create snapshot</Button>
            <LinkButton href="/compliance" variant="secondary">
              Cancel
            </LinkButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
