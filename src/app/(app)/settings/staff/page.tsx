import { prisma } from "@/lib/prisma";
import { requireOwnerPage } from "@/lib/require-owner";
import { createStaffMember } from "@/lib/actions/staff";
import {
  PageHeader,
  Card,
  Field,
  Input,
  Select,
  Button,
  Table,
  Th,
  Td,
  Badge,
} from "@/components/ui";

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; createdEmail?: string; tempPassword?: string }>;
}) {
  await requireOwnerPage();

  const { error, createdEmail, tempPassword } = await searchParams;
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div>
      <PageHeader
        title="Staff accounts"
        description="Who can log into this app, and what they can see."
      />

      {createdEmail && tempPassword && (
        <div className="mb-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <p className="font-medium">Account created for {createdEmail}.</p>
          <p className="mt-1">
            Temporary password:{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono">
              {tempPassword}
            </code>
          </p>
          <p className="mt-1">
            This won&apos;t be shown again — send it to them now. They&apos;ll be
            required to set their own password the first time they log in.
          </p>
        </div>
      )}
      {error && (
        <p className="mb-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="space-y-10">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">
            Add a staff member
          </h2>
          <Card>
            <form
              action={createStaffMember}
              className="flex flex-wrap items-end gap-3"
            >
              <Field label="Name" htmlFor="name">
                <Input id="name" name="name" required />
              </Field>
              <Field label="Email" htmlFor="email">
                <Input id="email" name="email" type="email" required />
              </Field>
              <Field
                label="Access"
                htmlFor="role"
                hint="Staff can't see Financials"
              >
                <Select id="role" name="role" defaultValue="staff">
                  <option value="staff">Staff</option>
                  <option value="owner">Owner (full access)</option>
                </Select>
              </Field>
              <Button type="submit">Create account</Button>
            </form>
          </Card>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">
            Existing accounts
          </h2>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Access</Th>
                <Th>Password</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <Td>{u.name}</Td>
                  <Td>{u.email}</Td>
                  <Td>
                    <Badge tone={u.role === "owner" ? "blue" : "neutral"}>
                      {u.role === "owner" ? "Owner" : "Staff"}
                    </Badge>
                  </Td>
                  <Td>
                    {u.mustChangePassword ? (
                      <Badge tone="amber">Still temporary</Badge>
                    ) : (
                      <Badge tone="green">Set by user</Badge>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>
    </div>
  );
}
