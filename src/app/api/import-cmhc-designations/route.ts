import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runCmhcDesignationImport } from "@/lib/cmhc-designation-import";

// Behind normal login (src/proxy.ts), like /api/import-rent-roll. Just
// visit this URL while signed in.
export async function GET() {
  try {
    const log = await runCmhcDesignationImport(prisma);
    return NextResponse.json({ ok: true, log });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
