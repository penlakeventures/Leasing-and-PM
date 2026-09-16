"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sendSms } from "@/lib/twilio";

async function sendText({
  tenantId,
  leadId,
  phone,
  redirectTo,
}: {
  tenantId?: string;
  leadId?: string;
  phone: string | null;
  redirectTo: string;
}, formData: FormData) {
  const body = (formData.get("body") as string)?.trim();
  if (!body) redirect(redirectTo);
  if (!phone) {
    redirect(`${redirectTo}?error=${encodeURIComponent("No phone number on file to text.")}`);
  }

  const session = await auth();

  try {
    const sid = await sendSms({ to: phone, body });
    await prisma.communicationLog.create({
      data: {
        tenantId,
        leadId,
        channel: "TEXT",
        direction: "OUTBOUND",
        summary: body,
        handledById: session?.user?.id ?? null,
        externalRef: `twilio:${sid}`,
      },
    });
  } catch (e) {
    console.error("[sendText] sendSms failed:", e);
    redirect(
      `${redirectTo}?error=${encodeURIComponent("Couldn't send that text — check the Texting settings and try again.")}`,
    );
  }

  revalidatePath(redirectTo);
  revalidatePath("/communications");
  redirect(redirectTo);
}

export async function sendTenantText(tenantId: string, formData: FormData) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) redirect("/tenants");
  await sendText(
    { tenantId, phone: tenant.phone, redirectTo: `/tenants/${tenantId}` },
    formData,
  );
}

export async function sendLeadText(leadId: string, formData: FormData) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) redirect("/leads");
  await sendText(
    { leadId, phone: lead.contactPhone, redirectTo: `/leads/${leadId}` },
    formData,
  );
}
