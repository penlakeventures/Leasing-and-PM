import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { TenantForm } from "@/components/tenant-form";
import { createTenant } from "@/lib/actions/tenants";

export default async function NewTenantPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; leadId?: string }>;
}) {
  const { error, leadId } = await searchParams;

  // Opened via a lead's "Create lease from this lead" shortcut — prefill
  // from what's already on file instead of re-typing it.
  const lead = leadId
    ? await prisma.lead.findUnique({ where: { id: leadId } })
    : null;

  return (
    <div>
      <PageHeader title={lead ? `New tenant — from ${lead.contactName ?? "lead"}` : "New tenant"} />
      <TenantForm
        action={createTenant}
        error={error}
        leadId={leadId}
        defaultValues={
          lead
            ? {
                name: lead.contactName ?? "",
                phone: lead.contactPhone,
                email: lead.contactEmail,
                emergencyContactName: null,
                emergencyContactPhone: null,
              }
            : undefined
        }
      />
    </div>
  );
}
