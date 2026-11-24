"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SettingsMenu } from "@/components/settings-menu";

// The numeric badge counts, kept separate from missingCpiRate below (a
// plain flag, not a count) so countKey below can stay typed to just
// these and not need a runtime check for a field that isn't a number.
type NumericNavCounts = {
  inbox: number;
  renewals: number;
  maintenance: number;
  leads: number;
};

export type NavCounts = NumericNavCounts & {
  missingCpiRate: boolean;
};

// Grouped for display only — every tab keeps its existing path and label,
// just clustered under a header so these tabs read as a handful of
// related groups instead of one long flat row. Inbox stays outside any
// group since it isn't leasing/PM/compliance-specific — it's the one
// "what needs a reply right now" landing page. The five rarely-used
// Settings tabs live in SettingsMenu, pushed to the far right of this
// same row rather than grouped with the rest.
//
// countKey ties a tab to a NavCounts field — these are what used to be
// the Dashboard's stat tiles, shown as a badge on the tab itself instead
// of needing a separate page to go check them.
const groups: {
  label: string | null;
  links: { href: string; label: string; countKey?: keyof NumericNavCounts }[];
}[] = [
  {
    label: null,
    links: [{ href: "/inbox", label: "Inbox", countKey: "inbox" }],
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
      { href: "/leads", label: "Leads", countKey: "leads" },
      { href: "/leases", label: "Leases" },
      { href: "/renewals", label: "Renewals", countKey: "renewals" },
    ],
  },
  {
    label: "Property Management",
    links: [
      { href: "/tenants", label: "Tenants" },
      { href: "/tickets", label: "Maintenance", countKey: "maintenance" },
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

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
      {count}
    </span>
  );
}

export function Nav({ isOwner, counts }: { isOwner: boolean; counts: NavCounts }) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  // Whether there's more nav content hidden to the right of the scrollable
  // strip right now — e.g. the Compliance group (Trust ledger) can sit
  // just past the visible edge at common window widths, clipped with no
  // native scrollbar visible on most systems (macOS hides it by default).
  // This drives a fade + "more" cue so that content doesn't go unnoticed
  // instead of looking like it simply isn't there.
  const [hasMoreRight, setHasMoreRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      setHasMoreRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 1);
    };
    update();

    el.addEventListener("scroll", update);
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      resizeObserver.disconnect();
    };
  }, [counts]);

  return (
    <nav className="flex flex-nowrap items-start gap-x-5 border-b border-neutral-200 bg-white px-4 py-2">
      {/* overflow-x-auto lives on this inner wrapper, not the nav itself.
          Putting it on the nav forces the nav's overflow-y to "auto" too
          (per the CSS overflow spec), which clips SettingsMenu's
          absolutely positioned dropdown the moment it drops below the
          row. min-w-0 lets this wrapper shrink and scroll on its own
          instead of forcing the whole nav wider than the viewport. */}
      <div className="relative min-w-0 shrink grow">
        <div
          ref={scrollRef}
          className="flex min-w-0 flex-nowrap items-start gap-x-5 overflow-x-auto"
        >
        {groups.map((group, i) => (
          <div key={i} className="flex shrink-0 flex-col gap-1">
            {/* Always reserve the label row's height, even for the unlabeled
              Inbox group — otherwise its tab sits a full line higher
              than every other group's tabs instead of lining up with them. */}
            <span
              aria-hidden={!group.label}
              className={`px-3 text-[11px] font-semibold uppercase tracking-wide text-brand ${
                group.label ? "" : "invisible"
              }`}
            >
              {/* A plain space collapses to nothing (and so to zero
                  height) when it's the only content on its line — a
                  non-breaking space still renders as a real character,
                  so this placeholder actually reserves the same line
                  height as a sibling group's real label text. */}
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
                    {link.countKey && <CountBadge count={counts[link.countKey]} />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        </div>
        {hasMoreRight && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent"
          />
        )}
      </div>
      {/* Same top-aligned label-row + content-row shape as every group
          above — Financials sits on the label row (in line with
          Portfolio/Leasing/etc.) rather than as its own wide button,
          keeping this trailing block no wider than Settings itself. Kept
          outside the scrolling wrapper above so it (and its dropdown)
          stay visible regardless of how far the tabs are scrolled. */}
      <div className="ml-auto flex shrink-0 flex-col gap-1">
        {isOwner ? (
          <Link
            href="/financials"
            className={`px-3 text-[11px] font-semibold uppercase tracking-wide hover:underline ${
              pathname.startsWith("/financials")
                ? "text-neutral-900"
                : "text-brand"
            }`}
          >
            Financials
          </Link>
        ) : (
          <span
            aria-hidden
            className="invisible px-3 text-[11px] font-semibold uppercase tracking-wide"
          >
            {/* Same reasoning as the group-label placeholder above: a
                non-breaking space, not a plain one, or this collapses to
                zero height and misaligns Settings for any non-owner
                account (staff like Cindy, not just Ryan/Alina). */}
            {" "}
          </span>
        )}
        <SettingsMenu missingCpiRate={counts.missingCpiRate} />
      </div>
    </nav>
  );
}
