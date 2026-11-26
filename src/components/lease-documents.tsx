"use client";

import { useEffect, useState } from "react";

export type DropboxFileEntry = {
  name: string;
  path: string;
  size: number;
  serverModified: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Matches exactly the file types /api/dropbox/file gives a real,
// browser-renderable Content-Type for (see contentTypeFor there) —
// anything else, a Word document above all, downloads no matter what the
// response headers say, since browsers have no built-in way to display
// it inline. A "View" link for one of those would just be a second
// Download link in disguise, so it's left out entirely rather than
// offered and then not actually doing what it says.
export function isViewableInBrowser(filename: string): boolean {
  const ext = filename.toLowerCase().split(".").pop();
  return ext === "pdf" || ext === "png" || ext === "jpg" || ext === "jpeg";
}

function FileRow({ leaseId, file }: { leaseId: string; file: DropboxFileEntry }) {
  const base = `/api/dropbox/file?leaseId=${leaseId}&path=${encodeURIComponent(file.path)}`;
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-sm">
      <span className="truncate" title={file.name}>
        {file.name}
      </span>
      <span className="flex shrink-0 items-center gap-3 text-xs">
        <span className="text-neutral-400">{formatSize(file.size)}</span>
        {isViewableInBrowser(file.name) && (
          <a href={`${base}&mode=view`} target="_blank" rel="noopener noreferrer" className="underline">
            View
          </a>
        )}
        <a href={`${base}&mode=download`} className="underline">
          Download
        </a>
      </span>
    </div>
  );
}

// Shared fetch-on-demand logic behind both variants below — `enabled`
// gates the actual Dropbox call so a page listing many leases (the Leases
// list, a tenant's Leases table) doesn't fire one API call per row just
// from rendering; it only loads once a given row is actually opened.
// `reloadKey` lets the "Try again" button re-run the same effect. State
// starts, and stays, "idle" until the fetch settles — which the caller
// (not enabled yet, or enabled but still in flight) both render as
// "Loading…", so there's no separate synchronous "loading" setState to
// fire from inside the effect itself.
function useLeaseFiles(leaseId: string, enabled: boolean) {
  const [state, setState] = useState<"idle" | "loaded" | "error">("idle");
  const [files, setFiles] = useState<DropboxFileEntry[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch(`/api/dropbox/files?leaseId=${leaseId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Request failed");
        if (!cancelled) {
          setFiles(data.files);
          setState("loaded");
        }
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, leaseId, reloadKey]);

  return { state, files, reload: () => setReloadKey((k) => k + 1) };
}

function FileList({
  leaseId,
  state,
  files,
  reload,
}: {
  leaseId: string;
  state: "idle" | "loaded" | "error";
  files: DropboxFileEntry[];
  reload: () => void;
}) {
  if (state === "idle") {
    return <p className="py-1 text-sm text-neutral-500">Loading files…</p>;
  }
  if (state === "error") {
    return (
      <p className="py-1 text-sm text-red-600">
        Couldn&apos;t reach Dropbox.{" "}
        <button type="button" onClick={reload} className="underline">
          Try again
        </button>
      </p>
    );
  }
  if (files.length === 0) {
    return <p className="py-1 text-sm text-neutral-500">No files in this folder yet.</p>;
  }
  return (
    <div className="divide-y divide-neutral-100">
      {files.map((f) => (
        <FileRow key={f.path} leaseId={leaseId} file={f} />
      ))}
    </div>
  );
}

// Always-expanded list — used on the lease's own page, where there's
// plenty of room and the documents are the main thing staff came to see.
export function LeaseDocumentsFull({ leaseId, hasFolder }: { leaseId: string; hasFolder: boolean }) {
  const { state, files, reload } = useLeaseFiles(leaseId, hasFolder);
  if (!hasFolder) return null;
  return <FileList leaseId={leaseId} state={state} files={files} reload={reload} />;
}

// Collapsed-by-default "Documents" link used inline in a table row (the
// Leases list, a tenant's own Leases table) — nothing is fetched from
// Dropbox until the row is actually opened.
export function LeaseDocumentsCompact({ leaseId, hasFolder }: { leaseId: string; hasFolder: boolean }) {
  const [open, setOpen] = useState(false);
  const { state, files, reload } = useLeaseFiles(leaseId, open);

  if (!hasFolder) return <span className="text-neutral-400">—</span>;

  return (
    <details onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer text-sm text-neutral-900 underline [&::-webkit-details-marker]:hidden">
        Documents
      </summary>
      <div className="mt-1 w-72 rounded-md border border-neutral-200 bg-white p-2 shadow-sm">
        <FileList leaseId={leaseId} state={state} files={files} reload={reload} />
      </div>
    </details>
  );
}
