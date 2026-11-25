import { Card, Button, LinkButton, Field, Input } from "@/components/ui";
import { getActiveConnection } from "@/lib/dropbox";
import {
  disconnectDropbox,
  updateDropboxBasePath,
  backfillDocumentFolders,
  backfillActiveLeaseFoldersFromStructure,
  resolveSharedLink,
} from "@/lib/actions/dropbox";

export default async function DropboxSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;
  const connection = await getActiveConnection();

  return (
    <div>
      <Card>
        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {message && (
          <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            {message}
          </p>
        )}
        {connection ? (
          <div className="space-y-6">
            <div className="space-y-4">
              <p className="text-sm text-neutral-700">
                Connected as{" "}
                <span className="font-medium">{connection.accountEmail}</span>.
                When a new lease is created, the app creates a
                &quot;unit # + tenant name&quot; Dropbox folder for it
                (archiving the previous tenant&apos;s folder into that
                project&apos;s Past tenants folder first, if one exists) and
                fills in the lease&apos;s Document link automatically.
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

            <div className="space-y-2 border-t border-neutral-100 pt-4">
              <p className="text-sm text-neutral-700">
                A lease created before the in-app Documents list existed (or
                with a Document link pasted in by hand) only shows &quot;No
                Dropbox folder linked yet&quot; there until it&apos;s resolved once.
                This checks every lease with a Document link but no folder on
                file yet and fills that in — safe to run more than once.
              </p>
              <form action={backfillDocumentFolders}>
                <Button type="submit" variant="secondary">
                  Find documents for existing leases
                </Button>
              </form>
            </div>

            <div className="space-y-2 border-t border-neutral-100 pt-4">
              <p className="text-sm text-neutral-700">
                A lease that never had a Document link saved at all (most real
                leases predate this app) has nothing for the button above to
                resolve from. This instead matches every currently-active
                lease straight to its unit&apos;s real Dropbox folder, by unit
                number, the same way a brand-new lease&apos;s folder is found —
                also safe to run more than once. Leases that have already
                ended aren&apos;t covered by this yet.
              </p>
              <form action={backfillActiveLeaseFoldersFromStructure}>
                <Button type="submit" variant="secondary">
                  Match active leases to their Dropbox folders
                </Button>
              </form>
            </div>

            <div className="space-y-2 border-t border-neutral-100 pt-4">
              <p className="text-sm text-neutral-700">
                Not sure the app is pointed at the right Dropbox folder? Paste
                any shared link below (e.g. the leasing folder everyone
                works out of) to see exactly what path it resolves to under
                this connected account — compare it against the Base folder
                path below.
              </p>
              <form action={resolveSharedLink} className="flex max-w-lg flex-wrap items-center gap-2">
                <input
                  type="text"
                  name="sharedLinkUrl"
                  placeholder="https://www.dropbox.com/scl/fo/..."
                  required
                  className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
                />
                <Button type="submit" variant="secondary">
                  Check this link
                </Button>
              </form>
            </div>

            <form action={updateDropboxBasePath} className="max-w-lg space-y-4">
              <Field
                label="Base folder path"
                htmlFor="basePath"
                hint={
                  'The Dropbox folder that contains your numbered per-project folders (e.g. "/1. Pen Ventures Inc./0.0 LEASING OPERATIONS"). Project folders underneath it must be named "{order}. {project}" — e.g. "1. Killarney23", "2. Glenbrook30" — matching the order this app already lists them in.'
                }
              >
                <Input
                  id="basePath"
                  name="basePath"
                  defaultValue={connection.basePath}
                  placeholder="/1. Pen Ventures Inc./0.0 LEASING OPERATIONS"
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
