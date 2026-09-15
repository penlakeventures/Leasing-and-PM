import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isAuthApi = req.nextUrl.pathname.startsWith("/api/auth");
  // /api/seed is deliberately public — it's the bootstrap step run before
  // any users exist, guarded by its own SEED_TOKEN check instead of login.
  const isSeedApi = req.nextUrl.pathname === "/api/seed";
  // Likewise for the RentFaster inbound-email webhook: it's called by a
  // third-party email service, not a signed-in person, and is guarded by
  // its own RENTFASTER_INBOUND_TOKEN check instead.
  const isRentFasterInboundApi =
    req.nextUrl.pathname === "/api/leads/rentfaster-inbound";
  // Same idea for the Facebook Messenger webhook: called by Meta, not a
  // signed-in person, guarded by the verify-token handshake (GET) and
  // signature verification (POST) instead.
  const isMessengerWebhook =
    req.nextUrl.pathname === "/api/leads/facebook-messenger-webhook";

  if (
    isAuthApi ||
    isSeedApi ||
    isRentFasterInboundApi ||
    isMessengerWebhook
  )
    return NextResponse.next();

  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  // Force a still-default (or otherwise flagged) password to be changed
  // before anything else — but only for page navigation (GET). Server
  // Action POSTs aren't blocked here: they can only target a page the
  // user already loaded, and the only ones reachable from the
  // account/password page are the password-change form itself and
  // sign-out, both of which need to keep working from here.
  const isPasswordPage = req.nextUrl.pathname === "/account/password";
  const mustChangePassword = Boolean(
    (req.auth?.user as { mustChangePassword?: boolean } | undefined)
      ?.mustChangePassword,
  );
  if (
    isLoggedIn &&
    mustChangePassword &&
    !isPasswordPage &&
    req.method === "GET"
  ) {
    return NextResponse.redirect(new URL("/account/password", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
