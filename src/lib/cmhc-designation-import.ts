// One-time update: sets each unit's real CMHC Market/Affordable
// designation from the user's compliance-tracking spreadsheet, replacing
// the MARKET-for-everyone default the rent-roll import had to use since
// that file didn't carry this information.
//
// Purely a metadata update — doesn't touch tenants, leases, or rent — so
// unlike the rent-roll import there's no risk to real data and no need to
// skip already-imported projects; it just applies (or re-applies) the
// designation, matched by (project, unitNumber). Safe to re-run.

import type { PrismaClient } from "@prisma/client";
import { cmhcDesignations } from "@/lib/cmhc-designations";

export async function runCmhcDesignationImport(prisma: PrismaClient): Promise<string[]> {
  const log: string[] = [];
  const say = (line: string) => log.push(line);

  let updated = 0;
  let unchanged = 0;
  const notFound: string[] = [];
  const counts: Record<string, { MARKET: number; AFFORDABLE: number }> = {};

  for (const row of cmhcDesignations) {
    const project = await prisma.projectEntity.findUnique({
      where: { internalName: row.project },
    });
    if (!project) {
      notFound.push(`${row.project} — project not found`);
      continue;
    }
    const unit = await prisma.unit.findFirst({
      where: { projectEntityId: project.id, unitNumber: row.unitNumber },
    });
    if (!unit) {
      notFound.push(`${row.project} / ${row.unitNumber} — unit not found`);
      continue;
    }

    counts[row.project] ??= { MARKET: 0, AFFORDABLE: 0 };
    counts[row.project][row.designation]++;

    if (unit.cmhcDesignation === row.designation) {
      unchanged++;
      continue;
    }
    await prisma.unit.update({
      where: { id: unit.id },
      data: { cmhcDesignation: row.designation },
    });
    updated++;
  }

  say(`Applied CMHC designations for ${cmhcDesignations.length} units.`);
  say(`  → ${updated} unit(s) changed, ${unchanged} already correct.`);
  for (const [project, c] of Object.entries(counts)) {
    say(`  → ${project}: ${c.MARKET} market, ${c.AFFORDABLE} affordable.`);
  }
  if (notFound.length > 0) {
    say(`⚠ ${notFound.length} row(s) couldn't be matched to a unit:`);
    for (const n of notFound) say(`   - ${n}`);
  }
  say(
    "⚠ Killarney23 and Glenbrook30 (16 units) aren't in this file at all — they're still set to MARKET (the default), not confirmed. Provide their real designations when available.",
  );

  return log;
}
