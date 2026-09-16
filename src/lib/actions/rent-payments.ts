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

// One-time catch-up for a period collected before anyone recorded it in the
// app (e.g. this feature going live mid-month) — scoped to a single period
// so it can never reach back and silently forgive a different month's real
// arrears.
export async function markAllRentPaidForPeriod(periodIso: string) {
  await prisma.rentPayment.updateMany({
    where: { period: new Date(periodIso), paidDate: null },
    data: { paidDate: new Date() },
  });
  revalidatePath("/rent");
  redirect("/rent");
}
