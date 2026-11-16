import { describe, it, expect } from "vitest";
import { parseRentFasterLeadEmail, formatLeadMessage } from "./rentfaster-lead-parse";

const sampleBody = [
  "Location: Killarney, Calgary, AB",
  "Rental Type: Apartment",
  "Address: 123 - 20 Ave SW",
  "Monthly Rent: $1,650",
  "Bedrooms: 2",
  "Availability Date: Dec 1, 2026",
  "Name: Jane Smith",
  "Email: jane.smith@example.com",
  "Phone Number: (403) 555-1234",
  "Requested Move in Date: 2026-12-01",
  "Comments: Looking for a pet-friendly unit near downtown.",
  "Credit Check: Pending",
].join("\n");

describe("parseRentFasterLeadEmail", () => {
  it("extracts every field from a well-formed inquiry email", () => {
    const parsed = parseRentFasterLeadEmail({
      subject: "New inquiry for Listing ID 123456",
      text: sampleBody,
      replyTo: "r-abc123XYZ@mail.rentfaster.ca",
    });

    expect(parsed.propertyId).toBe("123456");
    expect(parsed.externalRef).toBe("rentfaster:abc123XYZ");
    expect(parsed.contactName).toBe("Jane Smith");
    expect(parsed.contactEmail).toBe("jane.smith@example.com");
    expect(parsed.contactPhone).toBe("4035551234");
    expect(parsed.requestedMoveInDate).toBeInstanceOf(Date);
    expect(parsed.requestedMoveInDate?.getUTCFullYear()).toBe(2026);
    expect(parsed.requestedMoveInDate?.getUTCMonth()).toBe(11); // December
    expect(parsed.comments).toBe("Looking for a pet-friendly unit near downtown.");
    expect(parsed.listing).toEqual({
      location: "Killarney, Calgary, AB",
      rentalType: "Apartment",
      address: "123 - 20 Ave SW",
      monthlyRent: 1650,
      bedrooms: 2,
      availability: "Dec 1, 2026",
    });
  });

  it("falls back to a property-id-based externalRef when there's no reply-to relay address", () => {
    const parsed = parseRentFasterLeadEmail({
      subject: "New inquiry for Listing ID 999",
      text: sampleBody,
      replyTo: null,
    });
    expect(parsed.externalRef).toBe(`rentfaster:999:${sampleBody.length}`);
  });

  it("has no externalRef at all when there's neither a reply-to token nor a property id", () => {
    const parsed = parseRentFasterLeadEmail({
      subject: "A generic inquiry with no listing reference",
      text: sampleBody,
      replyTo: null,
    });
    expect(parsed.externalRef).toBeNull();
  });

  it("treats 'ASAP' / 'negotiable' / 'flexible' move-in dates as unparsed rather than inventing a date", () => {
    for (const phrase of ["ASAP", "Negotiable", "Flexible, within reason"]) {
      const text = sampleBody.replace("2026-12-01", phrase);
      const parsed = parseRentFasterLeadEmail({ subject: "ID 1", text, replyTo: null });
      expect(parsed.requestedMoveInDate).toBeNull();
    }
  });

  it("returns null fields gracefully when a section is simply missing", () => {
    const sparseText = "Name: Bob\nEmail: bob@example.com";
    const parsed = parseRentFasterLeadEmail({ subject: "ID 1", text: sparseText, replyTo: null });
    expect(parsed.contactName).toBe("Bob");
    expect(parsed.contactEmail).toBe("bob@example.com");
    expect(parsed.contactPhone).toBeNull();
    expect(parsed.listing.monthlyRent).toBeNull();
    expect(parsed.listing.bedrooms).toBeNull();
  });

  it("parses a fractional bedroom count like a loft/den listing", () => {
    const text = sampleBody.replace("Bedrooms: 2", "Bedrooms: 2.5");
    const parsed = parseRentFasterLeadEmail({ subject: "ID 1", text, replyTo: null });
    expect(parsed.listing.bedrooms).toBe(2.5);
  });

  it("doesn't choke on a non-numeric bedrooms value", () => {
    const text = sampleBody.replace("Bedrooms: 2", "Bedrooms: Studio");
    const parsed = parseRentFasterLeadEmail({ subject: "ID 1", text, replyTo: null });
    expect(parsed.listing.bedrooms).toBeNull();
  });
});

describe("formatLeadMessage", () => {
  it("combines the listing summary, property id and comments into one readable block", () => {
    const parsed = parseRentFasterLeadEmail({
      subject: "New inquiry for Listing ID 123456",
      text: sampleBody,
      replyTo: null,
    });
    const message = formatLeadMessage(parsed);
    expect(message).toContain("Apartment");
    expect(message).toContain("123 - 20 Ave SW");
    expect(message).toContain("2 bd");
    expect(message).toContain("$1650/mo");
    expect(message).toContain("RentFaster property ID: 123456");
    expect(message).toContain("Looking for a pet-friendly unit near downtown.");
  });

  it("produces an empty string rather than throwing when there's nothing to say", () => {
    const parsed = parseRentFasterLeadEmail({ subject: "no id here", text: "", replyTo: null });
    expect(formatLeadMessage(parsed)).toBe("");
  });
});
