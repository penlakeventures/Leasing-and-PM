import { Card, Field, Input, Select, Button, LinkButton } from "@/components/ui";

export function LeadForm({
  action,
  units,
  defaultValues,
  error,
}: {
  action: (formData: FormData) => void;
  units: { id: string; unitType: string; projectEntity: { internalName: string } }[];
  defaultValues?: {
    source: string;
    unitId: string | null;
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    status: string;
  };
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
          <Field label="Source" htmlFor="source">
            <Select id="source" name="source" defaultValue={defaultValues?.source ?? "RENTFASTER"}>
              <option value="RENTFASTER">RentFaster</option>
              <option value="FACEBOOK_MARKETPLACE">Facebook Marketplace</option>
              <option value="OTHER">Other</option>
            </Select>
          </Field>
          <Field label="Unit" htmlFor="unitId" hint="Leave blank for general interest">
            <Select id="unitId" name="unitId" defaultValue={defaultValues?.unitId ?? ""}>
              <option value="">General interest</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.projectEntity.internalName} — {u.unitType}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Contact name" htmlFor="contactName">
            <Input id="contactName" name="contactName" defaultValue={defaultValues?.contactName ?? ""} />
          </Field>
          <Field label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={defaultValues?.status ?? "NEW"}>
              <option value="NEW">New</option>
              <option value="CONTACTED">Contacted</option>
              <option value="TOURING">Touring</option>
              <option value="APPLIED">Applied</option>
              <option value="SCREENED">Screened</option>
              <option value="LEASED">Leased</option>
              <option value="LOST">Lost</option>
            </Select>
          </Field>
          <Field label="Contact phone" htmlFor="contactPhone">
            <Input id="contactPhone" name="contactPhone" defaultValue={defaultValues?.contactPhone ?? ""} />
          </Field>
          <Field label="Contact email" htmlFor="contactEmail">
            <Input id="contactEmail" name="contactEmail" type="email" defaultValue={defaultValues?.contactEmail ?? ""} />
          </Field>
        </div>
        <div className="flex gap-2 pt-2">
          <Button type="submit">Save</Button>
          <LinkButton href="/leads" variant="secondary">
            Cancel
          </LinkButton>
        </div>
      </form>
    </Card>
  );
}
