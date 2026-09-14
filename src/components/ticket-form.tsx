import { Card, Field, Input, Select, Textarea, Button, LinkButton } from "@/components/ui";

export function TicketForm({
  action,
  units,
  tenants,
  vendors,
  defaultValues,
  defaultUnitId,
  error,
}: {
  action: (formData: FormData) => void;
  units: { id: string; unitNumber: string; projectEntity: { internalName: string } }[];
  tenants: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
  defaultValues?: {
    unitId: string;
    tenantId: string | null;
    description: string;
    priority: string;
    status: string;
    vendorId: string | null;
    cost: unknown;
  };
  defaultUnitId?: string;
  error?: string;
}) {
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
            <Select id="unitId" name="unitId" required defaultValue={defaultValues?.unitId ?? defaultUnitId}>
              <option value="">Select a unit…</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.projectEntity.internalName} — Unit {u.unitNumber}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tenant" htmlFor="tenantId" hint="Optional">
            <Select id="tenantId" name="tenantId" defaultValue={defaultValues?.tenantId ?? ""}>
              <option value="">—</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority" htmlFor="priority">
            <Select id="priority" name="priority" defaultValue={defaultValues?.priority ?? "MEDIUM"}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
          </Field>
          <Field label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={defaultValues?.status ?? "NEW"}>
              <option value="NEW">New</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="RESOLVED">Resolved</option>
            </Select>
          </Field>
          <Field label="Vendor" htmlFor="vendorId" hint="Optional">
            <Select id="vendorId" name="vendorId" defaultValue={defaultValues?.vendorId ?? ""}>
              <option value="">—</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cost" htmlFor="cost" hint="Optional">
            <Input
              id="cost"
              name="cost"
              type="number"
              step="0.01"
              min={0}
              defaultValue={defaultValues?.cost ? String(defaultValues.cost) : ""}
            />
          </Field>
        </div>
        <Field label="Description" htmlFor="description">
          <Textarea id="description" name="description" required defaultValue={defaultValues?.description} />
        </Field>
        <div className="flex gap-2 pt-2">
          <Button type="submit">Save</Button>
          <LinkButton href="/tickets" variant="secondary">
            Cancel
          </LinkButton>
        </div>
      </form>
    </Card>
  );
}
