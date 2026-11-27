import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader, Card, Table, Th, Td, Badge } from "@/components/ui";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { LeaseForm } from "@/components/lease-form";
import { DepositPanel } from "@/components/deposit-panel";
import { DocumentUploadPanel } from "@/components/document-upload-panel";
import { LeaseSigningPanel } from "@/components/lease-signing-panel";
import { updateLease, uploadLeaseDocument, sendLeaseForSignature, deleteLease } from "@/lib/actions/leases";
import { buildLeaseMergeFields, projectLegalEntityName, unitPremises } from "@/lib/lease-document";

export default async function LeaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const [lease, units] = await Promise.all([
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
  const uploadWithId = uploadLeaseDocument.bind(null, id);
  const sendForSignatureWithId = sendLeaseForSignature.bind(null, id);
  const deleteWithId = deleteLease.bind(null, id);

  // A real signed lease is never deletable from here — only while it's
  // still a test send, or a prospect's unsigned lease that never went
  // anywhere (ghosted).
  const canDelete = !lease.signatureCompletedAt && !lease.signedDate;

  const leaseTenants = lease.tenants.map((lt) => lt.tenant);
  const signingDefaults = buildLeaseMergeFields({
    landlordName: projectLegalEntityName(lease.unit.projectEntity.internalName),
    tenantNames: leaseTenants.map((t) => t.name),
    premises: unitPremises(lease.unit.unitNumber),
    startDate: lease.startDate,
    endDate: lease.endDate ?? lease.startDate,
    rentAmount: Number(lease.rentAmount),
    depositAmount: lease.securityDeposit ? Number(lease.securityDeposit.amount) : Number(lease.rentAmount),
    // Before a deposit's actually been recorded, the lease's own Start
    // date (the real move-in day) is a far better placeholder than
    // today — a lease is typically signed well before occupancy, and a
    // deposit is normally collected at or before move-in, not on
    // whatever day the document happens to be sent for signature.
    depositDate: lease.securityDeposit?.dateReceived ?? lease.startDate,
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
        existingTenants={leaseTenants.map((t) => ({ id: t.id, name: t.name }))}
        defaultValues={lease}
      />

      <LeaseSigningPanel
        periodic={lease.periodic}
        hasEndDate={Boolean(lease.endDate)}
        signatureRequestId={lease.signatureRequestId}
        signatureSentAt={lease.signatureSentAt}
        signatureTestMode={lease.signatureTestMode}
        signatureCompletedAt={lease.signatureCompletedAt}
        signedDate={lease.signedDate}
        defaults={signingDefaults}
        sendAction={sendForSignatureWithId}
      />

      <DocumentUploadPanel
        leaseId={lease.id}
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

      {canDelete && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-neutral-900">Delete this lease</h2>
          <p className="mb-3 text-sm text-neutral-500">
            Only available because this lease hasn&apos;t been signed yet — use this to remove a
            test send, or a lease a prospect never signed and ghosted on.
          </p>
          <form action={deleteWithId}>
            <ConfirmSubmitButton
              variant="danger"
              confirmMessage="Delete this lease permanently? This can't be undone."
            >
              Delete lease
            </ConfirmSubmitButton>
          </form>
        </Card>
      )}
    </div>
  );
}
