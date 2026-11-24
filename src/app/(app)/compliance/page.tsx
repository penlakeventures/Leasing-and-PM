import { prisma } from "@/lib/prisma";
import { Table, Th, Td, LinkButton, Badge, EmptyState, Input, Button } from "@/components/ui";
import { markSubmitted, setReportingDeadline } from "@/lib/actions/compliance";

const fmtDateInput = (d: Date) => d.toISOString().slice(0, 10);

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
            <Th>Reporting deadline</Th>
            <Th>Status</Th>
            <Th>Mark submitted</Th>
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
                  <form
                    action={setReportingDeadline.bind(null, r.id)}
                    className="flex items-center gap-2"
                  >
                    <Input
                      type="date"
                      name="reportingDeadline"
                      className="w-36"
                      defaultValue={r.reportingDeadline ? fmtDateInput(r.reportingDeadline) : ""}
                    />
                    <Button type="submit" variant="secondary">
                      Save
                    </Button>
                  </form>
                </Td>
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
              </tr>
            );
          })}
        </tbody>
      </Table>
      {records.length === 0 && <EmptyState>No compliance records yet.</EmptyState>}
    </div>
  );
}
