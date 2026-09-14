"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function parseVendorForm(formData: FormData) {
  return {
    name: (formData.get("name") as string).trim(),
    type: (formData.get("type") as string).trim(),
    contactPhone: (formData.get("contactPhone") as string)?.trim() || null,
    contactEmail: (formData.get("contactEmail") as string)?.trim() || null,
  };
}

export async function createVendor(formData: FormData) {
  const data = parseVendorForm(formData);
  await prisma.vendor.create({ data });
  revalidatePath("/vendors");
  redirect("/vendors");
}

export async function updateVendor(id: string, formData: FormData) {
  const data = parseVendorForm(formData);
  await prisma.vendor.update({ where: { id }, data });
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${id}`);
  redirect("/vendors");
}

export async function deleteVendor(id: string) {
  try {
    await prisma.vendor.delete({ where: { id } });
  } catch {
    redirect(
      `/vendors/${id}?error=${encodeURIComponent("Can't delete a vendor with ticket history.")}`,
    );
  }
  revalidatePath("/vendors");
  redirect("/vendors");
}
