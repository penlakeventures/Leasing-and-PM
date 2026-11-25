"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getActiveConnection,
  resolveSharedLinkPaths,
  findUnitFolders,
  type ResolvedSharedLink,
  type UnitFolderMatch,
} from "@/lib/dropbox";

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
    const shown = failures.slice(0, 10);
    message += ` Reasons: ${shown.join(" | ")}${failures.length > shown.length ? ` | …and ${failures.length - shown.length} more` : ""}`;
  }
  redirect(`/settings/dropbox?message=${encodeURIComponent(message)}`);
}

// A second pass for leases that never had a Document link saved at all
// (most of the real leases on file predate this app entirely, so there
// was never a link in documentLink for backfillDocumentFolders above to
// resolve from) — matches each currently-active lease straight to its
// unit's real Dropbox folder, using the same folder-name matching rule
// prepareLeaseFolder() already trusts when archiving a previous tenant's
// folder. Deliberately scoped to active leases (started, and periodic or
// not yet ended) rather than every lease ever — an ended lease's
// documents, if still on file at all, usually moved into that project's
// "Past tenants" folder under the outgoing tenant's own name, which needs
// matching by tenant name as well as unit number to avoid guessing wrong
// when a unit has had several past tenancies; that's a separate, later
// pass if it's wanted. Safe to run more than once.
export async function backfillActiveLeaseFoldersFromStructure() {
  const now = new Date();
  const leases = await prisma.lease.findMany({
    where: {
      documentsFolderPath: null,
      startDate: { lte: now },
      OR: [{ periodic: true }, { endDate: null }, { endDate: { gte: now } }],
    },
    select: {
      id: true,
      unit: {
        select: {
          unitNumber: true,
          projectEntity: { select: { displayOrder: true, internalName: true } },
        },
      },
    },
  });

  if (leases.length === 0) {
    redirect(
      `/settings/dropbox?message=${encodeURIComponent("Nothing to backfill — every currently-active lease already has a folder on file.")}`,
    );
  }

  let resolved: Map<string, UnitFolderMatch>;
  try {
    resolved = await findUnitFolders(
      leases.map((l) => ({
        key: l.id,
        projectDisplayOrder: l.unit.projectEntity.displayOrder,
        projectName: l.unit.projectEntity.internalName,
        unitNumber: l.unit.unitNumber,
      })),
    );
  } catch (e) {
    console.error("[backfillActiveLeaseFoldersFromStructure] findUnitFolders failed:", e);
    const detail = e instanceof Error ? e.message : String(e);
    redirect(`/settings/dropbox?error=${encodeURIComponent(`Couldn't reach Dropbox: ${detail}`)}`);
  }

  let updated = 0;
  const failures: string[] = [];
  for (const lease of leases) {
    const r = resolved.get(lease.id);
    if (!r) {
      failures.push("no result returned");
    } else if (!r.ok) {
      failures.push(r.reason);
    } else {
      await prisma.lease.update({
        where: { id: lease.id },
        data: { documentsFolderPath: r.path, documentLink: r.link },
      });
      updated++;
    }
  }

  revalidatePath("/settings/dropbox");
  revalidatePath("/leases");
  let message = `Checked ${leases.length} active lease(s) with no folder on file: ${updated} matched to a Dropbox folder by unit number and now show their documents in the app${failures.length ? `, ${failures.length} couldn't be matched` : ""}.`;
  if (failures.length > 0) {
    // All of them once the count's small enough to actually read, rather
    // than only the first — after the first run or two, what's left is
    // usually a short list of genuinely odd cases worth seeing all at once
    // instead of fixing and re-clicking one at a time.
    const shown = failures.slice(0, 10);
    message += ` Reasons: ${shown.join(" | ")}${failures.length > shown.length ? ` | …and ${failures.length - shown.length} more` : ""}`;
  }
  redirect(`/settings/dropbox?message=${encodeURIComponent(message)}`);
}

// A one-off diagnostic: given any Dropbox shared link pasted in, resolves
// it to the real internal path behind it using the app's own connected
// account — the same lookup the backfill above runs in bulk, exposed here
// for checking a single link by hand. Useful for confirming the app is
// actually pointed at the right Dropbox folder (the one every lease
// document really lives in, not a different one that happens to look
// similar) before trusting a bulk run against it.
export async function resolveSharedLink(formData: FormData) {
  const url = (formData.get("sharedLinkUrl") as string)?.trim();
  if (!url) redirect("/settings/dropbox");

  // redirect() works by throwing internally — both outcomes below have to
  // land outside this try block, or the success path's own redirect would
  // get caught by the catch meant for a real Dropbox failure.
  let message: string;
  try {
    const resolved = await resolveSharedLinkPaths([url]);
    const r = resolved.get(url);
    message = !r
      ? "Got no result back for that link."
      : r.ok
        ? `Resolves to: ${r.path} (${r.isFolder ? "a folder" : "a single file"})`
        : `Couldn't resolve that link: ${r.error}`;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    redirect(`/settings/dropbox?error=${encodeURIComponent(`Couldn't reach Dropbox: ${detail}`)}`);
  }
  redirect(`/settings/dropbox?message=${encodeURIComponent(message)}`);
}
