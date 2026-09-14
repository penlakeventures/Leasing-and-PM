"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function parseTenantForm(formData: FormData) {
  return {
    name: (formData.get("name") as string).trim(),
    phone: (formData.get("phone") as string)?.trim() || null,
    email: (formData.get("email") as string)?.trim() || null,
    emergencyContactName:
      (formData.get("emergencyContactName") as string)?.trim() || null,
    emergencyContactPhone:
      (formData.get("emergencyContactPhone") as string)?.trim() || null,
  };
}

export async function createTenant(formData: FormData) {
  const data = parseTenantForm(formData);
  await prisma.tenant.create({ data });
  revalidatePath("/tenants");
  redirect("/tenants");
}

export async function updateTenant(id: string, formData: FormData) {
  const data = parseTenantForm(formData);
  await prisma.tenant.update({ where: { id }, data });
  revalidatePath("/tenants");
  revalidatePath(`/tenants/${id}`);
  redirect("/tenants");
}

export async function deleteTenant(id: string) {
  try {
    await prisma.tenant.delete({ where: { id } });
  } catch {
    redirect(
      `/tenants/${id}?error=${encodeURIComponent("Can't delete a tenant with lease or ticket history — remove those first.")}`,
    );
  }
  revalidatePath("/tenants");
  redirect("/tenants");
}
