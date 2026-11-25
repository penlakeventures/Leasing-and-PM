import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listFiles } from "@/lib/dropbox";

// Behind normal login (proxy.ts doesn't exempt this path) — lists the
// files inside one specific lease's Dropbox folder, for the in-app
// Documents list (src/components/lease-documents.tsx) to render.
export async function GET(req: NextRequest) {
  const leaseId = req.nextUrl.searchParams.get("leaseId");
  if (!leaseId) {
    return NextResponse.json({ error: "Missing leaseId." }, { status: 400 });
  }

  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    select: { documentsFolderPath: true },
  });
  if (!lease?.documentsFolderPath) {
    return NextResponse.json({ files: [] });
  }

  try {
    const files = await listFiles(lease.documentsFolderPath);
    return NextResponse.json({ files });
  } catch (e) {
    console.error("[api/dropbox/files]", e);
    return NextResponse.json({ error: "Couldn't reach Dropbox." }, { status: 502 });
  }
}
