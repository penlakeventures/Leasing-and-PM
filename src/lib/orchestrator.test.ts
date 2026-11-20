import { describe, it, expect } from "vitest";
import { buildTenantContext, buildLeadContext } from "./orchestrator";

describe("buildTenantContext", () => {
  const unit = {
    unitNumber: "203",
    bedrooms: 2,
    projectEntity: { internalName: "Killarney23", address: "123 23 Ave SW" },
  };

  it("describes a fixed-term lease with rent, unit and dates", () => {
    const context = buildTenantContext(
      { name: "Jane Doe" },
      {
        rentAmount: "1650.00",
        startDate: new Date(Date.UTC(2026, 0, 1)),
        endDate: new Date(Date.UTC(2026, 11, 31)),
        periodic: false,
        unit,
      },
    );
    expect(context).toContain("Tenant: Jane Doe.");
    expect(context).toContain("Killarney23 — Unit 203, 2 bedroom(s), address 123 23 Ave SW.");
    expect(context).toContain("Rent: $1650.00/month, due on the 1st of each month.");
    expect(context).toContain("Lease type: fixed-term,");
  });

  it("describes a periodic lease without an end date", () => {
    const context = buildTenantContext(
      { name: "Bob Smith" },
      {
        rentAmount: "1500.00",
        startDate: new Date(Date.UTC(2024, 0, 1)),
        endDate: null,
        periodic: true,
        unit,
      },
    );
    expect(context).toContain("Lease type: month-to-month (periodic)");
    expect(context).not.toContain("no end date on file");
  });

  it("flags a tenant with no active lease on file, rather than throwing", () => {
    const context = buildTenantContext({ name: "No Lease Guy" }, null);
    expect(context).toContain("No active lease/unit on file for this tenant.");
  });
});

describe("buildLeadContext", () => {
  const unit = {
    unitNumber: "105",
    bedrooms: 1,
    currentRent: "1200.00",
    projectEntity: { internalName: "Shaganappi31", address: "456 31 Ave NW" },
  };

  it("includes the unit, move-in date, screening answers and original message when all are present", () => {
    const context = buildLeadContext({
      contactName: "Alex Lee",
      source: "RENTFASTER",
      status: "NEW",
      requestedMoveInDate: new Date(Date.UTC(2026, 11, 1)),
      message: "Asked about parking availability.",
      occupantCount: 2,
      pets: "dog",
      reasonForMoving: "Relocating for work",
      moveInFlexible: true,
      employmentNotes: "Full-time, works from home",
      unit,
    });
    expect(context).toContain("Prospective tenant: Alex Lee.");
    expect(context).toContain("Inquiry source: RENTFASTER.");
    expect(context).toContain("Shaganappi31 — Unit 105, 1 bedroom(s), current rent $1200.00");
    expect(context).toContain("Requested move-in date on file:");
    expect(context).toContain("Number of occupants: 2.");
    expect(context).toContain("Pets: dog.");
    expect(context).toContain("Reason for moving: Relocating for work.");
    expect(context).toContain("Flexible on move-in date: yes.");
    expect(context).toContain("Employment notes: Full-time, works from home.");
    expect(context).toContain("Notes/original inquiry: Asked about parking availability.");
    expect(context).toContain("Current status in our system: NEW.");
  });

  it("handles an unnamed, unit-less general inquiry without optional fields", () => {
    const context = buildLeadContext({
      contactName: null,
      source: "FACEBOOK_MARKETPLACE",
      status: "NEW",
      requestedMoveInDate: null,
      message: null,
      occupantCount: null,
      pets: null,
      reasonForMoving: null,
      moveInFlexible: null,
      employmentNotes: null,
      unit: null,
    });
    expect(context).toContain("Prospective tenant: name unknown.");
    expect(context).toContain("Not tied to a specific unit — general interest inquiry.");
    expect(context).not.toContain("Requested move-in date");
    expect(context).not.toContain("Number of occupants");
    expect(context).not.toContain("Pets:");
    expect(context).not.toContain("Reason for moving");
    expect(context).not.toContain("Flexible on move-in date");
    expect(context).not.toContain("Employment notes");
    expect(context).not.toContain("Notes/original inquiry");
  });
});
