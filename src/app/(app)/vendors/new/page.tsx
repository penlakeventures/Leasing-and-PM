import { PageHeader } from "@/components/ui";
import { VendorForm } from "@/components/vendor-form";
import { createVendor } from "@/lib/actions/vendors";

export default async function NewVendorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div>
      <PageHeader title="New vendor" />
      <VendorForm action={createVendor} error={error} />
    </div>
  );
}
