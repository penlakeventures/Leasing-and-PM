-- Dedicated completion timestamp for the Dropbox Sign webhook flow, kept
-- separate from the pre-existing, staff-editable "signedDate" field so the
-- webhook's idempotency guard can never be short-circuited by a manually
-- entered date unrelated to e-signature.
ALTER TABLE "leases" ADD COLUMN "signatureCompletedAt" TIMESTAMP(3);
