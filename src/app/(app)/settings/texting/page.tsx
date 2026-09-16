import { Card } from "@/components/ui";
import { getSmsWebhookUrl } from "@/lib/twilio";

export default function TextingSettingsPage() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  const configured = Boolean(accountSid && authToken && phoneNumber);

  let webhookUrl: string | null = null;
  try {
    webhookUrl = getSmsWebhookUrl();
  } catch {
    webhookUrl = null;
  }

  return (
    <div>
      <Card>
        <div className="space-y-4">
          {configured ? (
            <p className="text-sm text-neutral-700">
              Texting is connected — sending and receiving as{" "}
              <span className="font-medium">{phoneNumber}</span>. Texts show
              up automatically on the matching tenant&apos;s or lead&apos;s
              page (an unrecognized number becomes a new lead), and you reply
              from there — there&apos;s nothing to do on this page day to day.
            </p>
          ) : (
            <p className="text-sm text-neutral-700">
              Texting isn&apos;t connected yet — set{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">
                TWILIO_ACCOUNT_SID
              </code>
              ,{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">
                TWILIO_AUTH_TOKEN
              </code>
              , and{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">
                TWILIO_PHONE_NUMBER
              </code>{" "}
              in the environment.
            </p>
          )}
          <div>
            <p className="text-sm text-neutral-700">
              In the Twilio Console, under your phone number&apos;s Messaging
              configuration, set &quot;A message comes in&quot; to this
              webhook URL:
            </p>
            {webhookUrl && (
              <p className="mt-2 break-all rounded-md bg-neutral-100 px-3 py-2 font-mono text-xs text-neutral-800">
                {webhookUrl}
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
