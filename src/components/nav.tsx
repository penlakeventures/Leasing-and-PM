"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Grouped for display only — every tab keeps its existing path and label,
// just clustered under a header so 15 tabs read as a handful of related
// groups instead of one long flat row. Dashboard stays outside any group
// since it isn't leasing/PM/compliance-specific — it's the landing page.
const groups: { label: string | null; links: { href: string; label: string }[] }[] = [
  { label: null, links: [{ href: "/", label: "Dashboard" }] },
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
    ],
  },
  {
    label: "Property Management",
    links: [
      { href: "/tenants", label: "Tenants" },
      { href: "/tickets", label: "Maintenance" },
      { href: "/vendors", label: "Vendors" },
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
  {
    label: "Settings",
    links: [
      { href: "/settings/rates", label: "Rates" },
      { href: "/settings/calendar", label: "Calendar" },
      { href: "/settings/dropbox", label: "Documents" },
      { href: "/settings/texting", label: "Texting" },
    ],
  },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-start gap-x-5 gap-y-2 border-b border-neutral-200 bg-white px-4 py-2">
      {groups.map((group, i) => (
        <div key={i} className="flex flex-col gap-1">
          {group.label && (
            <span className="px-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              {group.label}
            </span>
          )}
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
    </nav>
  );
}
