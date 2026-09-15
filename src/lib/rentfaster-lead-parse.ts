// Parses a RentFaster.ca "someone is interested in your listing" email into
// structured lead data. Built from a real sample forwarded by the owner
// (the HTML rendering, not the raw plain-text source) — the exact
// whitespace/line-break layout of RentFaster's actual plain-text body is
// still unconfirmed, so this extracts fields by finding each label and
// reading everything up to the next known label, which tolerates the
// separator being a colon, a line break, or plain whitespace. Once real
// inbound emails are flowing through the webhook, re-check this against
// an actual delivered message and tighten it up if anything is off.

export type ParsedRentFasterLead = {
  externalRef: string | null;
  propertyId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  requestedMoveInDate: Date | null;
  comments: string | null;
  listing: {
    location: string | null;
    rentalType: string | null;
    address: string | null;
    monthlyRent: number | null;
    bedrooms: number | null;
    availability: string | null;
  };
};

// Reads the text between `label` and whichever of `stopLabels` appears
// next (or the end of the string), trimming leading punctuation/whitespace
// left over from a ":" or line break separator.
function extractField(
  text: string,
  label: string,
  stopLabels: string[],
): string | null {
  const start = text.indexOf(label);
  if (start === -1) return null;
  const afterLabel = text.slice(start + label.length);

  let end = afterLabel.length;
  for (const stop of stopLabels) {
    const i = afterLabel.indexOf(stop);
    if (i !== -1 && i < end) end = i;
  }

  const value = afterLabel
    .slice(0, end)
    .replace(/^[\s:]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  return value || null;
}

function parseMoveInDate(raw: string | null): Date | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes("negotiable") || lower.includes("asap") || lower.includes("flexible")) {
    return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseRent(raw: string | null): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9.]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isNaN(n) ? null : n;
}

function parseBedrooms(raw: string | null): number | null {
  if (!raw) return null;
  const match = raw.match(/[\d.]+/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isNaN(n) ? null : n;
}

export function parseRentFasterLeadEmail({
  subject,
  text,
  replyTo,
}: {
  subject: string;
  text: string;
  replyTo?: string | null;
}): ParsedRentFasterLead {
  const propertyIdMatch = subject.match(/ID\s*(\d+)/i);
  const propertyId = propertyIdMatch ? propertyIdMatch[1] : null;

  // RentFaster routes replies through a per-lead relay address like
  // "r-<token>@mail.rentfaster.ca" — that token is a stable per-inquiry
  // identifier, useful as a dedupe key even before we look at the body.
  const replyTokenMatch = (replyTo ?? "").match(/r-([A-Za-z0-9-]+)@mail\.rentfaster\.ca/i);
  const externalRef = replyTokenMatch
    ? `rentfaster:${replyTokenMatch[1]}`
    : propertyId
      ? `rentfaster:${propertyId}:${text.length}` // weak fallback — better than no dedupe at all
      : null;

  const labels = [
    "Location",
    "Rental Type",
    "Address",
    "Monthly Rent",
    "Bedrooms",
    "Availability Date",
    "Name",
    "Email",
    "Phone Number",
    "Requested Move in Date",
    "Comments",
    "Credit Check",
  ];
  const field = (label: string) => {
    const idx = labels.indexOf(label);
    const stopLabels = idx === -1 ? [] : labels.slice(idx + 1);
    return extractField(text, label, stopLabels);
  };

  const emailMatch = (field("Email") ?? "").match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const phoneRaw = field("Phone Number");
  const phone = phoneRaw ? phoneRaw.replace(/[^\d+]/g, "") : null;

  return {
    externalRef,
    propertyId,
    contactName: field("Name"),
    contactEmail: emailMatch ? emailMatch[0] : null,
    contactPhone: phone,
    requestedMoveInDate: parseMoveInDate(field("Requested Move in Date")),
    comments: field("Comments"),
    listing: {
      location: field("Location"),
      rentalType: field("Rental Type"),
      address: field("Address"),
      monthlyRent: parseRent(field("Monthly Rent")),
      bedrooms: parseBedrooms(field("Bedrooms")),
      availability: field("Availability Date"),
    },
  };
}

// Builds the free-text summary stored on Lead.message when we can't
// confidently auto-link to a specific unit — keeps the listing details
// and the lead's own comments visible on the lead record either way.
export function formatLeadMessage(parsed: ParsedRentFasterLead): string {
  const { listing } = parsed;
  const listingLine = [
    listing.rentalType,
    listing.address,
    listing.location,
    listing.bedrooms != null ? `${listing.bedrooms} bd` : null,
    listing.monthlyRent != null ? `$${listing.monthlyRent}/mo` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const lines = [];
  if (listingLine) lines.push(`Listing: ${listingLine}`);
  if (parsed.propertyId) lines.push(`RentFaster property ID: ${parsed.propertyId}`);
  if (parsed.comments) lines.push(`Comments: ${parsed.comments}`);
  return lines.join("\n");
}
