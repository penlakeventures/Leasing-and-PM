"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function upsertCpiRate(formData: FormData) {
  const year = Number(formData.get("year"));
  const ratePercent = Number(formData.get("ratePercent"));
  await prisma.cpiRate.upsert({
    where: { year },
    create: { year, ratePercent },
    update: { ratePercent },
  });
  revalidatePath("/settings/rates");
  redirect("/settings/rates");
}

export async function upsertDepositInterestRate(formData: FormData) {
  const year = Number(formData.get("year"));
  const ratePercent = Number(formData.get("ratePercent"));
  await prisma.depositInterestRate.upsert({
    where: { year },
    create: { year, ratePercent },
    update: { ratePercent },
  });
  revalidatePath("/settings/rates");
  redirect("/settings/rates");
}
