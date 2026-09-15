// Pen Lake Ventures brand mark: a simplified roofline icon (adapted from
// the full logo for legibility at header scale) paired with the "pen."
// wordmark. Recreated by hand from the supplied logo image, not traced
// from the original vector file — close, but worth checking against the
// real artwork if this ever needs to be pixel-exact (e.g. print, the
// public website).
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
        className="h-7 w-7 shrink-0"
      >
        <path
          d="M14 30 V16 L30 8 L40 30 V40"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M30 8 V34"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
      <span
        style={{ fontFamily: "var(--font-logo)" }}
        className="text-xl font-bold leading-none text-neutral-900"
      >
        pen<span className="text-brand">.</span>
      </span>
    </span>
  );
}
