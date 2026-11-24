"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwnerAction } from "@/lib/require-owner";

const ROLES = ["owner", "staff"] as const;

function redirectWithError(message: string): never {
  redirect(`/settings/staff?error=${encodeURIComponent(message)}`);
}

// Generates the one-time temporary password shown to the owner right
// after creation — never stored in plain text, and never shown again
// after this request. mustChangePassword forces a real one on first
// login, same as the two seeded accounts.
export async function createStaffMember(formData: FormData) {
  await requireOwnerAction();

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const role = formData.get("role") as string;

  if (!name) redirectWithError("Name is required.");
  if (!email) redirectWithError("Email is required.");
  if (!ROLES.includes(role as (typeof ROLES)[number])) {
    redirectWithError("Invalid role.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirectWithError(`${email} already has an account.`);
  }

  const tempPassword = crypto.randomBytes(9).toString("base64url"); // 12 chars
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  await prisma.user.create({
    data: { name, email, role, passwordHash, mustChangePassword: true },
  });

  revalidatePath("/settings/staff");
  redirect(
    `/settings/staff?createdEmail=${encodeURIComponent(email)}&tempPassword=${encodeURIComponent(tempPassword)}`,
  );
}

// True if demoting/deactivating this user would leave zero active owner
// accounts — the one thing that would brick owner-only access (Financials,
// this very page) with no way back in short of a direct database edit.
async function wouldRemoveLastOwner(targetId: string): Promise<boolean> {
  const remaining = await prisma.user.count({
    where: { role: "owner", active: true, id: { not: targetId } },
  });
  return remaining === 0;
}

export async function resetStaffPassword(id: string) {
  const session = await requireOwnerAction();
  if (session?.user?.id === id) {
    redirectWithError("Use Account settings to change your own password.");
  }

  const tempPassword = crypto.randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const user = await prisma.user.update({
    where: { id },
    data: { passwordHash, mustChangePassword: true },
  });

  revalidatePath("/settings/staff");
  redirect(
    `/settings/staff?createdEmail=${encodeURIComponent(user.email)}&tempPassword=${encodeURIComponent(tempPassword)}`,
  );
}

export async function setStaffActive(id: string, active: boolean) {
  const session = await requireOwnerAction();
  if (session?.user?.id === id) {
    redirectWithError("You can't deactivate your own account.");
  }

  if (!active) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (user?.role === "owner" && (await wouldRemoveLastOwner(id))) {
      redirectWithError("At least one owner account must stay active.");
    }
  }

  await prisma.user.update({ where: { id }, data: { active } });
  revalidatePath("/settings/staff");
  redirect("/settings/staff");
}

export async function setStaffRole(id: string, formData: FormData) {
  const session = await requireOwnerAction();
  if (session?.user?.id === id) {
    redirectWithError("You can't change your own access level.");
  }

  const role = formData.get("role") as string;
  if (!ROLES.includes(role as (typeof ROLES)[number])) {
    redirectWithError("Invalid role.");
  }

  if (role === "staff") {
    const user = await prisma.user.findUnique({ where: { id } });
    if (user?.role === "owner" && (await wouldRemoveLastOwner(id))) {
      redirectWithError("At least one owner account must remain.");
    }
  }

  await prisma.user.update({ where: { id }, data: { role } });
  revalidatePath("/settings/staff");
  redirect("/settings/staff");
}
