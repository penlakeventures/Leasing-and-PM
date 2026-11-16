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
});
