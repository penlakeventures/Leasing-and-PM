"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/units", label: "Units" },
  { href: "/tenants", label: "Tenants" },
  { href: "/leases", label: "Leases" },
  { href: "/trust-ledger", label: "Trust ledger" },
  { href: "/leads", label: "Leads" },
  { href: "/tickets", label: "Maintenance" },
  { href: "/vendors", label: "Vendors" },
  { href: "/communications", label: "Communications" },
  { href: "/compliance", label: "Compliance" },
  { href: "/settings/rates", label: "Rates" },
  { href: "/settings/calendar", label: "Calendar" },
  { href: "/settings/dropbox", label: "Documents" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 border-b border-neutral-200 bg-white px-4 py-2">
      {links.map((link) => {
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
    </nav>
  );
}
