"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function getSigningSettings() {
  return prisma.signingSettings.findUnique({ where: { id: "singleton" } });
}

export async function upsertSigningSettings(formData: FormData) {
  const trimOrNull = (name: string) => (formData.get(name) as string)?.trim() || null;
  const data = {
    landlordSignerName: trimOrNull("landlordSignerName"),
    landlordSignerEmail: trimOrNull("landlordSignerEmail"),
    leaseTownhomeTemplateId: trimOrNull("leaseTownhomeTemplateId"),
    leaseSuiteTemplateId: trimOrNull("leaseSuiteTemplateId"),
    smokingAddendumTemplateId: trimOrNull("smokingAddendumTemplateId"),
    additionalTermsTemplateId: trimOrNull("additionalTermsTemplateId"),
  };
  await prisma.signingSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });
  revalidatePath("/settings/signing");
  redirect("/settings/signing");
}
