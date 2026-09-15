import crypto from "crypto";

// Meta signs every webhook POST body with the app secret so a receiver can
// confirm it actually came from Meta and wasn't spoofed by a third party
// hitting this public URL directly. Verification has to run against the
// exact raw bytes Meta sent — parsing to JSON and re-serializing before
// checking the signature would silently break this the moment formatting
// differs even slightly (key order, whitespace), so callers must pass the
// untouched request body text.
export function verifyMessengerSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader) return false;
  const [scheme, providedHex] = signatureHeader.split("=");
  if (scheme !== "sha256" || !providedHex) return false;

  const expectedHex = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  const provided = Buffer.from(providedHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}

export type MessengerTextMessage = {
  psid: string;
  mid: string;
  text: string;
  timestamp: number;
};

// Pulls out just the plain-text messages from Meta's webhook payload —
// skips delivery receipts, read receipts, postbacks, and anything else
// without an actual message.text, since those aren't leads to capture.
export function parseMessengerPayload(body: unknown): MessengerTextMessage[] {
  const messages: MessengerTextMessage[] = [];
  if (
    typeof body !== "object" ||
    body === null ||
    (body as { object?: string }).object !== "page"
  ) {
    return messages;
  }

  const entries = (body as { entry?: unknown }).entry;
  if (!Array.isArray(entries)) return messages;

  for (const entry of entries) {
    const messaging = (entry as { messaging?: unknown })?.messaging;
    if (!Array.isArray(messaging)) continue;

    for (const event of messaging) {
      const psid = (event as { sender?: { id?: string } })?.sender?.id;
      const message = (event as { message?: { mid?: string; text?: string } })
        ?.message;
      const timestamp = (event as { timestamp?: number })?.timestamp;
      if (!psid || !message?.mid || !message?.text) continue;
      messages.push({
        psid,
        mid: message.mid,
        text: message.text,
        timestamp: timestamp ?? Date.now(),
      });
    }
  }

  return messages;
}

// Best-effort: Messenger's webhook payload only ever includes the sender's
// page-scoped ID, never their name — a separate Graph API call is needed,
// and even that isn't guaranteed to return one (Meta has tightened what's
// available here over time). Never let this fail the whole webhook; a
// lead with no name is far better than a dropped lead.
export async function fetchMessengerSenderName(
  psid: string,
  pageAccessToken: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${psid}?fields=first_name,last_name&access_token=${encodeURIComponent(pageAccessToken)}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      first_name?: string;
      last_name?: string;
    };
    const name = [data.first_name, data.last_name].filter(Boolean).join(" ");
    return name || null;
  } catch {
    return null;
  }
}
