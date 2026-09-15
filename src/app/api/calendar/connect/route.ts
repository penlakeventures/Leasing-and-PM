import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google-calendar";

// Behind normal login (not a public webhook) — a signed-in staff member
// clicks "Connect Google Calendar" in Settings, which hits this route.
export async function GET(req: NextRequest) {
  const redirectUri = `${req.nextUrl.origin}/api/calendar/callback`;
  return NextResponse.redirect(getAuthUrl(redirectUri));
}
