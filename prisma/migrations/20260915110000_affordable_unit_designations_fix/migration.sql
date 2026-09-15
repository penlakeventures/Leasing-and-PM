-- The previous affordable-designation migration (20260915100000) matched
-- on an exact unitNumber string and matched nothing — the owner's unit
-- numbers on file include the street (e.g. "3220B 26 AVE SW"), not just
-- the suite code, and one code (Killarney26) was also mistranscribed as
-- 3020B/3018B instead of the real 3220B/3218B. Re-run with a "starts with
-- the suite code" match (case-insensitive) so it works whether the field
-- holds just the code or the code plus the street, and with the corrected
-- Killarney26 codes.

UPDATE "units" u
SET "cmhcDesignation" = 'AFFORDABLE'
FROM "project_entities" p
WHERE u."projectEntityId" = p."id"
  AND p."internalName" = 'Killarney26'
  AND (u."unitNumber" ILIKE '3220B%' OR u."unitNumber" ILIKE '3218B%');

UPDATE "units" u
SET "cmhcDesignation" = 'AFFORDABLE'
FROM "project_entities" p
WHERE u."projectEntityId" = p."id"
  AND p."internalName" = 'Killarney25'
  AND (u."unitNumber" ILIKE '3102B%' OR u."unitNumber" ILIKE '3104B%');

UPDATE "units" u
SET "cmhcDesignation" = 'AFFORDABLE'
FROM "project_entities" p
WHERE u."projectEntityId" = p."id"
  AND p."internalName" = 'Killarney27'
  AND (u."unitNumber" ILIKE '2746B%' OR u."unitNumber" ILIKE '2744B%');

UPDATE "units" u
SET "cmhcDesignation" = 'AFFORDABLE'
FROM "project_entities" p
WHERE u."projectEntityId" = p."id"
  AND p."internalName" = 'Inglewood14'
  AND (
    u."unitNumber" ILIKE '1503R%' OR u."unitNumber" ILIKE '1501R%'
    OR u."unitNumber" ILIKE '802R%' OR u."unitNumber" ILIKE '806R%'
  );

UPDATE "units" u
SET "cmhcDesignation" = 'AFFORDABLE'
FROM "project_entities" p
WHERE u."projectEntityId" = p."id"
  AND p."internalName" = 'Shaganappi31'
  AND (
    u."unitNumber" ILIKE '#101B%' OR u."unitNumber" ILIKE '101B%'
    OR u."unitNumber" ILIKE '#102B%' OR u."unitNumber" ILIKE '102B%'
    OR u."unitNumber" ILIKE '#202B%' OR u."unitNumber" ILIKE '202B%'
    OR u."unitNumber" ILIKE '#203B%' OR u."unitNumber" ILIKE '203B%'
    OR u."unitNumber" ILIKE '#204B%' OR u."unitNumber" ILIKE '204B%'
  );
