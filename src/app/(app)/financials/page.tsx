import { prisma } from "@/lib/prisma";
import { Card, Field, Input, Button, Table, Th, Td, Badge, LinkButton } from "@/components/ui";
import { requireOwnerPage } from "@/lib/require-owner";
import { EXPENSE_CATEGORIES, monthStart, shiftMonth, formatMonth, totalExpense } from "@/lib/finance";
import { upsertMonthlyExpense, upsertFinancialSettings } from "@/lib/actions/finance";
import Link from "next/link";

const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

export default async function FinancialsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; edit?: string }>;
}) {
  await requireOwnerPage();

  const { month: monthParam, edit } = await searchParams;
  const month = monthParam ? monthStart(new Date(monthParam)) : monthStart();
  const monthIso = month.toISOString();
  const prevMonthIso = shiftMonth(month, -1).toISOString();
  const nextMonthIso = shiftMonth(month, 1).toISOString();

  const trailingStart = shiftMonth(month, -11);

  const [projects, paymentsThisMonth, expensesThisMonth, trailingPayments, trailingExpenses, settings] =
    await Promise.all([
      prisma.projectEntity.findMany({ orderBy: { displayOrder: "asc" } }),
      prisma.rentPayment.findMany({
        where: { period: month, paidDate: { not: null } },
        include: { lease: { include: { unit: true } } },
      }),
      prisma.monthlyExpense.findMany({ where: { month } }),
      prisma.rentPayment.findMany({
        where: { period: { gte: trailingStart, lte: month }, paidDate: { not: null } },
      }),
      prisma.monthlyExpense.findMany({ where: { month: { gte: trailingStart, lte: month } } }),
      prisma.financialSettings.findUnique({ where: { id: "singleton" } }),
    ]);

  const incomeByProject = new Map<string, number>();
  for (const p of paymentsThisMonth) {
    const key = p.lease.unit.projectEntityId;
    incomeByProject.set(key, (incomeByProject.get(key) ?? 0) + Number(p.amountDue));
  }

  const expenseByProject = new Map<string, (typeof expensesThisMonth)[number]>();
  for (const e of expensesThisMonth) expenseByProject.set(e.projectEntityId, e);

  const rows = projects.map((project) => {
    const income = incomeByProject.get(project.id) ?? 0;
    const expenseRow = expenseByProject.get(project.id);
    const expenses = totalExpense(expenseRow);
    return { project, income, expenses, net: income - expenses };
  });

  const totalIncome = rows.reduce((s, r) => s + r.income, 0);
  const totalExpenses = rows.reduce((s, r) => s + r.expenses, 0);
  const totalNet = totalIncome - totalExpenses;

  const trailingIncome = trailingPayments.reduce((s, p) => s + Number(p.amountDue), 0);
  const trailingExpensesTotal = trailingExpenses.reduce((s, e) => s + totalExpense(e), 0);
  const trailingNet = trailingIncome - trailingExpensesTotal;

  const editingProject = edit ? projects.find((p) => p.id === edit) : undefined;
  const editingExpense = editingProject ? expenseByProject.get(editingProject.id) : undefined;

  // A starting number for Maintenance, pulled from this project's own
  // resolved ticket costs for the month — still just a suggestion the
  // default value, not a locked field; the real total might include work
  // that never became a ticket.
  let suggestedMaintenance: number | null = null;
  if (editingProject && !editingExpense) {
    const tickets = await prisma.maintenanceTicket.findMany({
      where: {
        unit: { projectEntityId: editingProject.id },
        resolvedAt: { gte: month, lt: shiftMonth(month, 1) },
      },
    });
    suggestedMaintenance = tickets.reduce((s, t) => s + Number(t.cost ?? 0), 0);
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-neutral-900">Financials</h1>
          <Badge tone="amber">Owner only</Badge>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          Rental income below is pulled straight from Rent — nothing to type in. Expenses are
          entered once a month, per project, and Net income is computed for you.
        </p>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Link href={`/financials?month=${prevMonthIso}`} className="text-sm text-neutral-600 underline">
          &larr; Previous
        </Link>
        <p className="text-sm font-medium text-neutral-900">{formatMonth(month)}</p>
        <Link href={`/financials?month=${nextMonthIso}`} className="text-sm text-neutral-600 underline">
          Next &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-t-4 border-t-brand">
          <p className="text-2xl font-semibold text-neutral-900">{money(totalIncome)}</p>
          <p className="mt-1 text-sm text-neutral-500">Income — {formatMonth(month)}</p>
        </Card>
        <Card className="border-t-4 border-t-brand">
          <p className="text-2xl font-semibold text-neutral-900">{money(totalExpenses)}</p>
          <p className="mt-1 text-sm text-neutral-500">Expenses — {formatMonth(month)}</p>
        </Card>
        <Card className="border-t-4 border-t-brand">
          <p className="text-2xl font-semibold text-neutral-900">{money(totalNet)}</p>
          <p className="mt-1 text-sm text-neutral-500">Net income — {formatMonth(month)}</p>
        </Card>
        <Card className="border-t-4 border-t-brand">
          <p className="text-2xl font-semibold text-neutral-900">{money(trailingNet)}</p>
          <p className="mt-1 text-sm text-neutral-500">Net income — trailing 12 mo.</p>
        </Card>
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">By project — {formatMonth(month)}</h2>
          <span className="text-xs text-green-700">Income auto-filled from Rent</span>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Project</Th>
              <Th>Income</Th>
              <Th>Expenses</Th>
              <Th>Net income</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((r) => (
              <tr key={r.project.id} className="hover:bg-neutral-50">
                <Td>{r.project.internalName}</Td>
                <Td>{money(r.income)}</Td>
                <Td>{money(r.expenses)}</Td>
                <Td>
                  <span className="font-medium">{money(r.net)}</span>
                </Td>
                <Td>
                  <Link
                    href={`/financials?month=${monthIso}&edit=${r.project.id}`}
                    className="text-sm text-neutral-600 underline"
                  >
                    Edit expenses
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-neutral-200 bg-neutral-50 font-medium">
              <Td>Total</Td>
              <Td>{money(totalIncome)}</Td>
              <Td>{money(totalExpenses)}</Td>
              <Td>{money(totalNet)}</Td>
              <Td>{null}</Td>
            </tr>
          </tfoot>
        </Table>
      </div>

      {editingProject && (
        <div>
          <h2 className="mb-1 text-sm font-semibold text-neutral-900">
            Edit expenses — {editingProject.internalName}, {formatMonth(month)}
          </h2>
          <p className="mb-3 text-sm text-neutral-500">
            Same categories as the old spreadsheet, one project and month at a time.
          </p>
          <Card>
            <form
              action={upsertMonthlyExpense.bind(null, editingProject.id, monthIso)}
              className="grid grid-cols-1 gap-4 sm:grid-cols-3"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <Field
                  key={c.key}
                  label={c.label}
                  htmlFor={c.key}
                  hint={
                    c.key === "maintenance" && suggestedMaintenance
                      ? `Suggested from resolved tickets: ${money(suggestedMaintenance)}`
                      : undefined
                  }
                >
                  <Input
                    id={c.key}
                    name={c.key}
                    type="number"
                    step="0.01"
                    defaultValue={
                      editingExpense
                        ? String(editingExpense[c.key])
                        : c.key === "maintenance" && suggestedMaintenance
                          ? String(suggestedMaintenance)
                          : ""
                    }
                  />
                </Field>
              ))}
              <div className="flex gap-2 pt-2 sm:col-span-3">
                <Button type="submit">Save</Button>
                <LinkButton href={`/financials?month=${monthIso}`} variant="secondary">
                  Cancel
                </LinkButton>
              </div>
            </form>
          </Card>
        </div>
      )}

      <div>
        <h2 className="mb-1 text-sm font-semibold text-neutral-900">Portfolio snapshot</h2>
        <p className="mb-3 text-sm text-neutral-500">
          Changes rarely — update by hand when a value changes, not part of the monthly routine.
        </p>
        <Card>
          <form action={upsertFinancialSettings} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Total city assessment" htmlFor="totalCityAssessment">
              <Input
                id="totalCityAssessment"
                name="totalCityAssessment"
                type="number"
                step="0.01"
                defaultValue={settings?.totalCityAssessment ? String(settings.totalCityAssessment) : ""}
              />
            </Field>
            <Field label="Estimated market value" htmlFor="estimatedMarketValue">
              <Input
                id="estimatedMarketValue"
                name="estimatedMarketValue"
                type="number"
                step="0.01"
                defaultValue={settings?.estimatedMarketValue ? String(settings.estimatedMarketValue) : ""}
              />
            </Field>
            <Field label="Total assumed equity" htmlFor="totalAssumedEquity">
              <Input
                id="totalAssumedEquity"
                name="totalAssumedEquity"
                type="number"
                step="0.01"
                defaultValue={settings?.totalAssumedEquity ? String(settings.totalAssumedEquity) : ""}
              />
            </Field>
            <Field label="Avg. loan interest rate (%)" htmlFor="avgLoanInterestRate">
              <Input
                id="avgLoanInterestRate"
                name="avgLoanInterestRate"
                type="number"
                step="0.0001"
                defaultValue={settings?.avgLoanInterestRate ? String(settings.avgLoanInterestRate) : ""}
              />
            </Field>
            <Field label="IROR (%)" htmlFor="iror">
              <Input
                id="iror"
                name="iror"
                type="number"
                step="0.0001"
                defaultValue={settings?.iror ? String(settings.iror) : ""}
              />
            </Field>
            <div className="flex items-end sm:col-span-1">
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
