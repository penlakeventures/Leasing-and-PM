import { prisma } from "@/lib/prisma";
import { requireOwnerPage } from "@/lib/require-owner";
import {
  createStaffMember,
  resetStaffPassword,
  setStaffActive,
  setStaffRole,
} from "@/lib/actions/staff";
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
  const session = await requireOwnerPage();

  const { error, createdEmail, tempPassword } = await searchParams;
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  const currentUserId = session?.user?.id;

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
                <Th>Status</Th>
                <Th>Password</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id}>
                    <Td>
                      {u.name}
                      {isSelf && <span className="text-neutral-400"> (you)</span>}
                    </Td>
                    <Td>{u.email}</Td>
                    <Td>
                      {isSelf ? (
                        <Badge tone={u.role === "owner" ? "blue" : "neutral"}>
                          {u.role === "owner" ? "Owner" : "Staff"}
                        </Badge>
                      ) : (
                        <form
                          action={setStaffRole.bind(null, u.id)}
                          className="flex items-center gap-2"
                        >
                          <Select name="role" defaultValue={u.role}>
                            <option value="staff">Staff</option>
                            <option value="owner">Owner (full access)</option>
                          </Select>
                          <Button type="submit" variant="secondary">
                            Save
                          </Button>
                        </form>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Badge tone={u.active ? "green" : "neutral"}>
                          {u.active ? "Active" : "Deactivated"}
                        </Badge>
                        {!isSelf && (
                          <form action={setStaffActive.bind(null, u.id, !u.active)}>
                            <button
                              type="submit"
                              className="text-xs text-neutral-600 underline"
                            >
                              {u.active ? "Deactivate" : "Reactivate"}
                            </button>
                          </form>
                        )}
                      </div>
                    </Td>
                    <Td>
                      {u.mustChangePassword ? (
                        <Badge tone="amber">Still temporary</Badge>
                      ) : (
                        <Badge tone="green">Set by user</Badge>
                      )}
                    </Td>
                    <Td>
                      {!isSelf && (
                        <form action={resetStaffPassword.bind(null, u.id)}>
                          <button
                            type="submit"
                            className="text-xs text-neutral-600 underline"
                          >
                            Reset password
                          </button>
                        </form>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      </div>
    </div>
  );
}
