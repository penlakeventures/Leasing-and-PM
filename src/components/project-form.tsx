import { Card, Field, Input, Button, LinkButton } from "@/components/ui";

export function ProjectForm({
  action,
  defaultValues,
  error,
}: {
  action: (formData: FormData) => void;
  defaultValues?: {
    internalName: string;
    websiteCode: string;
    neighbourhood: string;
    address: string;
    occupancyDate: Date;
    cmhcLoanRef: string | null;
    displayOrder: number;
  };
  error?: string;
}) {
  const occupancyDate = defaultValues?.occupancyDate
    ? defaultValues.occupancyDate.toISOString().slice(0, 10)
    : "";

  return (
    <Card>
      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <form action={action} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Internal name" htmlFor="internalName" hint='e.g. "Killarney23" — matches the financial statements'>
            <Input
              id="internalName"
              name="internalName"
              required
              defaultValue={defaultValues?.internalName}
            />
          </Field>
          <Field label="Website code" htmlFor="websiteCode" hint='e.g. "KLY2337" — matches penventures.ca'>
            <Input
              id="websiteCode"
              name="websiteCode"
              required
              defaultValue={defaultValues?.websiteCode}
            />
          </Field>
          <Field label="Neighbourhood" htmlFor="neighbourhood">
            <Input
              id="neighbourhood"
              name="neighbourhood"
              required
              defaultValue={defaultValues?.neighbourhood}
            />
          </Field>
          <Field label="Occupancy date" htmlFor="occupancyDate">
            <Input
              id="occupancyDate"
              name="occupancyDate"
              type="date"
              required
              defaultValue={occupancyDate}
            />
          </Field>
          <Field label="Address" htmlFor="address">
            <Input
              id="address"
              name="address"
              required
              defaultValue={defaultValues?.address}
            />
          </Field>
          <Field
            label="CMHC loan reference"
            htmlFor="cmhcLoanRef"
            hint="Optional — for linking to renewal-ladder tracking later"
          >
            <Input
              id="cmhcLoanRef"
              name="cmhcLoanRef"
              defaultValue={defaultValues?.cmhcLoanRef ?? ""}
            />
          </Field>
          <Field
            label="Display order"
            htmlFor="displayOrder"
            hint="Controls the order projects (and their units) appear in throughout the app — lower shows first"
          >
            <Input
              id="displayOrder"
              name="displayOrder"
              type="number"
              step="1"
              defaultValue={defaultValues?.displayOrder ?? ""}
            />
          </Field>
        </div>
        <div className="flex gap-2 pt-2">
          <Button type="submit">Save</Button>
          <LinkButton href="/projects" variant="secondary">
            Cancel
          </LinkButton>
        </div>
      </form>
    </Card>
  );
}
