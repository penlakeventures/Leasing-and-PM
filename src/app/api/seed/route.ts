import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runSeed } from "@/lib/seed-data";

// One-time bootstrap endpoint: loads the real 7-project portfolio + the two
// user accounts. Exists as a plain browser-visitable URL (instead of
// requiring `railway run npm run db:seed` from a local terminal) because
// there's a chicken-and-egg problem otherwise — the app has no users yet,
// so nothing behind login can help you create the first ones.
//
// Guarded by SEED_TOKEN (a Railway/hosting env var, separate from
// AUTH_SECRET) rather than login, since no one can log in yet. Safe to
// hit more than once — every write in runSeed() is an upsert or guarded
// by an existence check.
export async function GET(req: NextRequest) {
  const expected = process.env.SEED_TOKEN;
  if (!expected) {
    return NextResponse.json(
      {
        error:
          "SEED_TOKEN isn't set in this deployment's environment variables — add one before using this endpoint.",
      },
      { status: 500 },
    );
  }

  const token = req.nextUrl.searchParams.get("token");
  if (token !== expected) {
    return NextResponse.json(
      { error: "Missing or incorrect token." },
      { status: 403 },
    );
  }

  try {
    const log = await runSeed(prisma);
    return NextResponse.json({ ok: true, log });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
