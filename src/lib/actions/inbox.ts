"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// For a text that doesn't need an actual reply (a "thanks", a vendor
// confirming a job's done) — clears it off the Inbox without sending
// anything, same effect as a real reply for this purpose.
export async function dismissTenantAttention(tenantId: string) {
  await prisma.tenant.update({ where: { id: tenantId }, data: { attentionClearedAt: new Date() } });
  revalidatePath("/inbox");
  redirect("/inbox");
}

export async function dismissLeadAttention(leadId: string) {
  await prisma.lead.update({ where: { id: leadId }, data: { attentionClearedAt: new Date() } });
  revalidatePath("/inbox");
  redirect("/inbox");
}

export async function dismissVendorAttention(vendorId: string) {
  await prisma.vendor.update({ where: { id: vendorId }, data: { attentionClearedAt: new Date() } });
  revalidatePath("/inbox");
  redirect("/inbox");
}
