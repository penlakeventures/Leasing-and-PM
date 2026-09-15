"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createCommunication(formData: FormData) {
  const tenantId = (formData.get("tenantId") as string) || null;
  const leadId = (formData.get("leadId") as string) || null;
  const timestampRaw = formData.get("timestamp") as string;
  const handledById = (formData.get("handledById") as string) || null;

  if (!tenantId && !leadId) {
    redirect(
      `/communications/new?error=${encodeURIComponent("Link the communication to a tenant or a lead.")}`,
    );
  }

  await prisma.communicationLog.create({
    data: {
      tenantId,
      leadId,
      channel: formData.get("channel") as "TEXT" | "EMAIL" | "CALL" | "MESSENGER",
      direction: formData.get("direction") as "INBOUND" | "OUTBOUND",
      timestamp: timestampRaw ? new Date(timestampRaw) : new Date(),
      summary: (formData.get("summary") as string).trim(),
      handledById,
    },
  });

  revalidatePath("/communications");
  redirect("/communications");
}

export async function deleteCommunication(id: string) {
  await prisma.communicationLog.delete({ where: { id } });
  revalidatePath("/communications");
  redirect("/communications");
}
