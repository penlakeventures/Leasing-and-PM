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
    <nav className="flex flex-nowrap items-start gap-x-5 overflow-x-auto border-b border-neutral-200 bg-white px-4 py-2">
      {groups.map((group, i) => (
        <div key={i} className="flex shrink-0 flex-col gap-1">
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
          <div className="flex flex-nowrap gap-1">
            {group.links.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium ${
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
      {/* Same top-aligned label-row + content-row shape as every group
          above — Financials sits on the label row (in line with
          Portfolio/Leasing/etc.) rather than as its own wide button,
          keeping this trailing block no wider than Settings itself. */}
      <div className="ml-auto flex shrink-0 flex-col gap-1">
        {isOwner ? (
          <Link
            href="/financials"
            className={`px-3 text-[11px] font-semibold uppercase tracking-wide hover:underline ${
              pathname.startsWith("/financials") ? "text-neutral-900" : "text-brand"
            }`}
          >
            Financials
          </Link>
        ) : (
          <span aria-hidden className="invisible px-3 text-[11px] font-semibold uppercase tracking-wide">
            {" "}
          </span>
        )}
        <SettingsMenu />
      </div>
    </nav>
  );
}
