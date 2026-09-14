import { Card, Field, Input, Button, Badge } from "@/components/ui";
import {
  upsertSecurityDeposit,
  returnDeposit,
  addDeduction,
  deleteDeduction,
} from "@/lib/actions/deposits";
import { depositReturnDeadline, isDepositOverdue } from "@/lib/rules";

type Deposit = {
  id: string;
  amount: unknown;
  dateReceived: Date;
  trustAccountRef: string | null;
  interestRateYear: number | null;
  interestAccrued: unknown;
  dateReturned: Date | null;
  deductions: { id: string; description: string; amount: unknown }[];
} | null;

export function DepositPanel({
  leaseId,
  deposit,
  monthlyRent,
  tenancyEndDate,
}: {
  leaseId: string;
  deposit: Deposit;
  monthlyRent: number;
  tenancyEndDate: Date | null;
}) {
  const upsertWithId = upsertSecurityDeposit.bind(null, leaseId);
  const returnWithId = returnDeposit.bind(null, leaseId);
  const addDeductionWithId = addDeduction.bind(null, leaseId);

  const overdue = isDepositOverdue({
    tenancyEndDate,
    dateReturned: deposit?.dateReturned ?? null,
  });

  const totalDeductions =
    deposit?.deductions.reduce((sum, d) => sum + Number(d.amount), 0) ?? 0;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">
          Security deposit
        </h2>
        <span className="text-xs text-neutral-500">
          Capped at one month&apos;s rent (${monthlyRent.toFixed(2)}) — Alberta RTA
        </span>
      </div>

      <form action={upsertWithId} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Amount" htmlFor="amount">
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min={0}
            max={monthlyRent}
            required
            defaultValue={deposit ? String(deposit.amount) : ""}
          />
        </Field>
        <Field label="Date received" htmlFor="dateReceived">
          <Input
            id="dateReceived"
            name="dateReceived"
            type="date"
            required
            defaultValue={
              deposit ? deposit.dateReceived.toISOString().slice(0, 10) : ""
            }
          />
        </Field>
        <Field label="Trust account reference" htmlFor="trustAccountRef">
          <Input
            id="trustAccountRef"
            name="trustAccountRef"
            defaultValue={deposit?.trustAccountRef ?? ""}
          />
        </Field>
        <Field
          label="Interest rate year"
          htmlFor="interestRateYear"
          hint="AB-regulation rate for that year — see Rates"
        >
          <Input
            id="interestRateYear"
            name="interestRateYear"
            type="number"
            defaultValue={deposit?.interestRateYear ?? new Date().getFullYear()}
          />
        </Field>
        <Field label="Interest accrued" htmlFor="interestAccrued">
          <Input
            id="interestAccrued"
            name="interestAccrued"
            type="number"
            step="0.01"
            defaultValue={deposit ? String(deposit.interestAccrued ?? "") : ""}
          />
        </Field>
        <div className="flex items-end">
          <Button type="submit">{deposit ? "Update deposit" : "Record deposit"}</Button>
        </div>
      </form>

      {deposit && (
        <div className="mt-6 space-y-4 border-t border-neutral-100 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-900">Deductions</h3>
            {overdue && <Badge tone="red">10-day return deadline passed</Badge>}
            {!overdue && tenancyEndDate && !deposit.dateReturned && (
              <span className="text-xs text-neutral-500">
                Due back by {depositReturnDeadline(tenancyEndDate).toLocaleDateString()}
              </span>
            )}
          </div>

          <ul className="space-y-1 text-sm">
            {deposit.deductions.map((d) => (
              <li key={d.id} className="flex items-center justify-between">
                <span>{d.description}</span>
                <span className="flex items-center gap-3">
                  ${Number(d.amount).toFixed(2)}
                  <form action={deleteDeduction.bind(null, leaseId, d.id)}>
                    <button
                      type="submit"
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-neutral-500">
            Total deductions: ${totalDeductions.toFixed(2)} · Refundable: $
            {(Number(deposit.amount) - totalDeductions).toFixed(2)}
          </p>

          <form action={addDeductionWithId} className="flex items-end gap-3">
            <Field label="Description" htmlFor="description">
              <Input id="description" name="description" required />
            </Field>
            <Field label="Amount" htmlFor="deduction-amount">
              <Input
                id="deduction-amount"
                name="amount"
                type="number"
                step="0.01"
                min={0}
                required
              />
            </Field>
            <Button type="submit" variant="secondary">
              Add
            </Button>
          </form>

          <form action={returnWithId} className="flex items-end gap-3">
            <Field label="Date returned" htmlFor="dateReturned">
              <Input
                id="dateReturned"
                name="dateReturned"
                type="date"
                defaultValue={
                  deposit.dateReturned
                    ? deposit.dateReturned.toISOString().slice(0, 10)
                    : ""
                }
              />
            </Field>
            <Button type="submit" variant="secondary">
              Mark returned
            </Button>
          </form>
        </div>
      )}
    </Card>
  );
}
