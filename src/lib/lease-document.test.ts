import { describe, it, expect } from "vitest";
import { unitPremises } from "./lease-document";

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
