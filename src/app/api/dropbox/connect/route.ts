import { NextResponse } from "next/server";
import { getAuthUrl, getDropboxCallbackUrl } from "@/lib/dropbox";

// Behind normal login (not a public webhook) — a signed-in staff member
// clicks "Connect Dropbox" in Settings, which hits this route.
export async function GET() {
  return NextResponse.redirect(getAuthUrl(getDropboxCallbackUrl()));
}
