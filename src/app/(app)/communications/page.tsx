import { prisma } from "@/lib/prisma";
import { Table, Th, Td, LinkButton, Badge, EmptyState } from "@/components/ui";
import Link from "next/link";

const PAGE_SIZE = 100;

export default async function CommunicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string }>;
}) {
  const { limit: limitRaw } = await searchParams;
  // Rounded up to a whole page so a stray query param can't ask for an
  // oddly small or negative slice.
  const limit = Math.max(PAGE_SIZE, Math.ceil((Number(limitRaw) || PAGE_SIZE) / PAGE_SIZE) * PAGE_SIZE);

  const [logs, total] = await Promise.all([
    prisma.communicationLog.findMany({
      orderBy: { timestamp: "desc" },
      include: { tenant: true, lead: true, vendor: true, handledBy: true },
      take: limit,
    }),
    prisma.communicationLog.count(),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Showing {logs.length} of {total}
        </p>
        <LinkButton href="/communications/new">+ Log communication</LinkButton>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>When</Th>
            <Th>Who</Th>
            <Th>Channel</Th>
            <Th>Direction</Th>
            <Th>Summary</Th>
            <Th>Handled by</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {logs.map((l) => {
            const who = l.tenant
              ? { name: l.tenant.name, href: `/tenants/${l.tenant.id}` }
              : l.lead
                ? { name: l.lead.contactName ?? "Lead", href: `/leads/${l.lead.id}` }
                : l.vendor
                  ? { name: l.vendor.name, href: `/vendors/${l.vendor.id}` }
                  : null;
            return (
              <tr key={l.id} className="hover:bg-neutral-50">
                <Td>{l.timestamp.toLocaleString()}</Td>
                <Td>
                  {who ? (
                    <Link href={who.href} className="underline">
                      {who.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td>
                  <Badge tone="blue">{l.channel}</Badge>
                </Td>
                <Td>{l.direction}</Td>
                <Td>{l.summary}</Td>
                <Td>{l.handledBy?.name ?? "Automated"}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {logs.length === 0 && <EmptyState>No communications logged yet.</EmptyState>}
      {total > logs.length && (
        <div className="mt-4 flex justify-center">
          <Link
            href={`/communications?limit=${limit + PAGE_SIZE}`}
            className="text-sm text-neutral-600 underline"
          >
            Load {Math.min(PAGE_SIZE, total - logs.length)} more
          </Link>
        </div>
      )}
    </div>
  );
}
