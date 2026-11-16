import { describe, it, expect } from "vitest";
import { monthStart, shiftMonth, formatMonth, totalExpense, EXPENSE_CATEGORIES } from "./finance";

describe("monthStart", () => {
  it("normalizes to UTC midnight of the 1st of the given date's month", () => {
    const d = new Date(Date.UTC(2026, 10, 17, 23, 59, 59));
    expect(monthStart(d).toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });
});

describe("shiftMonth", () => {
  const base = new Date(Date.UTC(2026, 10, 1));

  it("moves forward across a year boundary", () => {
    expect(shiftMonth(base, 2).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("moves backward across a year boundary", () => {
    expect(shiftMonth(base, -11).toISOString()).toBe("2025-12-01T00:00:00.000Z");
  });

  it("delta 0 returns the same month", () => {
    expect(shiftMonth(base, 0).toISOString()).toBe(base.toISOString());
  });
});

describe("formatMonth", () => {
  it("formats using UTC so the stored month marker never shifts", () => {
    // 11pm UTC on the 30th would read as the next month in most negative
    // timezones if formatted without timeZone: "UTC" — this is exactly
    // the bug class the comment in finance.ts warns about.
    const d = new Date(Date.UTC(2026, 10, 1, 0, 0, 0));
    expect(formatMonth(d)).toBe("November 2026");
  });
});

describe("totalExpense", () => {
  it("sums every category", () => {
    const expense = Object.fromEntries(EXPENSE_CATEGORIES.map((c, i) => [c.key, i + 1]));
    const expectedSum = EXPENSE_CATEGORIES.reduce((sum, _c, i) => sum + (i + 1), 0);
    expect(totalExpense(expense as never)).toBe(expectedSum);
  });

  it("treats a missing category as zero", () => {
    expect(totalExpense({ mortgage: 500 } as never)).toBe(500);
  });

  it("returns 0 for null or undefined", () => {
    expect(totalExpense(null)).toBe(0);
    expect(totalExpense(undefined)).toBe(0);
  });

  it("coerces Prisma Decimal-like string values to numbers", () => {
    // In real use these fields come back as Prisma Decimal objects that
    // stringify to a plain numeric string, not a JS number.
    expect(totalExpense({ mortgage: "500.50", propertyTax: "100.25" } as never)).toBeCloseTo(600.75);
  });
});
