"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui";

// A quick "jump to" search, not a filter on whatever table sits below it
// — searches every item passed in regardless of any filter/toggle that
// table itself applies, so e.g. a past tenant or an ended lease still
// turns up without first flipping that toggle on.
export function EntitySearch({
  items,
  basePath,
  placeholder,
}: {
  items: { id: string; label: string }[];
  basePath: string;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const router = useRouter();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 8);
  }, [items, query]);

  return (
    <div className="relative mb-4 max-w-sm">
      <Input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
          setHighlighted(0);
        }}
        onFocus={() => setIsOpen(true)}
        // Delayed rather than immediate — a click on a result below fires
        // after blur, and closing right away would unmount the link
        // before that click is handled.
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        onKeyDown={(e) => {
          if (!isOpen || matches.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlighted((h) => Math.min(h + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlighted((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const match = matches[highlighted];
            if (match) router.push(`${basePath}/${match.id}`);
          } else if (e.key === "Escape") {
            setIsOpen(false);
          }
        }}
      />
      {isOpen && query && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-lg">
          {matches.length > 0 ? (
            matches.map((item, i) => (
              <Link
                key={item.id}
                href={`${basePath}/${item.id}`}
                className={`block px-3 py-2 text-sm text-neutral-700 ${
                  i === highlighted ? "bg-neutral-100" : "hover:bg-neutral-50"
                }`}
                onMouseEnter={() => setHighlighted(i)}
              >
                {item.label}
              </Link>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-neutral-500">No matches found.</p>
          )}
        </div>
      )}
    </div>
  );
}
