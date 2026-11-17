import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader, Button, Card, Table, Th, Td, Badge } from "@/components/ui";
import { LeaseForm } from "@/components/lease-form";
import { DepositPanel } from "@/components/deposit-panel";
import { DocumentUploadPanel } from "@/components/document-upload-panel";
import { LeaseSigningPanel } from "@/components/lease-signing-panel";
import { updateLease, deleteLease, uploadLeaseDocument, sendLeaseForSignature } from "@/lib/actions/leases";
import { buildLeaseMergeFields, projectLegalEntityName } from "@/lib/lease-document";

export default async function LeaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const [lease, units, tenants] = await Promise.all([
    prisma.lease.findUnique({
      where: { id },
      include: {
        tenants: { include: { tenant: true } },
        securityDeposit: { include: { deductions: true } },
        unit: { include: { projectEntity: true } },
      },
    }),
    prisma.unit.findMany({
      orderBy: { projectEntity: { displayOrder: "asc" } },
      include: { projectEntity: true },
    }),
    prisma.tenant.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!lease) notFound();

  // Every lease this unit has ever had, each with its own document link —
  // so "open this lease's documents" also surfaces the rest of the unit's
  // lease history in the same spot, instead of only this one tenancy's
  // folder.
  const unitLeaseHistory = await prisma.lease.findMany({
    where: { unitId: lease.unitId },
    orderBy: { startDate: "desc" },
    include: { tenants: { include: { tenant: true } } },
  });

  const updateWithId = updateLease.bind(null, id);
  const deleteWithId = deleteLease.bind(null, id);
  const uploadWithId = uploadLeaseDocument.bind(null, id);
  const sendForSignatureWithId = sendLeaseForSignature.bind(null, id);

  const leaseTenants = lease.tenants.map((lt) => lt.tenant);
  const signingDefaults = buildLeaseMergeFields({
    landlordName: projectLegalEntityName(lease.unit.projectEntity.internalName),
    tenantNames: leaseTenants.map((t) => t.name),
    premises: `Unit ${lease.unit.unitNumber}, ${lease.unit.projectEntity.address}`,
    startDate: lease.startDate,
    endDate: lease.endDate ?? lease.startDate,
    rentAmount: Number(lease.rentAmount),
    depositAmount: lease.securityDeposit ? Number(lease.securityDeposit.amount) : Number(lease.rentAmount),
    depositDate: lease.securityDeposit?.dateReceived ?? new Date(),
  });

  return (
    <div className="space-y-8">
      <PageHeader title="Lease" />

      {/* Both the lease form and the deposit panel below can produce this
          error via a redirect — shown once here since either can fail. */}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <LeaseForm
        action={updateWithId}
        units={units}
        tenants={tenants}
        defaultValues={{
          ...lease,
          tenantIds: lease.tenants.map((t) => t.tenantId),
        }}
      />

      <LeaseSigningPanel
        periodic={lease.periodic}
        hasEndDate={Boolean(lease.endDate)}
        signatureRequestId={lease.signatureRequestId}
        signatureSentAt={lease.signatureSentAt}
        signatureTestMode={lease.signatureTestMode}
        signatureCompletedAt={lease.signatureCompletedAt}
        defaults={signingDefaults}
        sendAction={sendForSignatureWithId}
      />

      <DocumentUploadPanel
        documentLink={lease.documentLink}
        canUpload={Boolean(lease.documentsFolderPath)}
        uploadAction={uploadWithId}
      />

      {unitLeaseHistory.length > 1 && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">
            Lease history for {lease.unit.projectEntity.internalName} — Unit{" "}
            {lease.unit.unitNumber}
          </h2>
          <Table>
            <thead>
              <tr>
                <Th>Tenant(s)</Th>
                <Th>Start</Th>
                <Th>End</Th>
                <Th>Document</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {unitLeaseHistory.map((l) => (
                <tr key={l.id} className={l.id === lease.id ? "bg-neutral-50" : undefined}>
                  <Td>
                    <Link href={`/leases/${l.id}`} className="underline">
                      {l.tenants.map((t) => t.tenant.name).join(", ") || "—"}
                    </Link>
                    {l.id === lease.id && (
                      <>
                        {" "}
                        <Badge tone="blue">This lease</Badge>
                      </>
                    )}
                  </Td>
                  <Td>{l.startDate.toLocaleDateString()}</Td>
                  <Td>{l.periodic ? "Periodic" : (l.endDate?.toLocaleDateString() ?? "—")}</Td>
                  <Td>
                    {l.documentLink ? (
                      <a
                        href={l.documentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Open in Dropbox →
                      </a>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <DepositPanel
        leaseId={lease.id}
        deposit={lease.securityDeposit}
        monthlyRent={Number(lease.rentAmount)}
        tenancyEndDate={lease.endDate}
      />

      <form action={deleteWithId}>
        <Button type="submit" variant="danger">
          Delete lease
        </Button>
      </form>
    </div>
  );
}
