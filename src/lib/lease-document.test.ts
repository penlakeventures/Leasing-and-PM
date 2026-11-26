import { describe, it, expect } from "vitest";
import { unitPremises, buildLeaseRenewalMergeFields } from "./lease-document";

describe("unitPremises", () => {
  it("keeps only the city/province tail of a multi-building project's composite address", () => {
    // Real case: Killarney23 spans several streets, so its own Address
    // lists all of them — only the neighbourhood-onward tail belongs in
    // a single unit's premises.
    expect(
      unitPremises(
        "3768 23 AVE SW",
        "3760, 3764, 3768 23 AVE SW & 2240 37th ST SW, Killarney, Calgary, AB",
        "Killarney",
      ),
    ).toBe("Unit 3768 23 AVE SW, Killarney, Calgary, AB");
  });

  it("works the same for a single-street project whose Address also leads with a street number", () => {
    expect(
      unitPremises("810 14 ST SE", "810 14 ST SE, Inglewood, Calgary, AB", "Inglewood"),
    ).toBe("Unit 810 14 ST SE, Inglewood, Calgary, AB");
  });

  it("works when the project's Address has no leading street number at all", () => {
    expect(unitPremises("203", "Killarney, Calgary, AB", "Killarney")).toBe(
      "Unit 203, Killarney, Calgary, AB",
    );
  });

  it("falls back to the full address rather than crashing if the neighbourhood isn't found in it", () => {
    expect(unitPremises("203", "Calgary, AB", "Killarney")).toBe("Unit 203, Calgary, AB");
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
