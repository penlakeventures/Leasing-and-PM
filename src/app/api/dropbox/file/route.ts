import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { downloadFile } from "@/lib/dropbox";

function contentTypeFor(filename: string): string {
  switch (filename.toLowerCase().split(".").pop()) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return "application/octet-stream";
  }
}

// Streams one file's bytes straight from Dropbox through the app, so
// staff can open or download a lease document without needing their own
// Dropbox login. Gated to files inside that *specific* lease's own
// documentsFolderPath (not an arbitrary Dropbox path passed in by the
// caller) so a signed-in staff member can't use this endpoint to read the
// rest of the connected Dropbox account.
export async function GET(req: NextRequest) {
  const leaseId = req.nextUrl.searchParams.get("leaseId");
  const path = req.nextUrl.searchParams.get("path");
  const mode = req.nextUrl.searchParams.get("mode") === "download" ? "download" : "view";
  if (!leaseId || !path) {
    return NextResponse.json({ error: "Missing leaseId or path." }, { status: 400 });
  }

  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    select: { documentsFolderPath: true },
  });
  const folder = lease?.documentsFolderPath;
  if (!folder || (path !== folder && !path.startsWith(`${folder}/`))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const content = await downloadFile(path);
    const filename = path.split("/").pop() || "document";
    // "view"/"download" aren't real Content-Disposition types — only
    // "inline" and "attachment" are, and sending anything else leaves the
    // browser to guess, which in practice meant View always downloaded
    // too.
    const disposition = mode === "download" ? "attachment" : "inline";
    return new NextResponse(content, {
      headers: {
        "Content-Type": contentTypeFor(filename),
        "Content-Disposition": `${disposition}; filename="${filename.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[api/dropbox/file]", e);
    return NextResponse.json({ error: "Couldn't reach Dropbox." }, { status: 502 });
  }
}
