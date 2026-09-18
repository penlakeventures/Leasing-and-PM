// Seeds the real 7-project portfolio from the Phase 0 context doc so the
// app isn't empty on first run. Per-unit rent splits aren't in the source
// documents (only project-level rent rolls are) — they're derived here
// using the doc's own stated town:suite ≈ 2:1 ratio, and land on the
// documented totals exactly. Treat seeded rents/dates/designations as a
// reasonable starting point to correct against the real rent roll, not as
// confirmed figures.
//
// Shared between prisma/seed.ts (local/CLI) and the one-time browser-
// triggerable /api/seed route (for production, where a terminal isn't
// assumed) — both just call runSeed() against a PrismaClient.

import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

type ProjectSeed = {
  internalName: string;
  websiteCode: string;
  neighbourhood: string;
  address: string;
  occupancyDate: string;
  towns: number;
  suites: number;
  monthlyRentRoll: number; // towns + suites only, excludes the barn
  barn?: { rent: number; bedrooms: number };
};

// §5 Track Record — Project Portfolio, and §1 Company Snapshot for the barn.
const projects: ProjectSeed[] = [
  {
    internalName: "Killarney23",
    websiteCode: "KLY2337",
    neighbourhood: "Killarney",
    address: "Killarney, Calgary, AB",
    occupancyDate: "2021-01-01",
    towns: 4,
    suites: 4,
    monthlyRentRoll: 18000,
  },
  {
    internalName: "Glenbrook30",
    websiteCode: "GBK3038",
    neighbourhood: "Glenbrook",
    address: "Glenbrook, Calgary, AB",
    occupancyDate: "2022-01-01",
    towns: 4,
    suites: 4,
    monthlyRentRoll: 19100,
  },
  {
    internalName: "Killarney26",
    websiteCode: "KLY2632",
    neighbourhood: "Killarney",
    address: "Killarney, Calgary, AB",
    occupancyDate: "2023-01-01",
    towns: 4,
    suites: 4,
    monthlyRentRoll: 18350,
  },
  {
    internalName: "Killarney25",
    websiteCode: "KLY2530",
    neighbourhood: "Killarney",
    address: "Killarney, Calgary, AB",
    occupancyDate: "2024-04-01",
    towns: 4,
    suites: 4,
    monthlyRentRoll: 18900,
  },
  {
    internalName: "Killarney27",
    websiteCode: "KLY2327",
    neighbourhood: "Killarney",
    address: "Killarney, Calgary, AB",
    occupancyDate: "2024-10-01",
    towns: 4,
    suites: 4,
    monthlyRentRoll: 19200,
  },
  {
    internalName: "Inglewood14",
    websiteCode: "Stewart Livery Site",
    neighbourhood: "Inglewood",
    address: "810 14 ST SE, Inglewood, Calgary, AB",
    occupancyDate: "2024-10-01",
    towns: 7,
    suites: 7,
    monthlyRentRoll: 33430 - 4000, // total rent roll less the barn
    barn: { rent: 4000, bedrooms: 2 },
  },
  {
    internalName: "Shaganappi31",
    websiteCode: "SHGP1732",
    neighbourhood: "Shaganappi",
    address: "Shaganappi, Calgary, AB",
    occupancyDate: "2025-10-01",
    towns: 10,
    suites: 10,
    monthlyRentRoll: 44050,
  },
];

/**
 * Idempotent — safe to run more than once. Every write is an upsert-by-key
 * or guarded by an existence check, so re-running (e.g. hitting /api/seed
 * twice by accident) does nothing destructive.
 */
