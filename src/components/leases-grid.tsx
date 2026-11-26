"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { updateLeaseNotes } from "@/lib/actions/leases";

export type LeaseRow = {
  id: string;
  address: string; // unit.unitNumber — already in full street-address form on real units
  community: string; // project's internalName
  type: "Suite" | "Townhome";
  tenants: string; // joined tenant names, "—" if none
  rent: number;
  leaseEnd: string | null; // ISO date, or null for periodic/no end date
  periodic: boolean;
  notes: string;
};

type ColumnKey = "address" | "community" | "type" | "tenants" | "rent" | "leaseEnd";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "address", label: "Address" },
  { key: "community", label: "Community" },
  { key: "type", label: "Type" },
  { key: "tenants", label: "Tenant(s)" },
  { key: "rent", label: "Rent" },
  { key: "leaseEnd", label: "Lease end" },
];

function displayValue(row: LeaseRow, key: ColumnKey): string {
  switch (key) {
    case "address":
      return row.address;
    case "community":
      return row.community;
    case "type":
      return row.type;
    case "tenants":
      return row.tenants;
    case "rent":
      return `$${row.rent.toLocaleString()}`;
    case "leaseEnd":
      return row.periodic ? "Periodic" : row.leaseEnd ? new Date(row.leaseEnd).toLocaleDateString() : "—";
  }
}

// Same colour-coding Alina kept by hand on her own spreadsheet — a lease
// already past its end date is at least as urgent as one 30 days out, so
// it gets the same red as that window rather than no colour at all.
// Periodic leases have no end date to measure against, so they never get
// a colour regardless of how the rest of the roster looks.
function leaseEndUrgency(row: LeaseRow): "red" | "orange" | null {
  if (row.periodic || !row.leaseEnd) return null;
  const daysUntilEnd = (new Date(row.leaseEnd).getTime() - Date.now()) / 86_400_000;
  if (daysUntilEnd <= 30) return "red";
  if (daysUntilEnd <= 90) return "orange";
  return null;
}

const ROW_TINT: Record<"red" | "orange", string> = {
  red: "bg-red-50 hover:bg-red-100",
  orange: "bg-orange-50 hover:bg-orange-100",
};

function sortValue(row: LeaseRow, key: ColumnKey): string | number {
  switch (key) {
    case "rent":
      return row.rent;
    case "leaseEnd":
      // A periodic lease displays as "Periodic" regardless of whatever
      // end date might still be on file for it (same precedence as every
      // other Periodic-or-date display in this app) — sorting has to
      // honour that same precedence, or a periodic lease with a leftover
      // end date (e.g. from before "Periodic" was checked on it) would
      // sort by that date while showing "Periodic", landing nowhere near
      // where it displays. Periodic/no-end-date leases sort after every
      // dated one, in either direction — there's no real date to compare,
      // and that's where Alina's own spreadsheet puts them too.
      return row.periodic || !row.leaseEnd ? Infinity : new Date(row.leaseEnd).getTime();
    default:
      return displayValue(row, key).toLowerCase();
  }
}

function FilterDropdown({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: Set<string> | null; // null = no filter applied (show everything)
  onChange: (next: Set<string> | null) => void;
}) {
  const allSelected = selected === null || selected.size === options.length;
  return (
    <details className="relative inline-block">
      <summary
        className={`ml-1 cursor-pointer list-none rounded px-1 text-xs [&::-webkit-details-marker]:hidden ${
          allSelected ? "text-neutral-400" : "text-blue-600"
        }`}
        title="Filter"
      >
        ▾
      </summary>
      <div className="absolute left-0 z-20 mt-1 max-h-64 w-48 overflow-y-auto rounded-md border border-neutral-200 bg-white p-2 text-xs font-normal normal-case shadow-lg">
        <label className="flex items-center gap-1.5 border-b border-neutral-100 pb-1.5 font-medium">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => onChange(allSelected ? new Set() : null)}
          />
          (Select all)
        </label>
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-1.5 py-0.5">
            <input
              type="checkbox"
              checked={allSelected || selected!.has(opt)}
              onChange={() => {
                const current = allSelected ? new Set(options) : new Set(selected);
                if (current.has(opt)) current.delete(opt);
                else current.add(opt);
                onChange(current.size === options.length ? null : current);
              }}
            />
            {opt || "(blank)"}
          </label>
        ))}
      </div>
    </details>
  );
}

