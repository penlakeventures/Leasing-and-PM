import { Card, Field, Input, Button } from "@/components/ui";
import { getSigningSettings, upsertSigningSettings } from "@/lib/actions/signing-settings";
import { getSigningWebhookUrl } from "@/lib/dropbox-sign";

export default async function SigningSettingsPage() {
  const [settings, apiKeyConfigured] = await Promise.all([
    getSigningSettings(),
    Promise.resolve(Boolean(process.env.DROPBOX_SIGN_API_KEY)),
  ]);

  let webhookUrl: string | null = null;
  try {
    webhookUrl = getSigningWebhookUrl();
  } catch {
    webhookUrl = null;
  }

  return (
    <div className="space-y-6">
      <Card>
        {apiKeyConfigured ? (
          <p className="text-sm text-neutral-700">
            API key is set — sending is possible once the template IDs below are filled in.
          </p>
        ) : (
          <p className="text-sm text-neutral-700">
            Not connected yet — set{" "}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">DROPBOX_SIGN_API_KEY</code>{" "}
            in the environment (from your Dropbox Sign account&apos;s API settings page).
          </p>
        )}
        <div className="mt-4">
          <p className="text-sm text-neutral-700">
            In your Dropbox Sign account, under API settings, set the callback/event URL to:
          </p>
          {webhookUrl && (
            <p className="mt-2 break-all rounded-md bg-neutral-100 px-3 py-2 font-mono text-xs text-neutral-800">
              {webhookUrl}
            </p>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-neutral-900">
          Templates &amp; landlord signer
        </h2>
        <p className="mb-4 text-xs text-neutral-500">
          Create these four templates once in the Dropbox Sign dashboard (see the setup guide for
          the exact fields each one needs), then paste their template IDs here.
        </p>
        <form action={upsertSigningSettings} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Landlord signer name" htmlFor="landlordSignerName">
            <Input
              id="landlordSignerName"
              name="landlordSignerName"
              defaultValue={settings?.landlordSignerName ?? ""}
            />
          </Field>
          <Field label="Landlord signer email" htmlFor="landlordSignerEmail">
            <Input
              id="landlordSignerEmail"
              name="landlordSignerEmail"
              type="email"
              defaultValue={settings?.landlordSignerEmail ?? ""}
            />
          </Field>
          <Field
            label="Townhome lease template ID"
            htmlFor="leaseTownhomeTemplateId"
            hint="Utilities are the tenant's responsibility"
          >
            <Input
              id="leaseTownhomeTemplateId"
              name="leaseTownhomeTemplateId"
              defaultValue={settings?.leaseTownhomeTemplateId ?? ""}
            />
          </Field>
          <Field
            label="Suite lease template ID"
            htmlFor="leaseSuiteTemplateId"
            hint="Utilities are included in rent"
          >
            <Input
              id="leaseSuiteTemplateId"
              name="leaseSuiteTemplateId"
              defaultValue={settings?.leaseSuiteTemplateId ?? ""}
            />
          </Field>
          <Field label="Smoking/Cannabis Addendum template ID" htmlFor="smokingAddendumTemplateId">
            <Input
              id="smokingAddendumTemplateId"
              name="smokingAddendumTemplateId"
              defaultValue={settings?.smokingAddendumTemplateId ?? ""}
            />
          </Field>
          <Field
            label="Additional Lease Terms template ID"
            htmlFor="additionalTermsTemplateId"
            hint="Optional"
          >
            <Input
              id="additionalTermsTemplateId"
              name="additionalTermsTemplateId"
              defaultValue={settings?.additionalTermsTemplateId ?? ""}
            />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
