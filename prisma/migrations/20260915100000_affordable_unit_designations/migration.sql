-- Flags the 15 real MLI Select affordable units across the portfolio,
-- per the owner: none in Killarney23 or Glenbrook30; 2 each in Killarney26,
-- Killarney25, and Killarney27; 4 in Inglewood14; 5 in Shaganappi31.
-- Matches by project internalName + the real unit numbers already entered
-- via the app (see the unit_number_instead_of_type migration) — if any
-- unit number here doesn't match what's actually on file, that row's
-- UPDATE simply matches zero rows rather than failing.

UPDATE "units" u
SET "cmhcDesignation" = 'AFFORDABLE'
FROM "project_entities" p
WHERE u."projectEntityId" = p."id"
  AND p."internalName" = 'Killarney26'
  AND u."unitNumber" IN ('3020B', '3018B');

UPDATE "units" u
SET "cmhcDesignation" = 'AFFORDABLE'
FROM "project_entities" p
WHERE u."projectEntityId" = p."id"
  AND p."internalName" = 'Killarney25'
  AND u."unitNumber" IN ('3102B', '3104B');

UPDATE "units" u
SET "cmhcDesignation" = 'AFFORDABLE'
FROM "project_entities" p
WHERE u."projectEntityId" = p."id"
  AND p."internalName" = 'Killarney27'
  AND u."unitNumber" IN ('2746B', '2744B');

UPDATE "units" u
SET "cmhcDesignation" = 'AFFORDABLE'
FROM "project_entities" p
WHERE u."projectEntityId" = p."id"
  AND p."internalName" = 'Inglewood14'
  AND u."unitNumber" IN ('1503R', '1501R', '802R', '806R');

UPDATE "units" u
SET "cmhcDesignation" = 'AFFORDABLE'
FROM "project_entities" p
WHERE u."projectEntityId" = p."id"
  AND p."internalName" = 'Shaganappi31'
  AND u."unitNumber" IN ('101B', '102B', '202B', '203B', '204B');
