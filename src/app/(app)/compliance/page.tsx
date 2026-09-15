import { prisma } from "@/lib/prisma";
import { Table, Th, Td, LinkButton, Badge, EmptyState, Input, Button } from "@/components/ui";
import { markSubmitted, deleteComplianceRecord } from "@/lib/actions/compliance";

export default async function CompliancePage() {
  const records = await prisma.complianceRecord.findMany({
    orderBy: [{ year: "desc" }],
    include: { projectEntity: true },
  });

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <LinkButton href="/compliance/new">+ New record</LinkButton>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Project</Th>
            <Th>Year</Th>
            <Th>Affordable units snapshotted</Th>
            <Th>Status</Th>
            <Th>Mark submitted</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {records.map((r) => {
            const snapshot = Array.isArray(r.affordableUnitRentsReported)
              ? r.affordableUnitRentsReported
              : [];
            return (
              <tr key={r.id} className="hover:bg-neutral-50">
                <Td>{r.projectEntity.internalName}</Td>
                <Td>{r.year}</Td>
                <Td>{snapshot.length} units</Td>
                <Td>
                  {r.submittedDate ? (
                    <Badge tone="green">Submitted {r.submittedDate.toLocaleDateString()}</Badge>
                  ) : (
                    <Badge tone="amber">Not submitted</Badge>
                  )}
                </Td>
                <Td>
                  {!r.submittedDate && (
                    <form action={markSubmitted.bind(null, r.id)} className="flex items-center gap-2">
                      <Input type="date" name="submittedDate" className="w-36" />
                      <Button type="submit" variant="secondary">
                        Mark submitted
                      </Button>
                    </form>
                  )}
                </Td>
                <Td>
                  <form action={deleteComplianceRecord.bind(null, r.id)}>
                    <button type="submit" className="text-xs text-red-600 hover:underline">
                      Delete
                    </button>
                  </form>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {records.length === 0 && <EmptyState>No compliance records yet.</EmptyState>}
    </div>
  );
}
