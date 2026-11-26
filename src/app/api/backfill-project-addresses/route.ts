import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// One-time fixup: every project's Address field held a composite string
// covering all of its units' own streets (e.g. Killarney23's "3760, 3764,
// 3768 23 AVE SW & 2240 37th ST SW, Killarney, Calgary, AB") — now that
// unit addresses are fully tracked under Leases, the owner wants this
// column to instead show the single civic address the City of Calgary
// assigns the project as a whole (e.g. for permits), which is a different
// address than any unit's. Same pattern as /api/backfill-signed-dates:
// protected by normal login (src/proxy.ts), just visit this URL while
// signed in. Safe to run more than once — each project is only ever set
// to its own fixed value below.
const PROJECT_ADDRESSES: Record<string, string> = {
  Killarney23: "3756 23 Avenue Southwest",
  Glenbrook30: "3912 30th Avenue Southwest",
  Killarney26: "3216 26th Ave Southwest",
  Killarney25: "3112 25th Avenue Southwest",
  Killarney27: "2740 23rd Avenue Southwest",
  Inglewood14: "812 14th Street Southeast",
  Shaganappi31: "1732 31st Street Southwest",
};

export async function GET() {
  try {
    const log: string[] = [];

    for (const [internalName, address] of Object.entries(PROJECT_ADDRESSES)) {
      const result = await prisma.projectEntity.updateMany({
        where: { internalName },
        data: { address },
      });
      log.push(
        result.count > 0
          ? `${internalName}: address set to "${address}".`
          : `${internalName}: no project found with this internal name — skipped.`,
      );
    }

    return NextResponse.json({ ok: true, log });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
