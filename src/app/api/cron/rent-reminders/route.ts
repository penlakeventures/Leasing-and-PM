import { NextRequest, NextResponse } from "next/server";
import { ensureCurrentPeriodPayments, sendRentReminders } from "@/lib/rent-reminders";

// Meant to be hit once a day by an external scheduler (a GitHub Actions
// cron workflow — see .github/workflows/rent-reminders.yml — rather than
// anything running inside this app itself, since a Next.js server has no
// built-in scheduler). Guarded by CRON_TOKEN rather than login, same
// reasoning as /api/seed's SEED_TOKEN: the caller here is a scheduler, not
// a signed-in person. Safe to call more than once a day — creating this
// month's charges is idempotent, and a reminder only ever goes out once
// per rent period no matter how many times this runs.
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_TOKEN isn't set in this deployment's environment variables." },
      { status: 500 },
    );
  }

  const token = req.nextUrl.searchParams.get("token");
  if (token !== expected) {
    return NextResponse.json({ error: "Missing or incorrect token." }, { status: 403 });
  }

  try {
    const created = await ensureCurrentPeriodPayments();
    const { sent, failed } = await sendRentReminders();
    return NextResponse.json({ ok: true, periodsCreated: created, remindersSent: sent, remindersFailed: failed });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
