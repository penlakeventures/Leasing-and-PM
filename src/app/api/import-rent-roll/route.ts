import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runRentRollImport } from "@/lib/rent-roll-import";

// Unlike /api/seed, this doesn't need its own token — by the time this
// runs, real user accounts exist, so it's protected by normal login
// (src/proxy.ts) like every other route. Just visit this URL while
// signed in.
export async function GET() {
  try {
    const log = await runRentRollImport(prisma);
    return NextResponse.json({ ok: true, log });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
