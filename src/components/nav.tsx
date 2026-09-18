"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SettingsMenu } from "@/components/settings-menu";

// Grouped for display only — every tab keeps its existing path and label,
// just clustered under a header so these tabs read as a handful of
// related groups instead of one long flat row. Dashboard and Inbox stay
// outside any group since neither is leasing/PM/compliance-specific —
// they're the two landing pages (overview, and what needs a reply right
// now). The five rarely-used Settings tabs live in SettingsMenu, pushed
// to the far right of this same row rather than grouped with the rest.
const groups: { label: string | null; links: { href: string; label: string }[] }[] = [
  {
    label: null,
    links: [
      { href: "/", label: "Dashboard" },
      { href: "/inbox", label: "Inbox" },
    ],
  },
  {
    label: "Portfolio",
    links: [
      { href: "/projects", label: "Projects" },
      { href: "/units", label: "Units" },
    ],
  },
  {
    label: "Leasing",
    links: [
      { href: "/leads", label: "Leads" },
      { href: "/leases", label: "Leases" },
      { href: "/renewals", label: "Renewals" },
    ],
  },
  {
    label: "Property Management",
    links: [
      { href: "/tenants", label: "Tenants" },
      { href: "/tickets", label: "Maintenance" },
      { href: "/vendors", label: "Vendors" },
      { href: "/rent", label: "Rent" },
      { href: "/communications", label: "Communications" },
    ],
  },
  {
    label: "Compliance",
    links: [
      { href: "/compliance", label: "Compliance" },
      { href: "/trust-ledger", label: "Trust ledger" },
    ],
  },
];

export function Nav({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-start gap-x-5 gap-y-2 border-b border-neutral-200 bg-white px-4 py-2">
      {groups.map((group, i) => (
        <div key={i} className="flex flex-col gap-1">
          {/* Always reserve the label row's height, even for the unlabeled
              Dashboard group — otherwise its tab sits a full line higher
              than every other group's tabs instead of lining up with them. */}
          <span
            aria-hidden={!group.label}
            className={`px-3 text-[11px] font-semibold uppercase tracking-wide text-brand ${
              group.label ? "" : "invisible"
            }`}
          >
            {group.label ?? " "}
          </span>
          <div className="flex flex-wrap gap-1">
            {group.links.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    active
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      <div className="ml-auto flex items-end gap-5">
        {isOwner && (
          <Link
            href="/financials"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
              pathname.startsWith("/financials")
                ? "bg-neutral-900 text-white"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-3.5 w-3.5"
            >
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Financials
          </Link>
        )}
        <SettingsMenu />
      </div>
    </nav>
  );
}
