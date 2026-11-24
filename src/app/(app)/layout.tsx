import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInboxRows } from "@/lib/inbox";
import { unitNeedsRenewalAttention } from "@/lib/rules";
import { Nav } from "@/components/nav";
import { SignOutButton } from "@/components/sign-out-button";
import { Logo } from "@/components/logo";
import Link from "next/link";

// Small pending-work counts shown as badges on their own nav tabs — this
// is what used to be the Dashboard's stat-tile row. No separate landing
// page for them now: they're visible from every page instead of only one.
async function getNavCounts() {
  const [inboxRows, unitsWithLeases, openTickets, activeLeads, currentYearCpiRate] = await Promise.all([
    getInboxRows(),
    prisma.unit.findMany({ include: { leases: true } }),
    prisma.maintenanceTicket.count({ where: { status: { not: "RESOLVED" } } }),
    prisma.lead.count({ where: { status: { notIn: ["LEASED", "LOST"] } } }),
    // checkRentEscalation blocks any affordable-unit rent increase outright
    // once the calendar rolls into a year with no CPI rate on file yet —
    // surfaced here so that's noticed ahead of time, not when someone's
    // rent recommendation mysteriously fails.
    prisma.cpiRate.findUnique({ where: { year: new Date().getFullYear() } }),
  ]);

  const renewals = unitsWithLeases.filter((u) => unitNeedsRenewalAttention(u)).length;

  return {
    inbox: inboxRows.length,
    renewals,
    maintenance: openTickets,
    leads: activeLeads,
    missingCpiRate: !currentYearCpiRate,
  };
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, counts] = await Promise.all([auth(), getNavCounts()]);
  // First + last initials (e.g. "Ryan Doherty" -> "RD") rather than just
  // the first letter, so the avatar stays distinguishable between the
  // two accounts sharing this app.
  const nameParts = session?.user?.name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const initials =
    nameParts.length >= 2
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : (nameParts[0]?.slice(0, 2).toUpperCase() ?? "?");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <div>
          <Link href="/units" aria-label="Pen Lake Ventures — home">
            <Logo />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/account/password"
            title={session?.user?.name ?? undefined}
            aria-label={session?.user?.name ? `${session.user.name} — account settings` : "Account settings"}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-semibold text-[#231f20] hover:opacity-80"
          >
            {initials}
          </Link>
          <SignOutButton />
        </div>
      </header>
      <Nav
        isOwner={(session?.user as { role?: string } | undefined)?.role === "owner"}
        counts={counts}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
