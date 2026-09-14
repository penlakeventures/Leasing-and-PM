import { signOut } from "@/lib/auth";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        className="text-sm text-neutral-500 hover:text-neutral-900"
      >
        Sign out
      </button>
    </form>
  );
}
