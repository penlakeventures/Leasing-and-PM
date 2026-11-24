-- Lender-set CMHC reporting deadline for this project/year — varies by
-- lender and by year, so there's no formula to compute it from (unlike
-- the rent/deposit deadlines elsewhere in the app). Just a place to
-- record it as the owner learns each one.
ALTER TABLE "compliance_records" ADD COLUMN     "reportingDeadline" TIMESTAMP(3);
