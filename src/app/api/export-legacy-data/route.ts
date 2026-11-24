import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// One-time, temporary export of everything about to be permanently
// deleted when Leads/Texting/Inbox/Communications are removed: every
// Lead (with its tenant screening and tour info), and the full
// communications log (texts, calls, emails — tenant, lead, and vendor).
// Delete this route in the same change that drops the underlying tables
// — it references models that won't exist afterward.
//
// Guarded by EXPORT_TOKEN (a Railway/hosting env var) rather than login,
// same reasoning as /api/seed: simplest to make this a plain
// browser-visitable URL. Not destructive itself — read-only.
export async function GET(req: NextRequest) {
  const expected = process.env.EXPORT_TOKEN;
  if (!expected) {
    return NextResponse.json(
      {
        error:
          "EXPORT_TOKEN isn't set in this deployment's environment variables — add one before using this endpoint.",
      },
      { status: 500 },
    );
  }

  const token = req.nextUrl.searchParams.get("token");
  if (token !== expected) {
    return NextResponse.json(
      { error: "Missing or incorrect token." },
      { status: 403 },
    );
  }

  const [leads, communications] = await Promise.all([
    prisma.lead.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        unit: { include: { projectEntity: true } },
        tourStaff: true,
        screening: { include: { decidedBy: true } },
      },
    }),
    prisma.communicationLog.findMany({
      orderBy: { timestamp: "asc" },
      include: { tenant: true, lead: true, vendor: true, handledBy: true },
    }),
  ]);

  const exportedAt = new Date().toISOString();

  const leadRows = leads.map((l) => ({
    id: l.id,
    source: l.source,
    status: l.status,
    unit: l.unit
      ? `${l.unit.projectEntity.internalName} — Unit ${l.unit.unitNumber}`
      : null,
    contactName: l.contactName,
    contactPhone: l.contactPhone,
    contactEmail: l.contactEmail,
    message: l.message,
    requestedMoveInDate: l.requestedMoveInDate,
    occupantCount: l.occupantCount,
    pets: l.pets,
    reasonForMoving: l.reasonForMoving,
    moveInFlexible: l.moveInFlexible,
    employmentNotes: l.employmentNotes,
    tourAt: l.tourAt,
    tourStaff: l.tourStaff?.name ?? null,
    screening: l.screening
      ? {
          requestedDate: l.screening.requestedDate,
          completedDate: l.screening.completedDate,
          reportUrl: l.screening.reportUrl,
          summary: l.screening.summary,
          decision: l.screening.decision,
          decisionNotes: l.screening.decisionNotes,
          decidedBy: l.screening.decidedBy?.name ?? null,
          decidedAt: l.screening.decidedAt,
        }
      : null,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  }));

  const communicationRows = communications.map((c) => ({
    id: c.id,
    timestamp: c.timestamp,
    channel: c.channel,
    direction: c.direction,
    who:
      c.tenant?.name ??
      c.lead?.contactName ??
      c.vendor?.name ??
      null,
    whoType: c.tenant ? "tenant" : c.lead ? "lead" : c.vendor ? "vendor" : null,
    summary: c.summary,
    handledBy: c.handledBy?.name ?? "Automated",
  }));

  const body = JSON.stringify(
    {
      exportedAt,
      counts: { leads: leadRows.length, communications: communicationRows.length },
      leads: leadRows,
      communications: communicationRows,
    },
    null,
    2,
  );

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="leads-and-communications-export-${exportedAt.slice(0, 10)}.json"`,
    },
  });
}
