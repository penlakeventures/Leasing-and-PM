import { PageHeader } from "@/components/ui";
import { TenantForm } from "@/components/tenant-form";
import { createTenant } from "@/lib/actions/tenants";

export default async function NewTenantPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div>
      <PageHeader title="New tenant" />
      <TenantForm action={createTenant} error={error} />
    </div>
  );
}
