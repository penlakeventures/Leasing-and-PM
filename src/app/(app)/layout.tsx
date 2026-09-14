import { auth } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { SignOutButton } from "@/components/sign-out-button";

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
          <p className="text-sm font-semibold text-neutral-900">
            Pen Lake Ventures
          </p>
          <p className="text-xs text-neutral-500">Leasing &amp; Property Management</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-600">
            {session?.user?.name}
          </span>
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
