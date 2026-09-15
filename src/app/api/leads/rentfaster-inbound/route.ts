import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  parseRentFasterLeadEmail,
  formatLeadMessage,
} from "@/lib/rentfaster-lead-parse";

// Inbound-email webhook: whichever email-forwarding service ends up
// delivering RentFaster's lead notifications to this app POSTs here. Not
// wired to a specific provider yet — this reads a handful of common field
// name variants so it doesn't need code changes once one is picked, and
// the exact set can be narrowed down once we know which service we're
// using.
//
// Guarded by RENTFASTER_INBOUND_TOKEN (like /api/seed's SEED_TOKEN)
// rather than login, since this is called by a third-party service, not
// a signed-in person. Safe to receive the same email more than once —
// creation is keyed off a dedupe reference derived from the email, so a
// retry updates the existing lead instead of creating a duplicate.
export async function POST(req: NextRequest) {
  const expected = process.env.RENTFASTER_INBOUND_TOKEN;
  if (!expected) {
    return NextResponse.json(
      {
        error:
          "RENTFASTER_INBOUND_TOKEN isn't set in this deployment's environment variables — add one before pointing the email service at this URL.",
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

  const contentType = req.headers.get("content-type") ?? "";
  let raw: Record<string, unknown>;
  if (contentType.includes("application/json")) {
    raw = await req.json();
  } else {
    const form = await req.formData();
    raw = Object.fromEntries(form.entries());
  }

  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = raw[key];
      if (typeof value === "string" && value.trim()) return value;
    }
    return "";
  };

  const subject = pick("subject", "Subject");
  const text = pick("text", "TextBody", "body-plain", "stripped-text", "body");
  const replyTo = pick("replyTo", "Reply-To", "ReplyTo", "reply-to") || null;

  if (!text) {
    return NextResponse.json(
      { ok: false, error: "No email body found in the webhook payload." },
      { status: 400 },
    );
  }

  const parsed = parseRentFasterLeadEmail({ subject, text, replyTo });

  // True idempotency, not just dedup-on-write: if this exact inquiry has
  // already been captured, this call is a no-op. Re-upserting on every
  // redelivery would silently overwrite anything staff had since edited
  // on the lead (a re-linked unit, a corrected phone number) and would
  // duplicate the inbound-communication log entry below.
  if (parsed.externalRef) {
    const existing = await prisma.lead.findUnique({
      where: { externalRef: parsed.externalRef },
    });
    if (existing) {
      return NextResponse.json({ ok: true, leadId: existing.id, duplicate: true });
    }
  }

  const unit = await matchListingToUnit(parsed.listing);

  const lead = await prisma.lead.create({
    data: {
      source: "RENTFASTER",
      unitId: unit?.id ?? null,
      contactName: parsed.contactName,
      contactPhone: parsed.contactPhone,
      contactEmail: parsed.contactEmail,
      requestedMoveInDate: parsed.requestedMoveInDate,
      message: formatLeadMessage(parsed) || null,
      externalRef: parsed.externalRef,
    },
  });

  await prisma.communicationLog.create({
    data: {
      leadId: lead.id,
      channel: "EMAIL",
      direction: "INBOUND",
      summary: `RentFaster inquiry${parsed.comments ? `: ${parsed.comments}` : ""}`,
      // null = handled by this automated import, not a person.
      handledById: null,
    },
  });

  revalidatePath("/leads");
  revalidatePath("/communications");

  return NextResponse.json({ ok: true, leadId: lead.id, matchedUnit: !!unit });
}

// Only auto-links a lead to a specific unit when the listing details
// narrow it down to exactly one — anything less certain is left for
// staff to link by hand rather than risk pointing a lead at the wrong
// unit. The listing text is preserved in Lead.message either way.
async function matchListingToUnit(listing: {
  location: string | null;
  bedrooms: number | null;
  monthlyRent: number | null;
}) {
  if (listing.bedrooms == null && !listing.location) return null;

  const neighbourhood = listing.location?.split(",")[0]?.trim();
  const candidates = await prisma.unit.findMany({
    where: {
      ...(listing.bedrooms != null
        ? { bedrooms: Math.round(listing.bedrooms) }
        : {}),
      ...(neighbourhood
        ? {
            projectEntity: {
              neighbourhood: { contains: neighbourhood, mode: "insensitive" },
            },
          }
        : {}),
    },
  });

  let narrowed = candidates;
  if (narrowed.length > 1 && listing.monthlyRent != null) {
    const rent = listing.monthlyRent;
    narrowed = narrowed.filter(
      (u) => Math.abs(Number(u.currentRent) - rent) < 50,
    );
  }

  return narrowed.length === 1 ? narrowed[0] : null;
}
