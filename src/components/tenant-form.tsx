import { Card, Field, Input, Button, LinkButton } from "@/components/ui";

export function TenantForm({
  action,
  defaultValues,
  error,
}: {
  action: (formData: FormData) => void;
  defaultValues?: {
    name: string;
    phone: string | null;
    email: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
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
          <Field label="Phone" htmlFor="phone">
            <Input id="phone" name="phone" defaultValue={defaultValues?.phone ?? ""} />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" defaultValue={defaultValues?.email ?? ""} />
          </Field>
          <div />
          <Field label="Emergency contact name" htmlFor="emergencyContactName" hint="Optional">
            <Input
              id="emergencyContactName"
              name="emergencyContactName"
              defaultValue={defaultValues?.emergencyContactName ?? ""}
            />
          </Field>
          <Field label="Emergency contact phone" htmlFor="emergencyContactPhone" hint="Optional">
            <Input
              id="emergencyContactPhone"
              name="emergencyContactPhone"
              defaultValue={defaultValues?.emergencyContactPhone ?? ""}
            />
          </Field>
        </div>
        <div className="flex gap-2 pt-2">
          <Button type="submit">Save</Button>
          <LinkButton href="/tenants" variant="secondary">
            Cancel
          </LinkButton>
        </div>
      </form>
    </Card>
  );
}
