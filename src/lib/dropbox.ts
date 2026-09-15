import { prisma } from "@/lib/prisma";

// Full Dropbox access (not an app-only sandbox folder) — this app reads
// and writes inside the owner's existing, already-organized Dropbox, not a
// folder of its own.
const SCOPE = [
  "account_info.read",
  "files.metadata.read",
  "files.metadata.write",
  "files.content.read",
  "files.content.write",
  "sharing.read",
  "sharing.write",
].join(" ");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} isn't set in this deployment's environment variables.`);
  return value;
}

// Same reasoning as getCalendarCallbackUrl() in google-calendar.ts: deriving
// this from the incoming request isn't reliable behind Railway's proxy
// layer, so it's built from NEXTAUTH_URL (already required, already correct
// in production) instead.
export function getDropboxCallbackUrl(): string {
  const base = process.env.NEXTAUTH_URL;
  if (!base) {
    throw new Error("NEXTAUTH_URL isn't set — needed to build the Dropbox OAuth redirect URI.");
  }
  return `${base.replace(/\/$/, "")}/api/dropbox/callback`;
}

export function getAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("DROPBOX_APP_KEY"),
    redirect_uri: redirectUri,
    response_type: "code",
    token_access_type: "offline", // asks for a refresh token, not just a short-lived access token
    scope: SCOPE,
  });
  return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dropbox token request failed: ${res.status} ${text}`);
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
    client_id: requireEnv("DROPBOX_APP_KEY"),
    client_secret: requireEnv("DROPBOX_APP_SECRET"),
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
}

export async function getConnectedAccountEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}

export async function getActiveConnection() {
  return prisma.dropboxConnection.findFirst({ orderBy: { connectedAt: "desc" } });
}

async function getFreshAccessToken(): Promise<string> {
  const connection = await getActiveConnection();
  if (!connection) {
    throw new Error("No Dropbox account is connected yet.");
  }
  const tokens = await tokenRequest({
    refresh_token: connection.refreshToken,
    client_id: requireEnv("DROPBOX_APP_KEY"),
    client_secret: requireEnv("DROPBOX_APP_SECRET"),
    grant_type: "refresh_token",
  });
  return tokens.access_token;
}

async function dropboxApiCall<T>(
  endpoint: string,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const res = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  return { ok: true, data: (await res.json()) as T };
}

// Creates a folder, treating "it's already there" as success rather than an
// error — a unit's folder legitimately persists across the app restarting
// it fresh for each new tenancy check.
async function ensureFolderExists(accessToken: string, path: string): Promise<void> {
  const result = await dropboxApiCall("files/create_folder_v2", accessToken, { path });
  if (!result.ok && !result.error.includes("path/conflict/folder")) {
    throw new Error(`Failed to create Dropbox folder ${path}: ${result.status} ${result.error}`);
  }
}

async function pathExists(accessToken: string, path: string): Promise<boolean> {
  const result = await dropboxApiCall("files/get_metadata", accessToken, { path });
  return result.ok;
}

// Moves fromPath to toPath, auto-renaming (Dropbox appends " (1)", " (2)",
// etc.) if something's already sitting at toPath — this happens when a
// unit has already had more than one past tenancy archived.
async function moveWithAutorename(
  accessToken: string,
  fromPath: string,
  toPath: string,
): Promise<void> {
  const result = await dropboxApiCall("files/move_v2", accessToken, {
    from_path: fromPath,
    to_path: toPath,
    autorename: true,
  });
  if (!result.ok) {
    throw new Error(`Failed to archive Dropbox folder ${fromPath}: ${result.status} ${result.error}`);
  }
}

// Returns a shareable link for path, reusing one that already exists
// instead of erroring (Dropbox rejects creating a second link for the same
// file/folder).
async function getOrCreateSharedLink(accessToken: string, path: string): Promise<string> {
  const create = await dropboxApiCall<{ url: string }>(
    "sharing/create_shared_link_with_settings",
    accessToken,
    { path },
  );
  if (create.ok) return create.data.url;

  if (create.error.includes("shared_link_already_exists")) {
    const list = await dropboxApiCall<{ links: { url: string }[] }>(
      "sharing/list_shared_links",
      accessToken,
      { path, direct_only: true },
    );
    if (list.ok && list.data.links[0]) return list.data.links[0].url;
  }
  throw new Error(`Failed to get a shared link for ${path}: ${create.status} ${create.error}`);
}

// The one entry point the rest of the app calls, on new-lease creation:
// archives whatever's currently in the unit's live folder (a previous
// tenancy's documents, if any) into that project's "PAST TENANTS" folder,
// creates a fresh empty folder for the new tenancy, and returns a shared
// link to it. Assumes each project's Dropbox folder is named to exactly
// match its internalName (e.g. "Killarney23") under the connection's
// configured basePath.
export async function prepareLeaseFolder({
  projectName,
  unitNumber,
}: {
  projectName: string;
  unitNumber: string;
}): Promise<string> {
  const connection = await getActiveConnection();
  if (!connection) throw new Error("No Dropbox account is connected yet.");
  if (!connection.basePath) throw new Error("Dropbox base folder path isn't set in Settings yet.");

  const accessToken = await getFreshAccessToken();
  const base = connection.basePath.replace(/\/$/, "");
  const unitPath = `${base}/${projectName}/${unitNumber}`;
  const pastTenantsPath = `${base}/${projectName}/PAST TENANTS/${unitNumber}`;

  if (await pathExists(accessToken, unitPath)) {
    await ensureFolderExists(accessToken, `${base}/${projectName}/PAST TENANTS`);
    await moveWithAutorename(accessToken, unitPath, pastTenantsPath);
  }

  await ensureFolderExists(accessToken, unitPath);
  return getOrCreateSharedLink(accessToken, unitPath);
}
