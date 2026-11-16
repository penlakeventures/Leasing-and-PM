import { describe, it, expect } from "vitest";
import { localWallClockToUtc } from "./google-calendar";

describe("localWallClockToUtc", () => {
  it("converts a summer (MDT, UTC-6) local time correctly", () => {
    expect(localWallClockToUtc("2026-07-15T14:30", "America/Edmonton").toISOString()).toBe(
      "2026-07-15T20:30:00.000Z",
    );
  });

  it("converts a winter (MST, UTC-7) local time correctly", () => {
    expect(localWallClockToUtc("2026-01-15T14:30", "America/Edmonton").toISOString()).toBe(
      "2026-01-15T21:30:00.000Z",
    );
  });

  it("handles local midnight on New Year's Day", () => {
    expect(localWallClockToUtc("2026-01-01T00:00", "America/Edmonton").toISOString()).toBe(
      "2026-01-01T07:00:00.000Z",
    );
  });

  it("round-trips back to the same wall-clock reading when reformatted in that timezone", () => {
    const utc = localWallClockToUtc("2026-09-03T09:15", "America/Edmonton");
    const formatted = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Edmonton",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(utc);
    expect(formatted).toBe("2026-09-03, 09:15");
  });
});
