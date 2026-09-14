"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { checkSecurityDepositAmount } from "@/lib/rules";

export async function upsertSecurityDeposit(
  leaseId: string,
  formData: FormData,
) {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: { securityDeposit: true },
  });
  if (!lease) redirect("/leases");

  const amount = Number(formData.get("amount"));
  const dateReceived = new Date(formData.get("dateReceived") as string);
  const trustAccountRef =
    (formData.get("trustAccountRef") as string)?.trim() || null;
  const interestRateYearRaw = formData.get("interestRateYear") as string;
  const interestRateYear = interestRateYearRaw
    ? Number(interestRateYearRaw)
    : null;
  const interestAccruedRaw = formData.get("interestAccrued") as string;
  const interestAccrued = interestAccruedRaw
    ? Number(interestAccruedRaw)
    : null;

  const check = checkSecurityDepositAmount({
    depositAmount: amount,
    monthlyRent: Number(lease!.rentAmount),
    existingAmount: lease!.securityDeposit
      ? Number(lease!.securityDeposit.amount)
      : null,
  });
  if (!check.allowed) {
    redirect(`/leases/${leaseId}?error=${encodeURIComponent(check.reason!)}`);
  }

  await prisma.securityDeposit.upsert({
    where: { leaseId },
    create: {
      leaseId,
      amount,
      dateReceived,
      trustAccountRef,
      interestRateYear,
      interestAccrued,
    },
    update: {
      amount,
      dateReceived,
      trustAccountRef,
      interestRateYear,
      interestAccrued,
    },
  });

  revalidatePath(`/leases/${leaseId}`);
  redirect(`/leases/${leaseId}`);
}

export async function returnDeposit(leaseId: string, formData: FormData) {
  const dateReturned = formData.get("dateReturned") as string;
  const deposit = await prisma.securityDeposit.findUnique({
    where: { leaseId },
  });
  if (!deposit) redirect(`/leases/${leaseId}`);

  await prisma.securityDeposit.update({
    where: { leaseId },
    data: { dateReturned: dateReturned ? new Date(dateReturned) : null },
  });

  revalidatePath(`/leases/${leaseId}`);
  redirect(`/leases/${leaseId}`);
}

export async function addDeduction(leaseId: string, formData: FormData) {
  const deposit = await prisma.securityDeposit.findUnique({
    where: { leaseId },
  });
  if (!deposit) redirect(`/leases/${leaseId}`);

  const description = (formData.get("description") as string).trim();
  const amount = Number(formData.get("amount"));

  await prisma.securityDepositDeduction.create({
    data: { securityDepositId: deposit!.id, description, amount },
  });

  revalidatePath(`/leases/${leaseId}`);
  redirect(`/leases/${leaseId}`);
}

export async function deleteDeduction(leaseId: string, deductionId: string) {
  await prisma.securityDepositDeduction.delete({
    where: { id: deductionId },
  });
  revalidatePath(`/leases/${leaseId}`);
  redirect(`/leases/${leaseId}`);
}
