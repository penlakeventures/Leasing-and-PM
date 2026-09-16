"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function markRentPaid(paymentId: string) {
  await prisma.rentPayment.update({
    where: { id: paymentId },
    data: { paidDate: new Date() },
  });
  revalidatePath("/rent");
  redirect("/rent");
}

export async function markRentUnpaid(paymentId: string) {
  await prisma.rentPayment.update({
    where: { id: paymentId },
    data: { paidDate: null },
  });
  revalidatePath("/rent");
  redirect("/rent");
}
