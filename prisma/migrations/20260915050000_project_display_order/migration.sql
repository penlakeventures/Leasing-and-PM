-- AlterTable
ALTER TABLE "project_entities" ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0;

-- Owner-specified display order, not alphabetical.
UPDATE "project_entities" SET "displayOrder" = 1 WHERE "internalName" = 'Killarney23';
UPDATE "project_entities" SET "displayOrder" = 2 WHERE "internalName" = 'Glenbrook30';
UPDATE "project_entities" SET "displayOrder" = 3 WHERE "internalName" = 'Killarney26';
UPDATE "project_entities" SET "displayOrder" = 4 WHERE "internalName" = 'Killarney25';
UPDATE "project_entities" SET "displayOrder" = 5 WHERE "internalName" = 'Killarney27';
UPDATE "project_entities" SET "displayOrder" = 6 WHERE "internalName" = 'Inglewood14';
UPDATE "project_entities" SET "displayOrder" = 7 WHERE "internalName" = 'Shaganappi31';
