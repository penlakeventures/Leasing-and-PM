import { prisma } from "@/lib/prisma";
import { Table, Th, Td, LinkButton, Badge, EmptyState } from "@/components/ui";
import { deleteCommunication } from "@/lib/actions/communications";

export default async function CommunicationsPage() {
  const logs = await prisma.communicationLog.findMany({
    orderBy: { timestamp: "desc" },
    include: { tenant: true, lead: true, handledBy: true },
    take: 100,
  });

  return (
    <div>
      <div className="mb-6 flex justify-end">
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
            <Th></Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {logs.map((l) => (
            <tr key={l.id} className="hover:bg-neutral-50">
              <Td>{l.timestamp.toLocaleString()}</Td>
              <Td>{l.tenant?.name ?? l.lead?.contactName ?? "—"}</Td>
              <Td>
                <Badge tone="blue">{l.channel}</Badge>
              </Td>
              <Td>{l.direction}</Td>
              <Td>{l.summary}</Td>
              <Td>{l.handledBy?.name ?? "Automated"}</Td>
              <Td>
                <form action={deleteCommunication.bind(null, l.id)}>
                  <button type="submit" className="text-xs text-red-600 hover:underline">
                    Delete
                  </button>
                </form>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {logs.length === 0 && <EmptyState>No communications logged yet.</EmptyState>}
    </div>
  );
}
