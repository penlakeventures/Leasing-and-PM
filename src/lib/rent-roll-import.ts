// One-time import: replaces the placeholder-seeded units with the real
// portfolio from the 2026 Current Rent Roll (see rent-roll-data.ts) —
// real unit numbers, real tenants, real leases, real security deposits.
//
// Safety: a project's units are only reset (deleted + recreated) if NONE
// of its existing units already have a lease attached. If real work has
// already been entered against a project (e.g. a test lease), that
// project is skipped entirely and reported, rather than risking deleting
// something real — Unit->Lease and Unit->MaintenanceTicket are both
// onDelete: Restrict at the DB level as a second line of defence, so an
// unexpected attachment fails the delete loudly instead of silently
// discarding data.

import type { PrismaClient } from "@prisma/client";
import { projectAddresses, rentRollUnits } from "@/lib/rent-roll-data";

export async function runRentRollImport(prisma: PrismaClient): Promise<string[]> {
  const log: string[] = [];
  const say = (line: string) => log.push(line);

  say("Updating project addresses…");
  for (const [internalName, address] of Object.entries(projectAddresses)) {
    const result = await prisma.projectEntity.updateMany({
      where: { internalName },
      data: { address },
    });
    if (result.count === 0) {
      say(`  ⚠ No project found named "${internalName}" — address not updated.`);
    } else {
      say(`  → ${internalName}: ${address}`);
    }
  }

  const byProject = new Map<string, typeof rentRollUnits>();
  for (const u of rentRollUnits) {
    if (!byProject.has(u.project)) byProject.set(u.project, []);
    byProject.get(u.project)!.push(u);
  }

  say("Importing units, tenants, leases, and deposits…");
  let unitsCreated = 0;
  let tenantsCreated = 0;
  let leasesCreated = 0;
  let depositsCreated = 0;
  let depositDatesAssumed = 0;
  const skippedProjects: string[] = [];

  for (const [internalName, units] of byProject) {
    const project = await prisma.projectEntity.findUnique({
      where: { internalName },
    });
    if (!project) {
      say(`  ⚠ Skipped ${internalName} — no matching project in the database.`);
      continue;
    }

    const existingUnits = await prisma.unit.findMany({
      where: { projectEntityId: project.id },
      include: { _count: { select: { leases: true } } },
    });
    const hasRealData = existingUnits.some((u) => u._count.leases > 0);
    if (hasRealData) {
      say(
        `  ⚠ Skipped ${internalName} — it already has a lease on file (real work in progress). Import it manually or ask to re-run just this project.`,
      );
      skippedProjects.push(internalName);
      continue;
    }

    try {
      await prisma.unit.deleteMany({ where: { projectEntityId: project.id } });
    } catch {
      say(
        `  ⚠ Skipped ${internalName} — its existing units couldn't be deleted (something's still attached to one of them). Nothing changed for this project.`,
      );
      skippedProjects.push(internalName);
      continue;
    }

    for (const u of units) {
      const unit = await prisma.unit.create({
        data: {
          projectEntityId: project.id,
          unitNumber: u.unitNumber,
          bedrooms: u.bedrooms,
          cmhcDesignation: "MARKET", // not in the rent roll — see summary note
          baseRent: u.rent,
          currentRent: u.rent,
          tenancyType: u.isInternal ? "INTERNAL" : "EXTERNAL",
        },
      });
      unitsCreated++;

      const tenantIds: string[] = [];
      for (const [i, name] of u.tenantNames.entries()) {
        const tenant = await prisma.tenant.create({
          data: {
            name,
            phone: i === 0 ? u.phone : null,
          },
        });
        tenantsCreated++;
        tenantIds.push(tenant.id);
      }

      await prisma.lease.create({
        data: {
          unitId: unit.id,
          startDate: new Date(u.leaseStart),
          periodic: true, // rent roll has no lease end date — treated as ongoing
          rentAmount: u.rent,
          tenants: { create: tenantIds.map((tenantId) => ({ tenantId })) },
          securityDeposit: {
            create: {
              amount: u.deposit,
              dateReceived: new Date(u.depositDate),
            },
          },
        },
      });
      leasesCreated++;
      depositsCreated++;
      if (u.depositDateAssumed) depositDatesAssumed++;
    }

    say(`  → ${internalName}: ${units.length} units imported.`);
  }

  say("Done.");
  say(
    `Summary: ${unitsCreated} units, ${tenantsCreated} tenants, ${leasesCreated} leases, ${depositsCreated} security deposits created.`,
  );
  if (skippedProjects.length > 0) {
    say(`Projects skipped (had existing real data): ${skippedProjects.join(", ")}`);
  }
  say(
    `${depositDatesAssumed} security deposit(s) had no date on file — used the lease start date instead.`,
  );
  say(
    "Every unit was set to MARKET — the rent roll doesn't say which are the CMHC-affordable units. Mark the real ones as AFFORDABLE under Units once you know which they are.",
  );
  say(
    "Only the first tenant listed on each lease got a phone number — the contact list has one number per unit, not per person.",
  );

  return log;
}
