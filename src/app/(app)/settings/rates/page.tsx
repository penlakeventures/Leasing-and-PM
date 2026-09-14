import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Field, Input, Button, Table, Th, Td } from "@/components/ui";
import { upsertCpiRate, upsertDepositInterestRate } from "@/lib/actions/rates";

export default async function RatesPage() {
  const [cpiRates, depositRates] = await Promise.all([
    prisma.cpiRate.findMany({ orderBy: { year: "desc" } }),
    prisma.depositInterestRate.findMany({ orderBy: { year: "desc" } }),
  ]);

  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-10">
      <PageHeader
        title="Rates"
        description="Re-set each year, not hardcoded — these drive the compliance checks elsewhere in the app."
      />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">
          Statistics Canada CPI — caps affordable-unit rent escalation
        </h2>
        <Card>
          <form action={upsertCpiRate} className="mb-6 flex items-end gap-3">
            <Field label="Year" htmlFor="cpi-year">
              <Input id="cpi-year" name="year" type="number" required defaultValue={currentYear} />
            </Field>
            <Field label="CPI rate (%)" htmlFor="cpi-rate">
              <Input id="cpi-rate" name="ratePercent" type="number" step="0.01" required />
            </Field>
            <Button type="submit">Save</Button>
          </form>
          <Table>
            <thead>
              <tr>
                <Th>Year</Th>
                <Th>Rate</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {cpiRates.map((r) => (
                <tr key={r.year}>
                  <Td>{r.year}</Td>
                  <Td>{r.ratePercent.toString()}%</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">
          Alberta security-deposit interest rate
        </h2>
        <Card>
          <form action={upsertDepositInterestRate} className="mb-6 flex items-end gap-3">
            <Field label="Year" htmlFor="dep-year">
              <Input id="dep-year" name="year" type="number" required defaultValue={currentYear} />
            </Field>
            <Field label="Rate (%)" htmlFor="dep-rate">
              <Input id="dep-rate" name="ratePercent" type="number" step="0.001" required />
            </Field>
            <Button type="submit">Save</Button>
          </form>
          <Table>
            <thead>
              <tr>
                <Th>Year</Th>
                <Th>Rate</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {depositRates.map((r) => (
                <tr key={r.year}>
                  <Td>{r.year}</Td>
                  <Td>{r.ratePercent.toString()}%</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
