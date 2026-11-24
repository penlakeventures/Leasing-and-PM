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
  { href: "/settings/staff", label: "Staff" },
];

function AttentionDot() {
  return (
    <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-red-500" aria-hidden />
  );
}

export function SettingsMenu({ missingCpiRate }: { missingCpiRate: boolean }) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-md px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 [&::-webkit-details-marker]:hidden">
        Settings ▾
        {missingCpiRate && <AttentionDot />}
      </summary>
      <div className="absolute right-0 z-10 mt-2 w-48 rounded-md border border-neutral-200 bg-white py-1 shadow-lg">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center justify-between px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            {l.label}
            {l.href === "/settings/rates" && missingCpiRate && (
              <span className="text-xs font-medium text-red-600">
                CPI rate needed
              </span>
            )}
          </Link>
        ))}
      </div>
    </details>
  );
}
