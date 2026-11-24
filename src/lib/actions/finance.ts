"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwnerAction } from "@/lib/require-owner";
import { EXPENSE_CATEGORIES } from "@/lib/finance";

// One row per project per month — see MonthlyExpense's own comment in
// schema.prisma for why this is the one thing here that's hand-entered
// (income is summed live from RentPayment, never stored).
export async function upsertMonthlyExpense(
  projectEntityId: string,
  monthIso: string,
  formData: FormData,
) {
  await requireOwnerAction();

  const month = new Date(monthIso);
  const data = Object.fromEntries(
    EXPENSE_CATEGORIES.map((c) => [c.key, Number(formData.get(c.key)) || 0]),
  );

  await prisma.monthlyExpense.upsert({
    where: { projectEntityId_month: { projectEntityId, month } },
    create: { projectEntityId, month, ...data },
    update: data,
  });

  revalidatePath("/financials");
  redirect(`/financials?month=${monthIso}`);
}

export async function upsertFinancialSettings(projectEntityId: string, formData: FormData) {
  await requireOwnerAction();

  const numberOrNull = (name: string) => {
    const raw = formData.get(name) as string;
    return raw?.trim() ? Number(raw) : null;
  };

  // iror is deliberately left out here — it's not on this form anymore
  // (no agreed formula yet; see schema.prisma), and leaving it out of this
  // payload entirely means an existing value on file is never silently
  // cleared just because a save didn't include it.
  const data = {
    totalCityAssessment: numberOrNull("totalCityAssessment"),
    estimatedMarketValue: numberOrNull("estimatedMarketValue"),
    loanBalance: numberOrNull("loanBalance"),
    avgLoanInterestRate: numberOrNull("avgLoanInterestRate"),
  };

  await prisma.financialSettings.upsert({
    where: { projectEntityId },
    create: { projectEntityId, ...data },
    update: data,
  });

  revalidatePath("/financials");
  redirect("/financials");
}
