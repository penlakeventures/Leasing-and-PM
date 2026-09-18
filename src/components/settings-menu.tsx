import Link from "next/link";

// The five settings tabs staff rarely need — tucked into a dropdown near
// the account controls instead of taking up space in the main Nav row
// alongside the tabs used every day.
const links = [
  { href: "/settings/rates", label: "Rates" },
  { href: "/settings/calendar", label: "Calendar" },
  { href: "/settings/dropbox", label: "Documents" },
  { href: "/settings/texting", label: "Texting" },
  { href: "/settings/signing", label: "Signing" },
];

export function SettingsMenu() {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-md px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 [&::-webkit-details-marker]:hidden">
        Settings ▾
      </summary>
      <div className="absolute right-0 z-10 mt-2 w-40 rounded-md border border-neutral-200 bg-white py-1 shadow-lg">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="block px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </details>
  );
}
