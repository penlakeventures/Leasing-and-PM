import { prisma } from "@/lib/prisma";
import { PageHeader, Table, Th, Td, LinkButton, EmptyState } from "@/components/ui";
import Link from "next/link";

export default async function TenantsPage() {
  const tenants = await prisma.tenant.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <PageHeader
        title="Tenants"
        action={<LinkButton href="/tenants/new">+ New tenant</LinkButton>}
      />
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Phone</Th>
            <Th>Email</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {tenants.map((t) => (
            <tr key={t.id} className="hover:bg-neutral-50">
              <Td>
                <Link href={`/tenants/${t.id}`} className="font-medium text-neutral-900 underline">
                  {t.name}
                </Link>
              </Td>
              <Td>{t.phone ?? "—"}</Td>
              <Td>{t.email ?? "—"}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {tenants.length === 0 && <EmptyState>No tenants yet.</EmptyState>}
    </div>
  );
}
