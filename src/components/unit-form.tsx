import { Card, Field, Input, Select, Button, LinkButton } from "@/components/ui";

export function UnitForm({
  action,
  projects,
  defaultValues,
  defaultProjectId,
  error,
}: {
  action: (formData: FormData) => void;
  projects: { id: string; internalName: string }[];
  defaultValues?: {
    projectEntityId: string;
    unitNumber: string;
    bedrooms: number;
    sqft: number | null;
    cmhcDesignation: string;
    baseRent: unknown;
    currentRent: unknown;
    tenancyType: string;
  };
  defaultProjectId?: string;
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
          <Field label="Project" htmlFor="projectEntityId">
            <Select
              id="projectEntityId"
              name="projectEntityId"
              required
              defaultValue={defaultValues?.projectEntityId ?? defaultProjectId}
            >
              <option value="">Select a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.internalName}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Unit number"
            htmlFor="unitNumber"
            hint="How this unit is identified on the rent roll, e.g. &quot;203&quot;"
          >
            <Input
              id="unitNumber"
              name="unitNumber"
              required
              defaultValue={defaultValues?.unitNumber}
            />
          </Field>
          <Field label="Bedrooms" htmlFor="bedrooms">
            <Input
              id="bedrooms"
              name="bedrooms"
              type="number"
              min={0}
              required
              defaultValue={defaultValues?.bedrooms}
            />
          </Field>
          <Field label="Square feet" htmlFor="sqft" hint="Optional">
            <Input
              id="sqft"
              name="sqft"
              type="number"
              min={0}
              defaultValue={defaultValues?.sqft ?? ""}
            />
          </Field>
          <Field label="CMHC designation" htmlFor="cmhcDesignation">
            <Select
              id="cmhcDesignation"
              name="cmhcDesignation"
              defaultValue={defaultValues?.cmhcDesignation ?? "MARKET"}
            >
              <option value="MARKET">Market</option>
              <option value="AFFORDABLE">Affordable</option>
            </Select>
          </Field>
          <Field label="Tenancy type" htmlFor="tenancyType" hint="Internal = Pen-to-Pen (e.g. the barn)">
            <Select
              id="tenancyType"
              name="tenancyType"
              defaultValue={defaultValues?.tenancyType ?? "EXTERNAL"}
            >
              <option value="EXTERNAL">External</option>
              <option value="INTERNAL">Internal</option>
            </Select>
          </Field>
          <Field label="Base rent" htmlFor="baseRent">
            <Input
              id="baseRent"
              name="baseRent"
              type="number"
              step="0.01"
              min={0}
              required
              defaultValue={
                defaultValues?.baseRent ? String(defaultValues.baseRent) : ""
              }
            />
          </Field>
          <Field
            label="Current rent"
            htmlFor="currentRent"
            hint="Affordable-unit increases are capped at the year's CPI rate"
          >
            <Input
              id="currentRent"
              name="currentRent"
              type="number"
              step="0.01"
              min={0}
              required
              defaultValue={
                defaultValues?.currentRent
                  ? String(defaultValues.currentRent)
                  : ""
              }
            />
          </Field>
        </div>
        <div className="flex gap-2 pt-2">
          <Button type="submit">Save</Button>
          <LinkButton href="/units" variant="secondary">
            Cancel
          </LinkButton>
        </div>
      </form>
    </Card>
  );
}
