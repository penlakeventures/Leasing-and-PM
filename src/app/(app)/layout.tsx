import { auth } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { SignOutButton } from "@/components/sign-out-button";
import { Logo } from "@/components/logo";
import Link from "next/link";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <div>
          <Link href="/" aria-label="Pen Lake Ventures — home">
            <Logo />
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/account/password"
            className="text-sm text-neutral-600 hover:text-neutral-900 hover:underline"
          >
            {session?.user?.name}
          </Link>
          <SignOutButton />
        </div>
      </header>
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
