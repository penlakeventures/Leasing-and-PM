"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

const MIN_PASSWORD_LENGTH = 8;

export async function changePassword(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) redirect("/login");

  const currentValid = await bcrypt.compare(
    currentPassword ?? "",
    user.passwordHash,
  );
  if (!currentValid) {
    redirect(
      `/account/password?error=${encodeURIComponent("Current password is incorrect.")}`,
    );
  }

  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    redirect(
      `/account/password?error=${encodeURIComponent(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`)}`,
    );
  }

  if (newPassword !== confirmPassword) {
    redirect(
      `/account/password?error=${encodeURIComponent("New password and confirmation don't match.")}`,
    );
  }

  if (newPassword === currentPassword) {
    redirect(
      `/account/password?error=${encodeURIComponent("New password must be different from your current password.")}`,
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  // The session's JWT already has the old mustChangePassword (and, in
  // principle, could outlive a rotated password) baked in — clear it and
  // require a fresh login rather than trying to mutate an already-issued
  // token in place. Deleting cookie name variants that aren't actually
  // set on this environment (e.g. the `__Secure-` names outside
  // production) is a harmless no-op, so all variants are cleared
  // unconditionally rather than trying to detect which ones apply.
  const cookieStore = await cookies();
  for (const name of [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "authjs.csrf-token",
    "__Host-authjs.csrf-token",
    "authjs.callback-url",
    "__Secure-authjs.callback-url",
  ]) {
    cookieStore.delete(name);
  }
  redirect("/login?passwordChanged=1");
}
