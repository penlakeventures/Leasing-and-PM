import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  exchangeCodeForTokens,
  getConnectedAccountEmail,
  getDropboxCallbackUrl,
} from "@/lib/dropbox";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  // Derived from the same NEXTAUTH_URL-based helper as the redirect_uri
  // itself, not req.nextUrl.origin — Railway's proxy layer can make that
  // resolve to an internal address rather than the real public domain.
  const settingsUrl = new URL(
    "/settings/dropbox",
    new URL(getDropboxCallbackUrl()).origin,
  );

  if (error) {
    settingsUrl.searchParams.set("error", `Dropbox said: ${error}`);
    return NextResponse.redirect(settingsUrl);
  }
  if (!code) {
    settingsUrl.searchParams.set("error", "No authorization code came back from Dropbox.");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    // Must be byte-for-byte the same redirect_uri sent to Dropbox in the
    // initial /api/dropbox/connect redirect, or the token exchange is
    // rejected the same way it would be if the URIs didn't match up front.
    const tokens = await exchangeCodeForTokens(code, getDropboxCallbackUrl());
    if (!tokens.refresh_token) {
      throw new Error(
        "Dropbox didn't return a refresh token. Try disconnecting any prior access at dropbox.com/account/connected_apps and reconnecting.",
      );
    }
    const email = await getConnectedAccountEmail(tokens.access_token);
    if (!email) throw new Error("Could not determine the connected Dropbox account's email.");

    await prisma.dropboxConnection.upsert({
      where: { accountEmail: email },
      create: { accountEmail: email, refreshToken: tokens.refresh_token },
      update: { refreshToken: tokens.refresh_token },
    });

    return NextResponse.redirect(settingsUrl);
  } catch (e) {
    settingsUrl.searchParams.set(
      "error",
      e instanceof Error ? e.message : "Something went wrong connecting Dropbox.",
    );
    return NextResponse.redirect(settingsUrl);
  }
}
