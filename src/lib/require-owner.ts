import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import type { Session } from "next-auth";

// The augmented Session type (auth.d.ts) declares `role`, but next-auth's
// own inference doesn't reliably pick it up here — same reason auth.ts's
// own callbacks cast rather than trust it directly.
function roleOf(session: Session | null): string | undefined {
  return (session?.user as { role?: string } | undefined)?.role;
}

// Financials is owner-only — not just hidden from the nav, actually
// blocked server-side, the same "enforced, not just hidden" pattern as
// every other rule in this app. notFound() rather than a "forbidden"
// message is deliberate: a staff account should see this section as if
// it doesn't exist at all, not be told it exists and they're locked out.
export async function requireOwnerPage() {
  const session = await auth();
  if (roleOf(session) !== "owner") notFound();
  return session;
}

// Actions aren't reachable from the UI without already being on the
// (owner-gated) page, but the endpoint itself is still a real URL — this
// is the check that actually stops a direct POST from a staff account,
// not just the missing button.
export async function requireOwnerAction() {
  const session = await auth();
  if (roleOf(session) !== "owner") {
    throw new Error("Not authorized.");
  }
  return session;
}
