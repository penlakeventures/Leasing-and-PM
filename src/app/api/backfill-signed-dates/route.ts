import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// One-time fixup: every lease imported from the lease-expiry tracker (or
// created before this app tracked a Signed date at all) has signedDate
// still null, so the Leases list shows it as "Unsigned" even though it's
// a real, already-signed lease for an existing tenant — the import never
// had a signed-date column to pull from. There's no real signed date on
// file to recover for these, so this backfills the closest reasonable
// stand-in (the lease's own start date — paperwork is normally signed at
// or before move-in) for every lease still missing one. Same pattern as
// /api/import-rent-roll: protected by normal login (src/proxy.ts), just
// visit this URL while signed in. Safe to run more than once — it only
// ever touches a lease that's still missing a signed date.
export async function GET() {
  try {
    const leases = await prisma.lease.findMany({
      where: { signedDate: null },
      select: { id: true, startDate: true },
    });

    for (const lease of leases) {
      await prisma.lease.update({
        where: { id: lease.id },
        data: { signedDate: lease.startDate },
      });
    }

    return NextResponse.json({
      ok: true,
      log: [`Backfilled a Signed date (= Start date) for ${leases.length} lease(s) that had none on file.`],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
