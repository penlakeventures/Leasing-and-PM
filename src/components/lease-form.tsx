import Link from "next/link";
import { Card, Field, Input, Select, Textarea, Button, LinkButton } from "@/components/ui";
import { NewTenantFields } from "@/components/new-tenant-fields";

export function LeaseForm({
  action,
  units,
  existingTenants,
  defaultValues,
  defaultUnitId,
  renewalOf,
  error,
}: {
  action: (formData: FormData) => void;
  units: { id: string; unitNumber: string; projectEntity: { internalName: string } }[];
  // The lease's already-fixed tenant(s) — an existing lease being edited,
  // or a renewal carrying the same tenant(s) forward. Shown read-only,
  // never re-entered here. Omitted entirely for a genuinely new lease,
  // which instead gets NewTenantFields below to enter a brand-new
  // tenant's info directly (there's no separate CRM step anymore that
  // would already have created a Tenant record to pick from).
  existingTenants?: { id: string; name: string }[];
  defaultValues?: {
    unitId: string;
    startDate: Date;
    endDate: Date | null;
    periodic: boolean;
    rentAmount: unknown;
    lastRentIncreaseDate: Date | null;
    rentIncreaseNoticeGivenDate: Date | null;
    firstMonthRentPrepaid: unknown;
    lastMonthRentPrepaid: unknown;
    pets: string | null;
    signedDate: Date | null;
    documentLink: string | null;
    notes: string | null;
  };
  defaultUnitId?: string;
  // Present only when this form was opened via the Renewals page's
  // "Create renewal" shortcut — carried through as a hidden field so
  // createLease() can tell this is the same tenant continuing, not a new
  // one, and reuse their existing Dropbox folder instead of archiving it.
  renewalOf?: { leaseId: string; unitLabel: string };
  error?: string;
}) {
  const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

  const increaseAnchor =
    defaultValues?.lastRentIncreaseDate ?? defaultValues?.startDate ?? null;
  const nextEligibleDate = increaseAnchor
    ? new Date(increaseAnchor.getTime() + 365 * 24 * 60 * 60 * 1000)
    : null;

  return (
    <Card>
      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {renewalOf && (
        <p className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
          Renewing the current lease for {renewalOf.unitLabel} — the existing
          Dropbox folder carries over automatically; nothing new is archived.
        </p>
      )}
      <form action={action} className="space-y-4">
        {renewalOf && (
          <input type="hidden" name="renewedFromLeaseId" value={renewalOf.leaseId} />
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Unit" htmlFor="unitId">
            <Select
              id="unitId"
              name="unitId"
              required
              defaultValue={defaultValues?.unitId ?? defaultUnitId}
            >
              <option value="">Select a unit…</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.projectEntity.internalName} — Unit {u.unitNumber}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Rent amount"
            htmlFor="rentAmount"
            hint={
              defaultValues && nextEligibleDate
                ? `Periodic-lease increases: next eligible ${nextEligibleDate.toLocaleDateString()} (Alberta RTA, once per 365 days)`
                : undefined
            }
          >
            <Input
              id="rentAmount"
              name="rentAmount"
              type="number"
              step="0.01"
              min={0}
              required
              defaultValue={
                defaultValues?.rentAmount ? String(defaultValues.rentAmount) : ""
              }
            />
          </Field>
          <Field
            label="Rent increase notice given"
            htmlFor="rentIncreaseNoticeGivenDate"
            hint="Only needed when raising rent on a periodic lease — must be ≥3 months before today"
          >
            <Input
              id="rentIncreaseNoticeGivenDate"
              name="rentIncreaseNoticeGivenDate"
              type="date"
              defaultValue={fmt(defaultValues?.rentIncreaseNoticeGivenDate ?? null)}
            />
          </Field>
          <Field label="Start date" htmlFor="startDate">
            <Input
              id="startDate"
              name="startDate"
              type="date"
              required
              defaultValue={fmt(defaultValues?.startDate ?? null)}
            />
          </Field>
          <Field label="End date" htmlFor="endDate" hint="Leave blank if periodic">
            <Input
              id="endDate"
              name="endDate"
              type="date"
              defaultValue={fmt(defaultValues?.endDate ?? null)}
            />
          </Field>
          <Field label="Signed date" htmlFor="signedDate">
            <Input
              id="signedDate"
              name="signedDate"
              type="date"
              defaultValue={fmt(defaultValues?.signedDate ?? null)}
            />
          </Field>
          <Field label="Document link" htmlFor="documentLink" hint="Optional">
            <Input
              id="documentLink"
              name="documentLink"
              defaultValue={defaultValues?.documentLink ?? ""}
            />
          </Field>
          <Field
            label="First month's rent collected"
            htmlFor="firstMonthRentPrepaid"
            hint="Optional"
          >
            <Input
              id="firstMonthRentPrepaid"
              name="firstMonthRentPrepaid"
              type="number"
              step="0.01"
              min={0}
              defaultValue={
                defaultValues?.firstMonthRentPrepaid
                  ? String(defaultValues.firstMonthRentPrepaid)
                  : ""
              }
            />
          </Field>
          <Field
            label="Last month's rent prepaid"
            htmlFor="lastMonthRentPrepaid"
            hint="Optional"
          >
            <Input
              id="lastMonthRentPrepaid"
              name="lastMonthRentPrepaid"
              type="number"
              step="0.01"
              min={0}
              defaultValue={
                defaultValues?.lastMonthRentPrepaid
                  ? String(defaultValues.lastMonthRentPrepaid)
                  : ""
              }
            />
          </Field>
          <Field label="Pets" htmlFor="pets" hint='Optional, e.g. "dog, cat"'>
            <Input
              id="pets"
              name="pets"
              defaultValue={defaultValues?.pets ?? ""}
            />
          </Field>
        </div>

        <Field label="Notes" htmlFor="notes" hint="Also editable inline from the Leases list">
          <Textarea
            id="notes"
            name="notes"
            defaultValue={defaultValues?.notes ?? ""}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            name="periodic"
            defaultChecked={defaultValues?.periodic}
            className="rounded border-neutral-300"
          />
          Periodic (month-to-month, no fixed end date)
        </label>

        {existingTenants ? (
          <Field label="Tenant(s)" htmlFor="_existing-tenants">
            <div
              id="_existing-tenants"
              className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700"
            >
              {existingTenants.length > 0
                ? existingTenants.map((t, i) => (
                    <span key={t.id}>
                      {i > 0 && ", "}
                      <Link href={`/tenants/${t.id}`} className="underline">
                        {t.name}
                      </Link>
                    </span>
                  ))
                : "—"}
            </div>
            {existingTenants.map((t) => (
              <input key={t.id} type="hidden" name="tenantIds" value={t.id} />
            ))}
          </Field>
        ) : (
          <div>
            <p className="mb-1 block text-sm font-medium text-neutral-700">
              Tenant(s)
            </p>
            <NewTenantFields />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="submit">Save</Button>
          <LinkButton href="/leases" variant="secondary">
            Cancel
          </LinkButton>
        </div>
      </form>
    </Card>
  );
}
