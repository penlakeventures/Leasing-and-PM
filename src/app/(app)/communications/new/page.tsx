import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Field, Input, Select, Textarea, Button, LinkButton } from "@/components/ui";
import { createCommunication } from "@/lib/actions/communications";

export default async function NewCommunicationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; tenantId?: string; leadId?: string }>;
}) {
  const { error, tenantId, leadId } = await searchParams;
  const [tenants, leads, users] = await Promise.all([
    prisma.tenant.findMany({ orderBy: { name: "asc" } }),
    prisma.lead.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Log a communication" />
      <Card>
        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <form action={createCommunication} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tenant" htmlFor="tenantId" hint="Set this or Lead, not both">
              <Select id="tenantId" name="tenantId" defaultValue={tenantId ?? ""}>
                <option value="">—</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Lead" htmlFor="leadId">
              <Select id="leadId" name="leadId" defaultValue={leadId ?? ""}>
                <option value="">—</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.contactName ?? l.contactEmail ?? l.id}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Channel" htmlFor="channel">
              <Select id="channel" name="channel" defaultValue="TEXT">
                <option value="TEXT">Text</option>
                <option value="EMAIL">Email</option>
                <option value="CALL">Call</option>
              </Select>
            </Field>
            <Field label="Direction" htmlFor="direction">
              <Select id="direction" name="direction" defaultValue="INBOUND">
                <option value="INBOUND">Inbound</option>
                <option value="OUTBOUND">Outbound</option>
              </Select>
            </Field>
            <Field label="Timestamp" htmlFor="timestamp">
              <Input id="timestamp" name="timestamp" type="datetime-local" />
            </Field>
            <Field label="Handled by" htmlFor="handledById" hint="Blank = automated/agent">
              <Select id="handledById" name="handledById" defaultValue="">
                <option value="">Automated / agent</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Summary" htmlFor="summary">
            <Textarea id="summary" name="summary" required />
          </Field>
          <div className="flex gap-2 pt-2">
            <Button type="submit">Save</Button>
            <LinkButton href="/communications" variant="secondary">
              Cancel
            </LinkButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
