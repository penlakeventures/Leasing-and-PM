"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getActiveConnection, resolveSharedLinkPaths } from "@/lib/dropbox";

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
  const leases = await prisma.lease.findMany({
    where: { documentLink: { not: null }, documentsFolderPath: null },
    select: { id: true, documentLink: true },
  });

  if (leases.length === 0) {
    redirect(
      `/settings/dropbox?message=${encodeURIComponent("Nothing to backfill — every lease with a Document link already has a folder on file.")}`,
    );
  }

  let resolved: Map<string, { path: string; isFolder: boolean } | null>;
  try {
    resolved = await resolveSharedLinkPaths(leases.map((l) => l.documentLink as string));
  } catch (e) {
    console.error("[backfillDocumentFolders] resolveSharedLinkPaths failed:", e);
    redirect(
      `/settings/dropbox?error=${encodeURIComponent("Couldn't reach Dropbox — check the connection above and try again.")}`,
    );
  }

  let updated = 0;
  let notFolder = 0;
  let failed = 0;
  for (const lease of leases) {
    const r = resolved.get(lease.documentLink as string);
    if (!r) {
      failed++;
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
  const message = `Checked ${leases.length} lease(s) with a Document link but no folder on file: ${updated} now show their documents in the app${notFolder ? `, ${notFolder} link to a single file rather than a folder (left as-is)` : ""}${failed ? `, ${failed} couldn't be resolved` : ""}.`;
  redirect(`/settings/dropbox?message=${encodeURIComponent(message)}`);
}
