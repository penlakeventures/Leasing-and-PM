import { auth } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { SignOutButton } from "@/components/sign-out-button";
import { SettingsMenu } from "@/components/settings-menu";
import { Logo } from "@/components/logo";
import Link from "next/link";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  // First + last initials (e.g. "Ryan Doherty" -> "RD") rather than just
  // the first letter, so the avatar stays distinguishable between the
  // two accounts sharing this app.
  const nameParts = session?.user?.name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const initials =
    nameParts.length >= 2
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : (nameParts[0]?.slice(0, 2).toUpperCase() ?? "?");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <div>
          <Link href="/" aria-label="Pen Lake Ventures — home">
            <Logo />
          </Link>
        </div>
        <div className="flex flex-col items-end gap-2">
          <SignOutButton />
          <Link
            href="/account/password"
            title={session?.user?.name ?? undefined}
            aria-label={session?.user?.name ? `${session.user.name} — account settings` : "Account settings"}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-semibold text-[#231f20] hover:opacity-80"
          >
            {initials}
          </Link>
          <SettingsMenu />
        </div>
      </header>
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
