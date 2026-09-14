import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PageHeader, Button } from "@/components/ui";
import { VendorForm } from "@/components/vendor-form";
import { updateVendor, deleteVendor } from "@/lib/actions/vendors";

export default async function VendorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const vendor = await prisma.vendor.findUnique({ where: { id } });
  if (!vendor) notFound();

  const updateWithId = updateVendor.bind(null, id);
  const deleteWithId = deleteVendor.bind(null, id);

  return (
    <div className="space-y-8">
      <PageHeader title={vendor.name} />
      <VendorForm action={updateWithId} defaultValues={vendor} error={error} />
      <form action={deleteWithId}>
        <Button type="submit" variant="danger">
          Delete vendor
        </Button>
      </form>
    </div>
  );
}
