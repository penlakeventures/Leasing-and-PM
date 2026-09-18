-- Owner-only financials: one row per project per month for expenses
-- (income is summed live from rent_payments, never stored here), plus a
-- singleton of rarely-changing portfolio figures.
CREATE TABLE "monthly_expenses" (
    "id" TEXT NOT NULL,
    "projectEntityId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "mortgage" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "propertyTax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "insurance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "propertyManagementFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "leasingFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "maintenance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "legal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "generalExpense" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "accounting" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_expenses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "monthly_expenses_projectEntityId_month_key" ON "monthly_expenses"("projectEntityId", "month");
CREATE INDEX "monthly_expenses_month_idx" ON "monthly_expenses"("month");

ALTER TABLE "monthly_expenses" ADD CONSTRAINT "monthly_expenses_projectEntityId_fkey"
  FOREIGN KEY ("projectEntityId") REFERENCES "project_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "financial_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "totalCityAssessment" DECIMAL(14,2),
    "estimatedMarketValue" DECIMAL(14,2),
    "totalAssumedEquity" DECIMAL(14,2),
    "avgLoanInterestRate" DECIMAL(6,4),
    "iror" DECIMAL(6,4),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_settings_pkey" PRIMARY KEY ("id")
);

-- Promote the two existing accounts (previously the generic "admin" role,
-- which had no actual meaning anywhere in the app) to "owner" now that the
-- role is enforced for real — gating the new Financials section. Any
-- future staff account should be created with role "staff" instead.
UPDATE "users" SET "role" = 'owner' WHERE "role" = 'admin';

-- Least-privilege default: a row ever created without an explicit role
-- lands as "staff", never "admin"/owner-equivalent.
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'staff';
