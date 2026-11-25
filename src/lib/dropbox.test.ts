import { describe, it, expect } from "vitest";
import { matchesUnitFolder } from "./dropbox";

describe("matchesUnitFolder", () => {
  it("matches when the unit number leads the folder name", () => {
    expect(matchesUnitFolder("3220B Taylor", "3220B")).toBe(true);
  });

  it("matches when the unit number appears after a list prefix", () => {
    expect(matchesUnitFolder("1. 810 14 ST SE - Pen Lake Ventures Inc", "810")).toBe(true);
  });

  it("does not match a different unit whose number is a substring (e.g. 802 vs 802R)", () => {
    expect(matchesUnitFolder("802R 14 ST SE - Pen Lake Ventures Inc", "802")).toBe(false);
    expect(matchesUnitFolder("802 14 ST SE - Pen Lake Ventures Inc", "802R")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(matchesUnitFolder("3220b taylor", "3220B")).toBe(true);
  });

  it("does not match an unrelated folder", () => {
    expect(matchesUnitFolder("Past tenants", "810")).toBe(false);
  });

  it("escapes regex special characters in the unit number instead of treating them as patterns", () => {
    // A unit number like "1.5" shouldn't let the "." match literally any
    // character — only an actual "." should count as a match.
    expect(matchesUnitFolder("Unit 1.5 - Suite", "1.5")).toBe(true);
    expect(matchesUnitFolder("Unit 1X5 - Suite", "1.5")).toBe(false);
  });

  it("tolerates an ordinal suffix on the street number that the folder name doesn't have", () => {
    // Real case: the unit's own address was typed as "2240 37th ST SW",
    // but the actual Dropbox folder (named in the plain postal style) is
    // "2240 37 ST SW" — no "th". Without stripping it, this unit would
    // never match its own folder at all.
    expect(matchesUnitFolder("1. 2240 37 ST SW - Pedro Santos", "2240 37th ST SW")).toBe(true);
  });

  it("does not match a suited unit to its un-suited sibling's folder", () => {
    expect(matchesUnitFolder("1. 2240 37 ST SW - Pedro Santos", "2240B 37th ST SW")).toBe(false);
  });

  it("does not match a house number to a different street in the same project", () => {
    // "2240" exists on both "37 ST SW" (unsuited) and, coincidentally,
    // "2240B" exists on "23 AVE SW" in the same project — a unit genuinely
    // addressed as "2240B 37th ST SW" must not match either of those,
    // since neither is actually it.
    expect(matchesUnitFolder("2. 2240B 23 AVE SW - Dylan Jackson", "2240B 37th ST SW")).toBe(false);
  });

  it("matches the full street name and suite letter together", () => {
    expect(
      matchesUnitFolder("8. 3760B 23 AVE SW - David Okemakinde, Rachel Yee", "3760B 23 AVE SW"),
    ).toBe(true);
  });
});
