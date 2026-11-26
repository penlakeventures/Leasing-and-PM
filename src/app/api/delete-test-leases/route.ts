import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// One-time cleanup: removes the two Townhome-template test leases the
// owner created on Inglewood14 — Unit 810 14 ST SE while verifying the
// Dropbox Sign setup (rent $5000 and $4750, both dated 11/26/2026).
// Scoped tightly to that unit + those two rent amounts rather than any
// broader "delete test data" sweep, so it can't touch a real lease by
// accident. Leaves the "Ryan Doherty" tenant record alone — it may still
// be referenced by other in-progress test leases. Same pattern as
// /api/backfill-signed-dates: protected by normal login (src/proxy.ts),
// just visit this URL while signed in.
const UNIT_NUMBER = "810 14 ST SE";
const RENT_AMOUNTS = [5000, 4750];

export async function GET() {
  try {
    const unit = await prisma.unit.findFirst({ where: { unitNumber: UNIT_NUMBER } });
    if (!unit) {
      return NextResponse.json({ ok: true, log: [`No unit found with unitNumber "${UNIT_NUMBER}" — nothing to do.`] });
    }

    const leases = await prisma.lease.findMany({
      where: { unitId: unit.id, rentAmount: { in: RENT_AMOUNTS } },
      include: { tenants: { include: { tenant: true } } },
    });

    const log: string[] = [];
    for (const lease of leases) {
      const tenantNames = lease.tenants.map((lt) => lt.tenant.name).join(", ") || "—";
      await prisma.rentPayment.deleteMany({ where: { leaseId: lease.id } });
      const deposit = await prisma.securityDeposit.findUnique({ where: { leaseId: lease.id } });
      if (deposit) {
        await prisma.securityDepositDeduction.deleteMany({ where: { securityDepositId: deposit.id } });
        await prisma.securityDeposit.delete({ where: { id: deposit.id } });
      }
      await prisma.lease.delete({ where: { id: lease.id } });
      log.push(`Deleted lease ${lease.id} — rent $${lease.rentAmount}, tenant(s): ${tenantNames}.`);
    }

    if (log.length === 0) {
      log.push(`No leases found on "${UNIT_NUMBER}" with rent $5000 or $4750 — nothing to do.`);
    }

    return NextResponse.json({ ok: true, log });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
