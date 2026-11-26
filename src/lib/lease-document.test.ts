import { describe, it, expect } from "vitest";
import { unitPremises, buildLeaseRenewalMergeFields } from "./lease-document";

describe("unitPremises", () => {
  it("pairs the unit's own civic address with its project's neighbourhood and Calgary, AB", () => {
    // Real case: Killarney23's own Address is now the city-assigned
    // project address (a different address than any unit in it) — the
    // unit's premises no longer derives from that field at all.
    expect(unitPremises("3768 23 AVE SW", "Killarney")).toBe(
      "Unit 3768 23 AVE SW, Killarney, Calgary, AB",
    );
  });

  it("works the same for any other project's neighbourhood", () => {
    expect(unitPremises("810 14 ST SE", "Inglewood")).toBe(
      "Unit 810 14 ST SE, Inglewood, Calgary, AB",
    );
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
