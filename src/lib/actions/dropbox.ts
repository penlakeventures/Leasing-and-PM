"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getActiveConnection, resolveSharedLinkPaths, type ResolvedSharedLink } from "@/lib/dropbox";

export async function disconnectDropbox() {
  await prisma.dropboxConnection.deleteMany({});
  revalidatePath("/settings/dropbox");
  redirect("/settings/dropbox");
}

export async function updateDropboxBasePath(formData: FormData) {
  const basePath = (formData.get("basePath") as string)?.trim() || "";
  const connection = await getActiveConnection();
  if (!connection) redirect("/settings/dropbox");

  await prisma.dropboxConnection.update({
    where: { id: connection.id },
    data: { basePath: basePath.replace(/\/$/, "") },
  });

  revalidatePath("/settings/dropbox");
  redirect("/settings/dropbox");
}

// One-time fixup for every lease that has a Document link on file (set
// before documentsFolderPath existed, or pasted in by hand) but no
// internal folder path yet — without that path, the in-app Documents
// list (src/components/lease-documents.tsx) has nothing to call
// files/list_folder or files/download against, so those leases just show
// "No Dropbox folder linked yet" even though a link clearly exists.
// Resolves each link back to its real Dropbox path and stores it. Safe
// to run more than once — only ever touches leases where
// documentsFolderPath is still null.
export async function backfillDocumentFolders() {
  // Reported alongside the backfill result below — context for "only N
  // needed backfilling" that isn't obvious from that number alone: most
  // leases may simply never have had a Document link saved at all, which
  // this action can't do anything about (there's no link to resolve).
  const [totalLeases, withLink, leases] = await Promise.all([
    prisma.lease.count(),
    prisma.lease.count({ where: { documentLink: { not: null } } }),
    prisma.lease.findMany({
      where: { documentLink: { not: null }, documentsFolderPath: null },
      select: { id: true, documentLink: true },
    }),
  ]);

  if (leases.length === 0) {
    const message =
      withLink === 0
        ? `None of the ${totalLeases} lease(s) on file have a Document link saved — there's nothing for this to resolve. A Document link has to be added to a lease (its own page, or pasted in by hand) before its documents can show up here.`
        : `Nothing to backfill — every lease with a Document link (${withLink} of ${totalLeases}) already has a folder on file.`;
    redirect(`/settings/dropbox?message=${encodeURIComponent(message)}`);
  }

  let resolved: Map<string, ResolvedSharedLink>;
  try {
    resolved = await resolveSharedLinkPaths(leases.map((l) => l.documentLink as string));
  } catch (e) {
    console.error("[backfillDocumentFolders] resolveSharedLinkPaths failed:", e);
    // The underlying message (not just "couldn't reach Dropbox") is shown
    // directly rather than logged-only — there's no one here who'd go
    // looking at Railway's logs, so the error banner has to be the
    // diagnostic.
    const detail = e instanceof Error ? e.message : String(e);
    redirect(
      `/settings/dropbox?error=${encodeURIComponent(`Couldn't reach Dropbox: ${detail}`)}`,
    );
  }

  let updated = 0;
  let notFolder = 0;
  const failures: string[] = [];
  for (const lease of leases) {
    const r = resolved.get(lease.documentLink as string);
    if (!r) {
      failures.push("no result returned");
    } else if (!r.ok) {
      failures.push(r.error);
    } else if (!r.isFolder) {
      // A link to a single file rather than a folder — nothing to list,
      // so leave it as a plain Document link instead of pointing
      // documentsFolderPath at one file.
      notFolder++;
    } else {
      await prisma.lease.update({
        where: { id: lease.id },
        data: { documentsFolderPath: r.path },
      });
      updated++;
    }
  }

  revalidatePath("/settings/dropbox");
  revalidatePath("/leases");
  let message = `Checked ${leases.length} lease(s) with a Document link but no folder on file (out of ${withLink} with a link, ${totalLeases} total): ${updated} now show their documents in the app${notFolder ? `, ${notFolder} link to a single file rather than a folder (left as-is)` : ""}${failures.length ? `, ${failures.length} couldn't be resolved` : ""}.`;
  if (failures.length > 0) {
    message += ` First reason: ${failures[0]}`;
  }
  redirect(`/settings/dropbox?message=${encodeURIComponent(message)}`);
}
