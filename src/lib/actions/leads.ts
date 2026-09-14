"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function parseLeadForm(formData: FormData) {
  const unitId = (formData.get("unitId") as string) || null;
  return {
    source: formData.get("source") as "RENTFASTER" | "FACEBOOK_MARKETPLACE" | "OTHER",
    unitId,
    contactName: (formData.get("contactName") as string)?.trim() || null,
    contactPhone: (formData.get("contactPhone") as string)?.trim() || null,
    contactEmail: (formData.get("contactEmail") as string)?.trim() || null,
    status: formData.get("status") as
      | "NEW"
      | "CONTACTED"
      | "TOURING"
      | "APPLIED"
      | "SCREENED"
      | "LEASED"
      | "LOST",
  };
}

export async function createLead(formData: FormData) {
  const data = parseLeadForm(formData);
  await prisma.lead.create({ data });
  revalidatePath("/leads");
  redirect("/leads");
}

export async function updateLead(id: string, formData: FormData) {
  const data = parseLeadForm(formData);
  await prisma.lead.update({ where: { id }, data });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  redirect("/leads");
}

export async function deleteLead(id: string) {
  await prisma.lead.delete({ where: { id } });
  revalidatePath("/leads");
  redirect("/leads");
}
