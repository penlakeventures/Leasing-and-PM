import { prisma } from "@/lib/prisma";
import { PageHeader, Table, Th, Td, LinkButton, Badge, EmptyState } from "@/components/ui";
import Link from "next/link";

const statusTone: Record<string, "neutral" | "green" | "amber" | "red" | "blue"> = {
  NEW: "blue",
  CONTACTED: "blue",
  TOURING: "amber",
  APPLIED: "amber",
  SCREENED: "amber",
  LEASED: "green",
  LOST: "neutral",
};

export default async function LeadsPage() {
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    include: { unit: { include: { projectEntity: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Leads"
        description="RentFaster and Facebook Marketplace inquiries."
        action={<LinkButton href="/leads/new">+ New lead</LinkButton>}
      />
      <Table>
        <thead>
          <tr>
            <Th>Contact</Th>
            <Th>Source</Th>
            <Th>Unit / interest</Th>
            <Th>Status</Th>
            <Th>Created</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {leads.map((l) => (
            <tr key={l.id} className="hover:bg-neutral-50">
              <Td>
                <Link href={`/leads/${l.id}`} className="font-medium text-neutral-900 underline">
                  {l.contactName ?? l.contactEmail ?? l.contactPhone ?? "Unknown"}
                </Link>
              </Td>
              <Td>{l.source.replace("_", " ")}</Td>
              <Td>
                {l.unit
                  ? `${l.unit.projectEntity.internalName} — ${l.unit.unitType}`
                  : "General"}
              </Td>
              <Td>
                <Badge tone={statusTone[l.status]}>{l.status}</Badge>
              </Td>
              <Td>{l.createdAt.toLocaleDateString()}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {leads.length === 0 && <EmptyState>No leads yet.</EmptyState>}
    </div>
  );
}