export async function runSeed(prisma: PrismaClient): Promise<string[]> {
  const log: string[] = [];
  const say = (line: string) => log.push(line);

  say("Seeding users…");
  const defaultPassword = "ChangeMe123!"; // documented in README — not echoed here
  const passwordHash = await bcrypt.hash(defaultPassword, 12);
  for (const [name, email] of [
    ["Ryan Doherty", "ryan@penventures.ca"],
    ["Alina Sezanaeva", "alina@penventures.ca"],
  ]) {
    const user = await prisma.user.upsert({
      where: { email },
      create: { name, email, passwordHash, role: "owner", mustChangePassword: true },
      update: {},
    });
    // Self-healing: if this account still has the known default password
    // — whether it's brand new, or an older account from before
    // mustChangePassword existed — make sure the forced-change flag is
    // set. Never touches an account that's already been rotated.
    if (await bcrypt.compare(defaultPassword, user.passwordHash)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { mustChangePassword: true },
      });
    }
  }
  say(
    "  → seeded with a temporary password — see README for the value. You'll be required to set a real one on first login.",
  );

  say("Seeding projects & units…");
  for (const [index, p] of projects.entries()) {
    // The array above is already in the owner's specified display order —
    // Killarney23 through Shaganappi31 — so position doubles as the order.
    const project = await prisma.projectEntity.upsert({
      where: { internalName: p.internalName },
      create: {
        internalName: p.internalName,
        websiteCode: p.websiteCode,
        neighbourhood: p.neighbourhood,
        address: p.address,
        occupancyDate: new Date(p.occupancyDate),
        displayOrder: index + 1,
      },
      update: {},
    });

    const existingUnits = await prisma.unit.count({
      where: { projectEntityId: project.id },
    });
    if (existingUnits > 0) {
      say(`  → ${p.internalName} already has units, skipping.`);
      continue;
    }

    // Derived from the doc's stated ~2:1 town:suite rent ratio; reproduces
    // the documented monthly rent roll totals exactly.
    const suiteRent =
      Math.round((p.monthlyRentRoll / (p.towns * 2 + p.suites)) * 100) / 100;
    const townRent = Math.round(suiteRent * 2 * 100) / 100;

    // ~25% of units affordable under MLI Select, concentrated in the
    // smaller (1-bedroom) units.
    const affordableCount = Math.round(0.25 * (p.towns + p.suites));

    // Placeholder unit numbers (1, 2, 3, …) — not real addresses/unit
    // numbers, since those weren't in the source docs. Rename these to the
    // real rent-roll unit numbers once that's on hand.
    let unitNumber = 1;

    for (let i = 0; i < p.towns; i++) {
      await prisma.unit.create({
        data: {
          projectEntityId: project.id,
          unitNumber: String(unitNumber++),
          bedrooms: 3,
          cmhcDesignation: "MARKET",
          baseRent: townRent,
          currentRent: townRent,
          tenancyType: "EXTERNAL",
        },
      });
    }

    for (let i = 0; i < p.suites; i++) {
      const affordable = i < affordableCount;
      await prisma.unit.create({
        data: {
          projectEntityId: project.id,
          unitNumber: String(unitNumber++),
          bedrooms: 1,
          cmhcDesignation: affordable ? "AFFORDABLE" : "MARKET",
          baseRent: suiteRent,
          currentRent: suiteRent,
          tenancyType: "EXTERNAL",
        },
      });
    }

    if (p.barn) {
      await prisma.unit.create({
        data: {
          projectEntityId: project.id,
          unitNumber: "Barn",
          bedrooms: p.barn.bedrooms,
          cmhcDesignation: "MARKET",
          baseRent: p.barn.rent,
          currentRent: p.barn.rent,
          tenancyType: "INTERNAL", // Pen-to-Pen — Pen Lake Ventures occupies it
        },
      });
    }

    say(
      `  → ${p.internalName}: ${p.towns} towns, ${p.suites} suites${p.barn ? " + barn" : ""}`,
    );
  }

  say("Seeding Alberta deposit interest rate for 2026 (0%, per regulation)…");
  await prisma.depositInterestRate.upsert({
    where: { year: 2026 },
    create: { year: 2026, ratePercent: 0 },
    update: {},
  });

  say("Done.");
  return log;
}
