import { prisma } from "@/lib/prisma";

const SCOPE = "https://www.googleapis.com/auth/calendar.events";
export const TOUR_TIMEZONE = "America/Edmonton"; // Calgary — the only timezone this business operates in.
const TOUR_DURATION_MINUTES = 30;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} isn't set in this deployment's environment variables.`);
  return value;
}

// Deriving the app's own public URL from the incoming request
// (req.nextUrl.origin) isn't reliable behind Railway's proxy layer — it
// can resolve to an internal address like https://localhost:8080 rather
// than the real public domain, which Google's OAuth redirect_uri check
// then rejects. NEXTAUTH_URL is already required, already set correctly
// in production (Auth.js depends on it for the same reason), and is the
// one place this app's real public URL is recorded — reuse it instead of
// re-deriving something that's already solved.
export function getCalendarCallbackUrl(): string {
  const base = process.env.NEXTAUTH_URL;
  if (!base) {
    throw new Error("NEXTAUTH_URL isn't set — needed to build the Google OAuth redirect URI.");
  }
  return `${base.replace(/\/$/, "")}/api/calendar/callback`;
}

export function getAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    // Forces Google to hand back a refresh token even on a re-connect —
    // without this, a second consent only returns an access token, and
    // silently leaves the previous (possibly-revoked) refresh token in
    // place looking connected when it no longer works.
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token request failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }>;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  return tokenRequest({
    code,
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
}

export async function getConnectedAccountEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}

export async function getActiveConnection() {
  return prisma.calendarConnection.findFirst({ orderBy: { connectedAt: "desc" } });
}

// Access tokens are short-lived (~1hr); this always trades the stored
// refresh token for a fresh one rather than caching an access token
// anywhere, since tour bookings are infrequent enough that the extra
// round trip is not worth the complexity of a cache that could go stale.
async function getFreshAccessToken(): Promise<string> {
  const connection = await getActiveConnection();
  if (!connection) {
    throw new Error("No Google Calendar account is connected yet.");
  }
  const tokens = await tokenRequest({
    refresh_token: connection.refreshToken,
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
    grant_type: "refresh_token",
  });
  return tokens.access_token;
}

// Combines a "wall clock" local date/time (e.g. from a <input type=
// "datetime-local">, which carries no timezone info at all) with an IANA
// zone to get the correct UTC instant — using only the built-in Intl API
// (which has the full tz database, DST included) rather than pulling in
// a date library for one conversion.
export function localWallClockToUtc(localDateTime: string, timeZone: string): Date {
  const asIfUtc = new Date(`${localDateTime}:00Z`);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(asIfUtc).map((p) => [p.type, p.value]),
  );
  const hour = parts.hour === "24" ? "0" : parts.hour;
  const asIfUtcInterpretedInZone = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offsetMs = asIfUtcInterpretedInZone - asIfUtc.getTime();
  return new Date(asIfUtc.getTime() - offsetMs);
}

export async function createTourEvent({
  startAt,
  summary,
  description,
  location,
  attendeeEmails,
}: {
  startAt: Date;
  summary: string;
  description: string;
  location: string | null;
  attendeeEmails: string[];
}): Promise<string> {
  const accessToken = await getFreshAccessToken();
  const endAt = new Date(startAt.getTime() + TOUR_DURATION_MINUTES * 60_000);

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary,
        description,
        location: location ?? undefined,
        start: { dateTime: startAt.toISOString(), timeZone: TOUR_TIMEZONE },
        end: { dateTime: endAt.toISOString(), timeZone: TOUR_TIMEZONE },
        attendees: attendeeEmails.map((email) => ({ email })),
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create calendar event: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function cancelTourEvent(eventId: string): Promise<void> {
  const accessToken = await getFreshAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  // 410 Gone means it's already deleted (e.g. cancelled from the Google
  // Calendar UI directly) — treat that the same as a successful cancel
  // rather than surfacing an error for something already true.
  if (!res.ok && res.status !== 410 && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Failed to cancel calendar event: ${res.status} ${text}`);
  }
}
