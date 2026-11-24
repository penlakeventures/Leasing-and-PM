-- Portfolio snapshot (city assessment, market value, assumed equity,
-- loan rate, IROR) was a single portfolio-wide singleton row; the owner
-- asked for it broken out per project like everything else on the
-- Financials page. Any values already entered on the old singleton are
-- carried forward onto every project (rather than silently dropped), so
-- nothing already on file disappears — a starting point to refine per
-- project from here. If the singleton never had anything entered (all
-- fields still null), this inserts nothing, which is the correct no-op.
ALTER TABLE "financial_settings" ADD COLUMN "projectEntityId" TEXT;

INSERT INTO "financial_settings" (
  "id", "projectEntityId", "totalCityAssessment", "estimatedMarketValue",
  "totalAssumedEquity", "avgLoanInterestRate", "iror", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  pe."id",
  old."totalCityAssessment",
  old."estimatedMarketValue",
  old."totalAssumedEquity",
  old."avgLoanInterestRate",
  old."iror",
  now()
FROM "project_entities" pe
CROSS JOIN (
  SELECT * FROM "financial_settings"
  WHERE "id" = 'singleton'
    AND (
      "totalCityAssessment" IS NOT NULL OR "estimatedMarketValue" IS NOT NULL OR
      "totalAssumedEquity" IS NOT NULL OR "avgLoanInterestRate" IS NOT NULL OR
      "iror" IS NOT NULL
    )
) old;

DELETE FROM "financial_settings" WHERE "id" = 'singleton';

ALTER TABLE "financial_settings" ALTER COLUMN "projectEntityId" SET NOT NULL;
ALTER TABLE "financial_settings" ALTER COLUMN "id" DROP DEFAULT;

CREATE UNIQUE INDEX "financial_settings_projectEntityId_key" ON "financial_settings"("projectEntityId");

ALTER TABLE "financial_settings" ADD CONSTRAINT "financial_settings_projectEntityId_fkey"
  FOREIGN KEY ("projectEntityId") REFERENCES "project_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
