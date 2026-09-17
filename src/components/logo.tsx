// Pen Lake Ventures brand mark. Traced directly from the client-supplied
// vector (Pen_Logo_Refresh_2021_Black.ai — PDF-compatible, so the exact
// path coordinates, glyph positions, colors, and embedded font name were
// read straight out of it), as one composition rather than an icon and a
// separate line of text: in the real lockup the roofline mark hovers
// above and to the right of "pen.", overlapping it — its shorter left
// wall lands right around the "n", its taller right wall comes down to
// meet the text baseline just past the dot, and the ridge line hanging
// from the peak stops around cap-height. All the coordinates below (both
// the icon's and each letter's) are the file's own real numbers in one
// shared coordinate space, which is what keeps that overlap faithful —
// not just the icon's shape in isolation.
//
// Colors are the file's own values too: #231f20 (a rich near-black, not
// pure #000) for the ink, and the amber dot uses --brand from
// globals.css (also read out of this same file, so the two stay in
// sync).
//
// The wordmark's real typeface is Avenir Next Condensed (Regular) — a
// licensed commercial font, not something embeddable for free the way
// Poppins/Barlow are. The stack tries the real name first, so any Mac
// with it already installed (Adobe/Apple ship it) renders exactly
// right with zero setup; everywhere else falls back to Barlow Condensed
// (loaded via --font-logo in layout.tsx) as the closest free equivalent.
// Each letter is placed at its own explicit x (not left to the
// fallback font's own spacing) so the substitute font can't drift the
// icon's overlap out of position the way it would with plain flowed
// text — worth revisiting if Pen Lake Ventures buys an actual Avenir
// Next Condensed web-font license, at which point this whole fallback
// path (and the manual per-letter x's, which exist to route around it)
// stops being necessary.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="226 380 131 112"
      aria-hidden="true"
      className={`h-9 w-auto shrink-0 ${className}`}
    >
      <g
        style={{ fontFamily: '"Avenir Next Condensed", var(--font-logo), sans-serif', fontWeight: 500 }}
        fill="#231f20"
      >
        <text x="234.56" y="461.63" fontSize="56">
          p
        </text>
        <text x="262.49" y="461.63" fontSize="56">
          e
        </text>
        <text x="287.84" y="461.63" fontSize="56">
          n
        </text>
        <text x="316" y="461.63" fontSize="56" style={{ fill: "var(--brand)" }}>
          .
        </text>
      </g>
      <path
        d="M288.18 423.83 V400.86 L322.62 388.24 L348.67 436.41 V462.16"
        fill="none"
        stroke="#231f20"
        strokeWidth="1.6"
      />
      <path d="M322.62 388.24 V444.93" fill="none" stroke="#231f20" strokeWidth="1.6" />
    </svg>
  );
}
