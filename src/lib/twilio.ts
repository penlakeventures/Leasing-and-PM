import crypto from "crypto";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} isn't set in this deployment's environment variables.`);
  return value;
}

// Same reasoning as getCalendarCallbackUrl()/getDropboxCallbackUrl(): the
// incoming request's own URL isn't reliable behind Railway's proxy layer,
// and Twilio's signature check needs the *exact* public URL it was told to
// call — built from NEXTAUTH_URL, not the request, so it can never drift
// from what's actually configured in the Twilio console.
export function getSmsWebhookUrl(): string {
  const base = process.env.NEXTAUTH_URL;
  if (!base) {
    throw new Error("NEXTAUTH_URL isn't set — needed to build the Twilio webhook URL.");
  }
  return `${base.replace(/\/$/, "")}/api/sms/twilio-webhook`;
}

// Twilio's own request-validation algorithm: sort the POST params by key,
// concatenate each key+value directly onto the webhook URL (no
// separators), HMAC-SHA1 that with the Auth Token, base64-encode it, and
// compare to the X-Twilio-Signature header. This is how a receiver
// confirms a request actually came from Twilio and wasn't forged by
// someone hitting this public URL directly.
export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signatureHeader: string | null,
  authToken: string,
): boolean {
  if (!signatureHeader) return false;

  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  const expected = crypto.createHmac("sha1", authToken).update(data, "utf8").digest("base64");

  const provided = Buffer.from(signatureHeader);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(provided, expectedBuf);
}

export async function sendSms({ to, body }: { to: string; body: string }): Promise<string> {
  const accountSid = requireEnv("TWILIO_ACCOUNT_SID");
  const authToken = requireEnv("TWILIO_AUTH_TOKEN");
  const from = requireEnv("TWILIO_PHONE_NUMBER");

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio send failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { sid: string };
  return data.sid;
}
