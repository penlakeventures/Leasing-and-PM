-- Replaces the unitType category (town/suite/barn) with a real unit
-- number as the way units are identified — a project's address plus this
-- number uniquely identifies a unit, so a separate category isn't needed.
--
-- Production already has real unit rows, so this can't just add unitNumber
-- as a required column in one step (Prisma's own draft warned about this).
-- Instead: add it nullable, backfill a placeholder (sequential per
-- project, ordered by the old unitType so towns/suites/barn don't
-- interleave oddly) so nothing is left blank, then enforce NOT NULL
-- before dropping the old column and enum. Rename the placeholders to the
-- real unit numbers via the app once this is applied.

-- AlterTable
ALTER TABLE "units" ADD COLUMN "unitNumber" TEXT;

-- Backfill
UPDATE "units" u
SET "unitNumber" = sub.rn::text
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "projectEntityId" ORDER BY "unitType", "createdAt") AS rn
  FROM "units"
) sub
WHERE u."id" = sub."id";

-- Now safe to require it
ALTER TABLE "units" ALTER COLUMN "unitNumber" SET NOT NULL;

-- Drop the old column + enum
ALTER TABLE "units" DROP COLUMN "unitType";
DROP TYPE "UnitType";
