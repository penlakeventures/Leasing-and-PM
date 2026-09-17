// Pen Lake Ventures brand mark. Traced directly from the client-supplied
// vector (Pen_Logo_Refresh_2021_Black.ai — PDF-compatible, so the exact
// path coordinates, colors, and embedded font name were read straight out
// of it): an asymmetric roofline — a shorter left wall, a taller right
// wall reaching below the wordmark's baseline, and a short ridge line
// hanging from the peak between them — sharp mitered corners and butt
// caps throughout (the SVG defaults, so left unset below), not rounded.
//
// Colors are the file's own values, not approximations: #231f20 (a rich
// near-black, not pure #000) for the ink, #fbb03f for the amber dot —
// matches globals.css's --brand, which was updated to this same value.
//
// The wordmark's real typeface is Avenir Next Condensed (Regular) — a
// licensed commercial font, not something embeddable for free the way
// Poppins/Barlow are. The stack below tries the real name first, so any
// Mac with it already installed (Adobe/Apple ship it) renders exactly
// right with zero setup; everywhere else falls back to Barlow Condensed
// (loaded via --font-logo in layout.tsx) as the closest free equivalent.
// If Pen Lake Ventures has (or buys) an actual Avenir Next Condensed
// webfont license, self-hosting that file and dropping it in front of
// this stack would make it exact everywhere.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 66.5 80"
        fill="none"
        aria-hidden="true"
        className="h-7 w-auto shrink-0"
      >
        <path
          d="M3 38.6 V15.6 L37.4 3 L63.5 51.2 V76.9"
          stroke="#231f20"
          strokeWidth="3"
        />
        <path d="M37.4 3 V59.7" stroke="#231f20" strokeWidth="3" />
      </svg>
      <span
        style={{ fontFamily: '"Avenir Next Condensed", var(--font-logo), sans-serif' }}
        className="text-xl leading-none text-[#231f20]"
      >
        pen<span className="text-brand">.</span>
      </span>
    </span>
  );
}
