import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  exchangeCodeForTokens,
  getConnectedAccountEmail,
  getCalendarCallbackUrl,
} from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  // Derived from the same NEXTAUTH_URL-based helper as the redirect_uri
  // itself, not req.nextUrl.origin — Railway's proxy layer can make that
  // resolve to an internal address rather than the real public domain.
  const settingsUrl = new URL(
    "/settings/calendar",
    new URL(getCalendarCallbackUrl()).origin,
  );

  if (error) {
    settingsUrl.searchParams.set("error", `Google said: ${error}`);
    return NextResponse.redirect(settingsUrl);
  }
  if (!code) {
    settingsUrl.searchParams.set("error", "No authorization code came back from Google.");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    // Must be byte-for-byte the same redirect_uri sent to Google in the
    // initial /api/calendar/connect redirect, or the token exchange is
    // rejected the same way the consent screen was.
    const tokens = await exchangeCodeForTokens(code, getCalendarCallbackUrl());
    if (!tokens.refresh_token) {
      // Happens if this Google account already granted consent before and
      // Google didn't re-issue a refresh token — shouldn't occur given
      // prompt=consent is always sent, but fail loudly rather than
      // silently leaving the old (possibly broken) connection in place.
      throw new Error(
        "Google didn't return a refresh token. Try disconnecting any prior access at myaccount.google.com/permissions and reconnecting.",
      );
    }
    const email = await getConnectedAccountEmail(tokens.access_token);
    if (!email) throw new Error("Could not determine the connected Google account's email.");

    await prisma.calendarConnection.upsert({
      where: { googleEmail: email },
      create: { googleEmail: email, refreshToken: tokens.refresh_token },
      update: { refreshToken: tokens.refresh_token },
    });

    return NextResponse.redirect(settingsUrl);
  } catch (e) {
    settingsUrl.searchParams.set(
      "error",
      e instanceof Error ? e.message : "Something went wrong connecting Google Calendar.",
    );
    return NextResponse.redirect(settingsUrl);
  }
}
