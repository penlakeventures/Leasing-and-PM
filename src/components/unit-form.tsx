import { Card, Field, Input, Select, Button, LinkButton } from "@/components/ui";

export function UnitForm({
  action,
  projects,
  defaultValues,
  defaultProjectId,
  error,
  lockCurrentRent,
}: {
  action: (formData: FormData) => void;
  projects: { id: string; internalName: string }[];
  defaultValues?: {
    projectEntityId: string;
    unitNumber: string;
    bedrooms: number;
    sqft: number | null;
    cmhcDesignation: string;
    currentRent: unknown;
  };
  defaultProjectId?: string;
  error?: string;
  // True for a staff account editing an existing unit — a unit's current
  // rent is an owner-only decision (rent changes themselves now happen
  // outside the app, and land here automatically once a new lease is
  // created for the unit), so the field is shown but not editable here
  // rather than just left out, so staff can still see the number.
  lockCurrentRent?: boolean;
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
          <Field
            label="Current rent"
            htmlFor="currentRent"
            hint={
              lockCurrentRent
                ? "Only an owner can change this directly — ask an owner to update it, or it's set automatically from a new lease's rent"
                : "Affordable-unit increases are capped at the year's CPI rate"
            }
          >
            <Input
              id="currentRent"
              name="currentRent"
              type="number"
              step="0.01"
              min={0}
              required
              readOnly={lockCurrentRent}
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
          <LinkButton
            href={
              defaultValues?.projectEntityId ?? defaultProjectId
                ? `/projects/${defaultValues?.projectEntityId ?? defaultProjectId}`
                : "/projects"
            }
            variant="secondary"
          >
            Cancel
          </LinkButton>
        </div>
      </form>
    </Card>
  );
}
