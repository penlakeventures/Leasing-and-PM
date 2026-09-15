import { Card, Button, LinkButton, Field, Input } from "@/components/ui";
import { getActiveConnection } from "@/lib/dropbox";
import { disconnectDropbox, updateDropboxBasePath } from "@/lib/actions/dropbox";

export default async function DropboxSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const connection = await getActiveConnection();

  return (
    <div>
      <Card>
        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {connection ? (
          <div className="space-y-6">
            <div className="space-y-4">
              <p className="text-sm text-neutral-700">
                Connected as{" "}
                <span className="font-medium">{connection.accountEmail}</span>.
                When a new lease is created, the app creates that unit&apos;s
                Dropbox folder (archiving the previous tenant&apos;s folder
                into that project&apos;s PAST TENANTS folder first, if one
                exists) and fills in the lease&apos;s Document link
                automatically.
              </p>
              <div className="flex gap-2">
                <LinkButton href="/api/dropbox/connect" variant="secondary">
                  Reconnect / switch account
                </LinkButton>
                <form action={disconnectDropbox}>
                  <Button type="submit" variant="danger">
                    Disconnect
                  </Button>
                </form>
              </div>
            </div>

            <form action={updateDropboxBasePath} className="max-w-lg space-y-4">
              <Field
                label="Base folder path"
                htmlFor="basePath"
                hint={
                  'The Dropbox folder that contains your per-project folders (e.g. "/Pen Lake Ventures/Leases"). Each project folder underneath it must be named exactly like it appears in this app — e.g. "Killarney23" — with a unit-numbered subfolder inside for each unit.'
                }
              >
                <Input
                  id="basePath"
                  name="basePath"
                  defaultValue={connection.basePath}
                  placeholder="/Pen Lake Ventures/Leases"
                />
              </Field>
              <Button type="submit">Save</Button>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-neutral-700">
              No Dropbox account connected yet — new leases won&apos;t get an
              automatic document folder until one is.
            </p>
            <LinkButton href="/api/dropbox/connect">Connect Dropbox</LinkButton>
          </div>
        )}
      </Card>
    </div>
  );
}
