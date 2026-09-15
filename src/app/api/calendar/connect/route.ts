import { NextResponse } from "next/server";
import { getAuthUrl, getCalendarCallbackUrl } from "@/lib/google-calendar";

// Behind normal login (not a public webhook) — a signed-in staff member
// clicks "Connect Google Calendar" in Settings, which hits this route.
export async function GET() {
  return NextResponse.redirect(getAuthUrl(getCalendarCallbackUrl()));
}
