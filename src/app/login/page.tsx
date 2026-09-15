import { signIn, auth } from "@/lib/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
    passwordChanged?: string;
  }>;
}) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl || "/";

  async function login(formData: FormData) {
    "use server";
    try {
      // redirect: false — decide the destination ourselves below, rather
      // than letting signIn redirect to callbackUrl and then having
      // middleware redirect a *second* time if the account still needs a
      // password change. Chaining two redirects through the Server
      // Action boundary left the browser's address bar out of sync with
      // what was actually rendered (still-correct content, wrong URL).
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirect: false,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        const search = new URLSearchParams({ error: "invalid" });
        if (callbackUrl !== "/") search.set("callbackUrl", callbackUrl);
        redirect(`/login?${search.toString()}`);
      }
      throw error;
    }

    const session = await auth();
    const mustChangePassword = (
      session?.user as { mustChangePassword?: boolean } | undefined
    )?.mustChangePassword;
    redirect(mustChangePassword ? "/account/password" : callbackUrl);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
        <Logo />
        <p className="mt-1 text-sm text-neutral-500">
          Leasing &amp; Property Management
        </p>

        {params.error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Invalid email or password.
          </p>
        )}
        {params.passwordChanged && !params.error && (
          <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Password updated — sign in with your new one.
          </p>
        )}

        <form action={login} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-neutral-700"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-neutral-700"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
