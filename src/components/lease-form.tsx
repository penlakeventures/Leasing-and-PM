import { Card, Field, Input, Select, Button, LinkButton } from "@/components/ui";

export function LeaseForm({
  action,
  units,
  tenants,
  defaultValues,
  defaultUnitId,
  error,
}: {
  action: (formData: FormData) => void;
  units: { id: string; unitNumber: string; projectEntity: { internalName: string } }[];
  tenants: { id: string; name: string }[];
  defaultValues?: {
    unitId: string;
    tenantIds: string[];
    startDate: Date;
    endDate: Date | null;
    periodic: boolean;
    rentAmount: unknown;
    lastMonthRentPrepaid: unknown;
    pets: string | null;
    signedDate: Date | null;
    documentLink: string | null;
  };
  defaultUnitId?: string;
  error?: string;
}) {
  const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

  return (
    <Card>
      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <form action={action} className="space-y-4">
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
          <Field label="Rent amount" htmlFor="rentAmount">
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

        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            name="periodic"
            defaultChecked={defaultValues?.periodic}
            className="rounded border-neutral-300"
          />
          Periodic (month-to-month, no fixed end date)
        </label>

        <Field label="Tenants" htmlFor="tenantIds" hint="Select one or more — couples/roommates supported">
          <select
            id="tenantIds"
            name="tenantIds"
            multiple
            size={Math.min(6, Math.max(3, tenants.length))}
            defaultValue={defaultValues?.tenantIds}
            className="block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>

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
