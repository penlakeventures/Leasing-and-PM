import { Card, Field, Input, Button, LinkButton } from "@/components/ui";

export function VendorForm({
  action,
  defaultValues,
  error,
}: {
  action: (formData: FormData) => void;
  defaultValues?: {
    name: string;
    type: string;
    contactPhone: string | null;
    contactEmail: string | null;
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
          <Field label="Name" htmlFor="name">
            <Input id="name" name="name" required defaultValue={defaultValues?.name} />
          </Field>
          <Field label="Type" htmlFor="type" hint="e.g. handyman, plumber">
            <Input id="type" name="type" required defaultValue={defaultValues?.type} />
          </Field>
          <Field label="Phone" htmlFor="contactPhone">
            <Input id="contactPhone" name="contactPhone" defaultValue={defaultValues?.contactPhone ?? ""} />
          </Field>
          <Field label="Email" htmlFor="contactEmail">
            <Input id="contactEmail" name="contactEmail" type="email" defaultValue={defaultValues?.contactEmail ?? ""} />
          </Field>
        </div>
        <div className="flex gap-2 pt-2">
          <Button type="submit">Save</Button>
          <LinkButton href="/vendors" variant="secondary">
            Cancel
          </LinkButton>
        </div>
      </form>
    </Card>
  );
}
