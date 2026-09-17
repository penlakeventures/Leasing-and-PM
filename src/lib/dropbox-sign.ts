import crypto from "crypto";

// A single business-owned API key (console.hellosign.com / Dropbox Sign
// dashboard → API settings), not a per-connection OAuth token — matches
// the Twilio/Anthropic pattern, not the Dropbox-storage/Google-Calendar
// "connect an account" pattern, since there's only ever one Dropbox Sign
// account this app sends from.
function requireApiKey(): string {
  const key = process.env.DROPBOX_SIGN_API_KEY;
  if (!key) throw new Error("DROPBOX_SIGN_API_KEY isn't set in this deployment's environment variables.");
  return key;
}

// A plain account API key (the kind shown under Settings → API keys, as
// opposed to an OAuth app's access token) authenticates as HTTP Basic —
// the key as the username, no password — not Bearer. Confirmed against a
// real "invalid_grant" rejection: Bearer is for an OAuth-issued token,
// which this key structurally isn't.
function authHeader(): string {
  return `Basic ${Buffer.from(`${requireApiKey()}:`).toString("base64")}`;
}

const API_BASE = "https://api.hellosign.com/v3";

// Same reasoning as getSmsWebhookUrl()/getDropboxCallbackUrl(): built from
// NEXTAUTH_URL rather than the incoming request, which isn't reliable
// behind Railway's proxy layer.
export function getSigningWebhookUrl(): string {
  const base = process.env.NEXTAUTH_URL;
  if (!base) {
    throw new Error("NEXTAUTH_URL isn't set — needed to build the Dropbox Sign webhook URL.");
  }
  return `${base.replace(/\/$/, "")}/api/signing/dropbox-sign-webhook`;
}

async function apiCall<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dropbox Sign API call to ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

export type SigningRole = "Landlord" | "Tenant 1" | "Tenant 2";

// Sends one combined signature request built from one or more templates
// (e.g. the lease + the Smoking/Cannabis Addendum together) — every
// template must define the same signer roles, since Dropbox Sign
// resolves one signer per role across the whole combined request. Never
// called directly by anything user-facing except sendLeaseForSignature()
// in src/lib/actions/leases.ts, which is itself only reachable after a
// human has reviewed the merge values — this file never decides what to
// send, only how to send it.
export async function sendForSignature({
  templateIds,
  subject,
  message,
  signers,
  customFields,
  testMode = false,
}: {
  templateIds: string[];
  subject: string;
  message: string;
  signers: { role: SigningRole; name: string; email: string }[];
  customFields: Record<string, string>;
  testMode?: boolean;
}): Promise<{ signatureRequestId: string }> {
  const data = await apiCall<{ signature_request: { signature_request_id: string } }>(
    "/signature_request/send_with_template",
    {
      template_ids: templateIds,
      subject,
      message,
      signers: signers.map((s) => ({ role: s.role, name: s.name, email_address: s.email })),
      custom_fields: Object.entries(customFields).map(([name, value]) => ({ name, value })),
      test_mode: testMode,
    },
  );
  return { signatureRequestId: data.signature_request.signature_request_id };
}

// The final, fully-executed PDF — only call this once a webhook has
// confirmed every signer is done (signature_request_all_signed or
// signature_request_downloadable); calling it right after the last
// signature can race Dropbox Sign's own final-document assembly.
export async function getSignedFile(signatureRequestId: string): Promise<ArrayBuffer> {
  const res = await fetch(
    `${API_BASE}/signature_request/files/${signatureRequestId}?file_type=pdf`,
    { headers: { Authorization: authHeader() } },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch signed file for ${signatureRequestId}: ${res.status} ${text}`);
  }
  return res.arrayBuffer();
}

// Dropbox Sign's own verification scheme: HMAC-SHA256 of event_time +
// event_type (concatenated, no separator) keyed by the API key, compared
// to the event_hash included in the callback payload. Confirms a webhook
// POST actually came from Dropbox Sign and wasn't forged by someone
// hitting this public URL directly — same purpose as
// verifyTwilioSignature() in twilio.ts, different algorithm.
export function verifyDropboxSignWebhook({
  eventTime,
  eventType,
  eventHash,
}: {
  eventTime: string;
  eventType: string;
  eventHash: string;
}): boolean {
  const expected = crypto
    .createHmac("sha256", requireApiKey())
    .update(eventTime + eventType, "utf8")
    .digest("hex");
  return expected === eventHash;
}
