import { auth } from "@/lib/auth";
import { changePassword } from "@/lib/actions/account";
import { PageHeader, Card, Field, Input, Button } from "@/components/ui";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const session = await auth();
  const { error, success } = await searchParams;

  return (
    <div>
      <PageHeader
        title="Change password"
        description={`Signed in as ${session?.user?.name} (${session?.user?.email})`}
      />
      <Card>
        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {success && (
          <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Password updated.
          </p>
        )}
        <form action={changePassword} className="max-w-sm space-y-4">
          <Field label="Current password" htmlFor="currentPassword">
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <Field
            label="New password"
            htmlFor="newPassword"
            hint="At least 8 characters"
          >
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
          <Field label="Confirm new password" htmlFor="confirmPassword">
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
          <Button type="submit">Update password</Button>
        </form>
      </Card>
    </div>
  );
}
