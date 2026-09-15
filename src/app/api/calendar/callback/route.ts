import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForTokens, getConnectedAccountEmail } from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const settingsUrl = new URL("/settings/calendar", req.nextUrl.origin);

  if (error) {
    settingsUrl.searchParams.set("error", `Google said: ${error}`);
    return NextResponse.redirect(settingsUrl);
  }
  if (!code) {
    settingsUrl.searchParams.set("error", "No authorization code came back from Google.");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const redirectUri = `${req.nextUrl.origin}/api/calendar/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
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