function NotesCell({ leaseId, initialNotes }: { leaseId: string; initialNotes: string }) {
  const [value, setValue] = useState(initialNotes);
  const [, startTransition] = useTransition();

  return (
    <input
      type="text"
      value={value}
      placeholder="Add a note…"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value !== initialNotes) {
          startTransition(() => {
            updateLeaseNotes(leaseId, value);
          });
        }
      }}
      className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-neutral-300 focus:border-neutral-400 focus:bg-white focus:outline-none"
    />
  );
}

export function LeasesGrid({ rows }: { rows: LeaseRow[] }) {
  const [sort, setSort] = useState<{ key: ColumnKey; dir: "asc" | "desc" }>({
    key: "leaseEnd",
    dir: "asc",
  });
  const [filters, setFilters] = useState<Partial<Record<ColumnKey, Set<string>>>>({});

  const distinctValues = useMemo(() => {
    const map = {} as Record<ColumnKey, string[]>;
    for (const col of COLUMNS) {
      map[col.key] = Array.from(new Set(rows.map((r) => displayValue(r, col.key)))).sort();
    }
    return map;
  }, [rows]);

  const visibleRows = useMemo(() => {
    const filtered = rows.filter((row) =>
      COLUMNS.every(({ key }) => {
        const active = filters[key];
        return !active || active.has(displayValue(row, key));
      }),
    );
    const sorted = [...filtered].sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rows, filters, sort]);

  const toggleSort = (key: ColumnKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-red-50" /> Ending within 30 days
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-orange-50" /> Ending within 90 days
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-neutral-200 text-sm">
        <thead>
          <tr>
            {COLUMNS.map(({ key, label }) => (
              <th
                key={key}
                className="whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500"
              >
                <button
                  type="button"
                  onClick={() => toggleSort(key)}
                  className="hover:text-neutral-900"
                >
                  {label}
                  {sort.key === key && (sort.dir === "asc" ? " ▲" : " ▼")}
                </button>
                <FilterDropdown
                  options={distinctValues[key]}
                  selected={filters[key] ?? null}
                  onChange={(next) =>
                    setFilters((prev) => {
                      const copy = { ...prev };
                      if (next === null) delete copy[key];
                      else copy[key] = next;
                      return copy;
                    })
                  }
                />
              </th>
            ))}
            <th className="whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
              Notes
            </th>
            <th className="whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500" />
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {visibleRows.map((row) => {
            const urgency = leaseEndUrgency(row);
            return (
            <tr key={row.id} className={urgency ? ROW_TINT[urgency] : "hover:bg-neutral-50"}>
              <td className="px-4 py-2 text-neutral-700">
                <Link href={`/leases/${row.id}`} className="underline">
                  {row.address}
                </Link>
              </td>
              <td className="px-4 py-2 text-neutral-700">{row.community}</td>
              <td className="px-4 py-2 text-neutral-700">{row.type}</td>
              <td className="px-4 py-2 text-neutral-700">{row.tenants}</td>
              <td className="px-4 py-2 text-neutral-700">${row.rent.toLocaleString()}</td>
              <td className="px-4 py-2 text-neutral-700">
                {row.periodic ? "Periodic" : row.leaseEnd ? new Date(row.leaseEnd).toLocaleDateString() : "—"}
              </td>
              <td className="px-2 py-1 text-neutral-700">
                <NotesCell leaseId={row.id} initialNotes={row.notes} />
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-neutral-700">
                {/* A periodic lease has no fixed end date to renew from —
                    renewing is only meaningful for a fixed-term one. */}
                {!row.periodic && (
                  <Link
                    href={`/leases/new?renewFromLeaseId=${row.id}`}
                    className="text-sm underline"
                  >
                    Create renewal
                  </Link>
                )}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      {visibleRows.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-neutral-500">
          No leases match the current filters.
        </div>
      )}
      </div>
    </div>
  );
}
