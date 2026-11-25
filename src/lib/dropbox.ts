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

// Lists the immediate subfolders of path. Staff name unit folders as
// "{unit number}{separator}{tenant name(s)}" by hand (e.g. "3220B Taylor",
// "3218B - Kelsey Williamson") — not just the bare unit number — so
// finding a unit's current folder means listing and prefix-matching rather
// than checking one exact path.
async function listSubfolders(
  accessToken: string,
  path: string,
): Promise<{ name: string }[]> {
  const result = await dropboxApiCall<{
    entries: { ".tag": string; name: string }[];
  }>("files/list_folder", accessToken, { path });
  if (!result.ok) {
    // The project folder not existing yet is fine — treat as empty so the
    // caller just creates it fresh; anything else is a real failure.
    if (result.error.includes("path/not_found")) return [];
    throw new Error(`Failed to list Dropbox folder ${path}: ${result.status} ${result.error}`);
  }
  return result.data.entries.filter((e) => e[".tag"] === "folder");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// True if folderName is this unit's folder. Staff-named folders don't
// follow one consistent pattern across projects — some put the unit
// number right at the start ("3220B Taylor"), others lead with a list
// number and the street name instead ("1. 810 14 ST SE - Pen Lake
// Ventures Inc") — so this looks for the unit number as its own
// self-contained token anywhere in the name, using word boundaries so
// e.g. unit "802" can't match inside "802R 14 ST SE - ..." (a different,
// separate unit) and vice versa.
export function matchesUnitFolder(folderName: string, unitNumber: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegExp(unitNumber)}\\b`, "i");
  return pattern.test(folderName);
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
// archives the previous tenant's folder for this unit (if any) into that
// project's "Past tenants" folder, creates a fresh folder for the new
// tenancy, and returns a shared link to it.
//
// Assumes each project's Dropbox folder is named "{displayOrder}.
// {internalName}" (e.g. "1. Killarney23") under the connection's
// configured basePath, and that unit folders inside it are named
// "{unit number}" optionally followed by a space/hyphen and the tenant's
// name(s) (e.g. "3220B Taylor", "3218B - Kelsey Williamson") — all
// confirmed against the owner's actual Dropbox structure.
export async function prepareLeaseFolder({
  projectDisplayOrder,
  projectName,
  unitNumber,
  tenantNames,
}: {
  projectDisplayOrder: number;
  projectName: string;
  unitNumber: string;
  tenantNames: string[];
}): Promise<{ path: string; link: string }> {
  const connection = await getActiveConnection();
  if (!connection) throw new Error("No Dropbox account is connected yet.");
  if (!connection.basePath) throw new Error("Dropbox base folder path isn't set in Settings yet.");

  const accessToken = await getFreshAccessToken();
  const base = connection.basePath.replace(/\/$/, "");
  const projectPath = `${base}/${projectDisplayOrder}. ${projectName}`;
  const pastTenantsPath = `${projectPath}/Past tenants`;

  const existingFolders = (await listSubfolders(accessToken, projectPath)).filter(
    (f) => f.name.toLowerCase() !== "past tenants",
  );
  const priorTenancyFolders = existingFolders.filter((f) =>
    matchesUnitFolder(f.name, unitNumber),
  );

  if (priorTenancyFolders.length === 1) {
    await ensureFolderExists(accessToken, pastTenantsPath);
    const folderName = priorTenancyFolders[0].name;
    await moveWithAutorename(
      accessToken,
      `${projectPath}/${folderName}`,
      `${pastTenantsPath}/${folderName}`,
    );
  } else if (priorTenancyFolders.length > 1) {
    // More than one folder matches this unit number — don't guess which
    // one is the outgoing tenant's; leave archiving to a human and just
    // create the new tenancy's folder alongside them.
    console.warn(
      `[prepareLeaseFolder] ${priorTenancyFolders.length} folders matched unit "${unitNumber}" in ${projectPath} — skipped auto-archive.`,
    );
  }

  const newFolderName = `${unitNumber} ${tenantNames.join(" and ") || "New tenant"}`;
  const newFolderPath = `${projectPath}/${newFolderName}`;
  await ensureFolderExists(accessToken, newFolderPath);
  const link = await getOrCreateSharedLink(accessToken, newFolderPath);
  return { path: newFolderPath, link };
}

export type UnitFolderMatch =
  | { ok: true; path: string; link: string }
  | { ok: false; reason: string };

// Finds each unit's current Dropbox folder directly from the real folder
// structure — the same matching rule prepareLeaseFolder() already uses to
// find the previous tenant's folder when archiving it — instead of
// resolving a saved Document link, for a lease that never had one saved
// to begin with (most of the leases on file predate this app entirely,
// so there's nothing in documentLink to resolve from). Only looks in each
// project's live area (not Past tenants), since this is meant for a
// currently-active lease's current folder, where exactly one match is
// expected; zero or more than one match is reported rather than guessed
// at. One access token is fetched and reused for the whole batch, and
// each project's folder listing is fetched once and reused across every
// unit in it, rather than once per lease.
export async function findUnitFolders(
  requests: { key: string; projectDisplayOrder: number; projectName: string; unitNumber: string }[],
): Promise<Map<string, UnitFolderMatch>> {
  const connection = await getActiveConnection();
  if (!connection?.basePath) {
    throw new Error("Dropbox base folder path isn't set in Settings yet.");
  }
  const accessToken = await getFreshAccessToken();
  const base = connection.basePath.replace(/\/$/, "");
  const results = new Map<string, UnitFolderMatch>();
  const projectFolders = new Map<string, { name: string }[]>();

  for (const r of requests) {
    const projectPath = `${base}/${r.projectDisplayOrder}. ${r.projectName}`;
    let folders = projectFolders.get(projectPath);
    if (!folders) {
      folders = (await listSubfolders(accessToken, projectPath)).filter(
        (f) => f.name.toLowerCase() !== "past tenants",
      );
      projectFolders.set(projectPath, folders);
    }

    const matches = folders.filter((f) => matchesUnitFolder(f.name, r.unitNumber));
    if (matches.length === 0) {
      results.set(r.key, { ok: false, reason: `No folder in "${r.projectDisplayOrder}. ${r.projectName}" matched unit "${r.unitNumber}".` });
    } else if (matches.length > 1) {
      results.set(r.key, {
        ok: false,
        reason: `${matches.length} folders in "${r.projectDisplayOrder}. ${r.projectName}" matched unit "${r.unitNumber}" — ambiguous.`,
      });
    } else {
      const path = `${projectPath}/${matches[0].name}`;
      const link = await getOrCreateSharedLink(accessToken, path);
      results.set(r.key, { ok: true, path, link });
    }
  }

  return results;
}

export type ResolvedSharedLink =
  | { ok: true; path: string; isFolder: boolean }
  | { ok: false; error: string };

// The reverse of getOrCreateSharedLink() above: given a shared link
// someone already has (e.g. a lease's documentLink, however it got
// there — pasted in by hand, or from before this app ever auto-created a
// folder), resolves it back to the real internal Dropbox path behind it.
// That path is what every other Dropbox call in this file needs
// (files/list_folder, files/download, files/upload all take a path, not
// a shared link) — used to backfill documentsFolderPath on leases that
// already have a Document link but no folder path on file yet, so the
// in-app Documents list can work for them too, not just leases created
// after the folder-path field existed. One access token is fetched and
// reused for the whole batch rather than per link, since this is meant
// to run over every lease that needs it in one pass. Keeps Dropbox's own
// error text on a failed lookup (rather than collapsing it to a bare
// null) — the backfill action surfaces it directly, since there's no one
// positioned to go digging through server logs for it.
export async function resolveSharedLinkPaths(
  urls: string[],
): Promise<Map<string, ResolvedSharedLink>> {
  const accessToken = await getFreshAccessToken();
  const results = new Map<string, ResolvedSharedLink>();
  for (const url of urls) {
    if (results.has(url)) continue; // duplicate links on file resolve once
    const result = await dropboxApiCall<{ ".tag": string; path_lower?: string }>(
      "sharing/get_shared_link_metadata",
      accessToken,
      { url },
    );
    if (result.ok && result.data.path_lower) {
      results.set(url, { ok: true, path: result.data.path_lower, isFolder: result.data[".tag"] === "folder" });
    } else if (result.ok) {
      results.set(url, { ok: false, error: "Dropbox didn't return a path for this link." });
    } else {
      results.set(url, { ok: false, error: `${result.status}: ${result.error}` });
    }
  }
  return results;
}

export type DropboxFileEntry = {
  name: string;
  path: string;
  size: number;
  serverModified: string;
};

// Lists the files (not subfolders) directly inside path — e.g. a lease's
// documentsFolderPath — so the app can show and serve them itself instead
// of only linking out to the shared folder.
export async function listFiles(path: string): Promise<DropboxFileEntry[]> {
  const accessToken = await getFreshAccessToken();
  const result = await dropboxApiCall<{
    entries: {
      ".tag": string;
      name: string;
      path_display?: string;
      size?: number;
      server_modified?: string;
    }[];
  }>("files/list_folder", accessToken, { path });
  if (!result.ok) {
    // The folder not existing (yet, or anymore) isn't a real error here —
    // just nothing to show.
    if (result.error.includes("path/not_found")) return [];
    throw new Error(`Failed to list Dropbox folder ${path}: ${result.status} ${result.error}`);
  }
  return result.data.entries
    .filter((e) => e[".tag"] === "file")
    .map((e) => ({
      name: e.name,
      path: e.path_display ?? `${path}/${e.name}`,
      size: e.size ?? 0,
      serverModified: e.server_modified ?? "",
    }));
}

// Downloads one file's raw bytes straight from Dropbox, server-side — the
// read counterpart to uploadFile() below, used to let staff view or
// download a lease's actual documents from inside the app instead of
// opening Dropbox itself.
export async function downloadFile(path: string): Promise<ArrayBuffer> {
  const accessToken = await getFreshAccessToken();
  const res = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Dropbox-API-Arg": JSON.stringify({ path }),
    },
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to download ${path} from Dropbox: ${res.status} ${error}`);
  }
  return res.arrayBuffer();
}

// Uploads a file straight into an already-created lease folder (e.g. a
// SingleKey report once an applicant's approved and has a tenant file) —
// the one place this app writes file *content* to Dropbox rather than
// just managing folders and links; everything else here is still staff
// dragging the actual document in themselves. autorename avoids clobbering
// something already sitting at that exact filename.
export async function uploadFile({
  path,
  filename,
  content,
}: {
  path: string;
  filename: string;
  content: ArrayBuffer;
}): Promise<void> {
  const accessToken = await getFreshAccessToken();
  const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: `${path}/${filename}`,
        mode: "add",
        autorename: true,
        mute: false,
      }),
    },
    body: content,
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to upload ${filename} to Dropbox: ${res.status} ${error}`);
  }
}
