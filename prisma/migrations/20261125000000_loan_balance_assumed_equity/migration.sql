-- Assumed equity on the Portfolio snapshot is no longer hand-entered —
-- it's now Market value minus Loan value, calculated on every page load
-- instead of stored. Add the new loanBalance column first and back-derive
-- it from any project that already has both totalAssumedEquity and
-- estimatedMarketValue on file (loanBalance = estimatedMarketValue -
-- totalAssumedEquity), so real figures already entered aren't silently
-- lost — then drop the now-redundant column.
ALTER TABLE "financial_settings" ADD COLUMN "loanBalance" DECIMAL(14,2);

UPDATE "financial_settings"
SET "loanBalance" = "estimatedMarketValue" - "totalAssumedEquity"
WHERE "estimatedMarketValue" IS NOT NULL AND "totalAssumedEquity" IS NOT NULL;

ALTER TABLE "financial_settings" DROP COLUMN "totalAssumedEquity";
