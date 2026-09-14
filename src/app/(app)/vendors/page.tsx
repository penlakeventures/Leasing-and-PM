import { prisma } from "@/lib/prisma";
import { PageHeader, Table, Th, Td, LinkButton, EmptyState } from "@/components/ui";
import Link from "next/link";

export default async function VendorsPage() {
  const vendors = await prisma.vendor.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <PageHeader
        title="Vendors"
        action={<LinkButton href="/vendors/new">+ New vendor</LinkButton>}
      />
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Type</Th>
            <Th>Phone</Th>
            <Th>Email</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {vendors.map((v) => (
            <tr key={v.id} className="hover:bg-neutral-50">
              <Td>
                <Link href={`/vendors/${v.id}`} className="font-medium text-neutral-900 underline">
                  {v.name}
                </Link>
              </Td>
              <Td>{v.type}</Td>
              <Td>{v.contactPhone ?? "—"}</Td>
              <Td>{v.contactEmail ?? "—"}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {vendors.length === 0 && <EmptyState>No vendors yet.</EmptyState>}
    </div>
  );
}
