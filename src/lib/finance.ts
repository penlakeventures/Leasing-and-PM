// Owner-only financials — pure helpers, no DB access here (that's the
// page/actions' job), same split as rules.ts.

// Same convention as RentPayment.period (see rent-reminders.ts): a
// calendar-month marker stored as UTC midnight of the 1st, not a real
// instant — comparisons and formatting must use timeZone "UTC" or a
// few hours' shift crosses the month boundary.
export function monthStart(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function shiftMonth(month: Date, delta: number): Date {
  return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + delta, 1));
}

export function formatMonth(month: Date): string {
  return month.toLocaleDateString("en-CA", { timeZone: "UTC", month: "long", year: "numeric" });
}

// The categories on the spreadsheet this replaces, in the same order —
// one row per project per month (MonthlyExpense), entered by hand since
// nothing else in the app tracks mortgage/tax/insurance/etc. yet.
export const EXPENSE_CATEGORIES = [
  { key: "mortgage", label: "Mortgage / loan payment" },
  { key: "propertyTax", label: "Property tax" },
  { key: "insurance", label: "Property insurance" },
  { key: "propertyManagementFee", label: "Property management fee" },
  { key: "leasingFee", label: "Leasing fee" },
  { key: "maintenance", label: "Maintenance" },
  { key: "legal", label: "Legal" },
  { key: "generalExpense", label: "General portfolio expense" },
  { key: "accounting", label: "Accounting" },
] as const;

export type ExpenseCategoryKey = (typeof EXPENSE_CATEGORIES)[number]["key"];

export function totalExpense(expense: Record<ExpenseCategoryKey, unknown> | null | undefined): number {
  if (!expense) return 0;
  return EXPENSE_CATEGORIES.reduce((sum, c) => sum + Number(expense[c.key] ?? 0), 0);
}
