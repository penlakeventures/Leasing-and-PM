import { describe, it, expect } from "vitest";
import { unitPremises, buildLeaseRenewalMergeFields, splitLongDate } from "./lease-document";

describe("unitPremises", () => {
  it("pairs the unit's own civic address with Calgary, AB — no 'Unit' prefix or neighbourhood", () => {
    // Confirmed against a real signed test lease: staff didn't want the
    // "Unit" prefix (it isn't a numbered unit within a shared building,
    // just its own street address) or the neighbourhood name repeated.
    expect(unitPremises("3768 23 AVE SW")).toBe("3768 23 AVE SW, Calgary, AB");
    expect(unitPremises("810 14 ST SE")).toBe("810 14 ST SE, Calgary, AB");
  });
});

describe("splitLongDate", () => {
  it("splits a formatLongDate()-shaped string into day/month/2-digit-year, dropping the ordinal suffix", () => {
    // The suffix is dropped (not just the formatting) because Dropbox
    // Sign enforces a max text length per field based on its physical
    // box size, and the "Day" box sized to the original tiny blank has
    // no room for "26th" — confirmed against a real rejection.
    expect(splitLongDate("26th day of November, 2026")).toEqual({
      day: "26",
      month: "November",
      year: "26",
    });
    expect(splitLongDate("1st day of March, 2027")).toEqual({
      day: "1",
      month: "March",
      year: "27",
    });
  });

  it("falls back to putting the whole string in `day` if it doesn't match that shape", () => {
    expect(splitLongDate("November 26, 2026")).toEqual({
      day: "November 26, 2026",
      month: "",
      year: "",
    });
  });
});

describe("buildLeaseRenewalMergeFields", () => {
  it("checks 'rent unchanged' and leaves the amount/effective-date blanks empty when rent isn't changing", () => {
    const fields = buildLeaseRenewalMergeFields({
      landlordName: "Killarney23 Inc.",
      tenantNames: ["Lauren Munroe"],
      premises: "Unit 2746B 23 AVE SW, Killarney, Calgary, AB",
      originalLeaseDate: new Date(2025, 0, 1),
      renewalStart: new Date(2026, 11, 1),
      renewalEnd: new Date(2027, 11, 30),
      rentChanged: false,
      newRentAmount: 1700,
    });
    expect(fields.original_lease_date).toBe("1st day of January, 2025");
    expect(fields.tenant_names).toBe("Lauren Munroe");
    expect(fields.landlord_name_b).toBe("Killarney23 Inc.");
    expect(fields.tenant_name_1).toBe("Lauren Munroe");
    expect(fields.tenant_name_2).toBe("");
    expect(fields.renewal_term_start).toBe("1st day of December, 2026");
    expect(fields.renewal_term_end).toBe("30th day of December, 2027");
    expect(fields.rent_unchanged).toBe("true");
    expect(fields.rent_amended).toBe("false");
    expect(fields.new_rent_amount).toBe("");
    expect(fields.rent_effective_date).toBe("");
    expect(fields.additional_conditions).toBe("None.");
  });

  it("checks 'rent amended' and fills the amount/effective date when rent is changing", () => {
    const fields = buildLeaseRenewalMergeFields({
      landlordName: "Killarney23 Inc.",
      tenantNames: ["Lauren Munroe", "Sam Munroe"],
      premises: "Unit 2746B 23 AVE SW, Killarney, Calgary, AB",
      originalLeaseDate: new Date(2025, 0, 1),
      renewalStart: new Date(2026, 11, 1),
      renewalEnd: new Date(2027, 11, 30),
      rentChanged: true,
      newRentAmount: 1750,
      newPets: "cat",
      newLeaseTerms: "Tenant to repaint the hallway by spring.",
    });
    expect(fields.tenant_names).toBe("Lauren Munroe and Sam Munroe");
    expect(fields.tenant_name_2).toBe("Sam Munroe");
    expect(fields.rent_unchanged).toBe("false");
    expect(fields.rent_amended).toBe("true");
    expect(fields.new_rent_amount).toBe("$1,750.00");
    expect(fields.rent_effective_date).toBe("1st day of December, 2026");
    expect(fields.additional_conditions).toBe(
      "Pets for this renewal: cat. Tenant to repaint the hallway by spring.",
    );
  });
});
