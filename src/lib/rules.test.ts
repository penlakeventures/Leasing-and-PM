import { describe, it, expect } from "vitest";
import {
  pickActiveLease,
  checkRentEscalation,
  checkSecurityDepositAmount,
  checkRentIncreaseNotice,
  needsRenewalDecision,
  rentIncreaseNoticeWindow,
  isRentIncreaseNoticeDeadlineNear,
  depositReturnDeadline,
  isDepositOverdue,
  isRentOverdue,
  unitNeedsRenewalAttention,
  isDepositInterestStale,
} from "./rules";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));

describe("pickActiveLease", () => {
  const base = { startDate: d(2026, 1, 1), endDate: d(2026, 6, 30), periodic: false };

  it("picks the most recently started lease that's currently active", () => {
    const older = { ...base, startDate: d(2025, 1, 1), endDate: d(2025, 12, 31) };
    const newer = { ...base, startDate: d(2026, 1, 1), endDate: d(2026, 12, 31) };
    expect(pickActiveLease([older, newer], d(2026, 6, 1))).toBe(newer);
  });

  it("ignores a lease that hasn't started yet", () => {
    const future = { ...base, startDate: d(2027, 1, 1), endDate: null };
    expect(pickActiveLease([future], d(2026, 6, 1))).toBeNull();
  });

  it("ignores a fixed-term lease that has already ended", () => {
    const ended = { ...base, startDate: d(2025, 1, 1), endDate: d(2025, 6, 30) };
    expect(pickActiveLease([ended], d(2026, 1, 1))).toBeNull();
  });

  it("treats a periodic lease as active regardless of its endDate", () => {
    const periodic = { startDate: d(2020, 1, 1), endDate: d(2020, 12, 31), periodic: true };
    expect(pickActiveLease([periodic], d(2026, 6, 1))).toBe(periodic);
  });

  it("returns null for an empty list", () => {
    expect(pickActiveLease([], d(2026, 6, 1))).toBeNull();
  });
});

describe("checkRentEscalation", () => {
  it("never caps a market-designated unit", () => {
    const result = checkRentEscalation({
      cmhcDesignation: "MARKET",
      currentRent: 1000,
      proposedRent: 5000,
      cpiRatePercent: 2,
    });
    expect(result).toEqual({ allowed: true, maxAllowedRent: null });
  });

  it("blocks an affordable-unit change with no CPI rate on file", () => {
    const result = checkRentEscalation({
      cmhcDesignation: "AFFORDABLE",
      currentRent: 1000,
      proposedRent: 1010,
      cpiRatePercent: null,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/No CPI rate is on file/);
  });

  it("allows an affordable-unit increase exactly at the CPI cap", () => {
    const result = checkRentEscalation({
      cmhcDesignation: "AFFORDABLE",
      currentRent: 1000,
      proposedRent: 1025,
      cpiRatePercent: 2.5,
    });
    expect(result).toEqual({ allowed: true, maxAllowedRent: 1025 });
  });

  it("blocks an affordable-unit increase one cent over the CPI cap", () => {
    const result = checkRentEscalation({
      cmhcDesignation: "AFFORDABLE",
      currentRent: 1000,
      proposedRent: 1025.01,
      cpiRatePercent: 2.5,
    });
    expect(result.allowed).toBe(false);
    expect(result.maxAllowedRent).toBe(1025);
    expect(result.reason).toMatch(/capped at annual CPI/);
  });

  it("allows an affordable-unit decrease", () => {
    const result = checkRentEscalation({
      cmhcDesignation: "AFFORDABLE",
      currentRent: 1000,
      proposedRent: 900,
      cpiRatePercent: 2.5,
    });
    expect(result.allowed).toBe(true);
  });
});

describe("checkSecurityDepositAmount", () => {
  it("blocks a deposit over one month's rent", () => {
    const result = checkSecurityDepositAmount({ depositAmount: 1501, monthlyRent: 1500 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/one month's rent/);
  });

  it("allows a deposit equal to one month's rent", () => {
    expect(checkSecurityDepositAmount({ depositAmount: 1500, monthlyRent: 1500 }).allowed).toBe(true);
  });

  it("blocks increasing an already-set deposit", () => {
    const result = checkSecurityDepositAmount({
      depositAmount: 1200,
      monthlyRent: 1500,
      existingAmount: 1000,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/cannot be increased/);
  });

  it("allows decreasing an already-set deposit", () => {
    const result = checkSecurityDepositAmount({
      depositAmount: 800,
      monthlyRent: 1500,
      existingAmount: 1000,
    });
    expect(result.allowed).toBe(true);
  });

  it("allows an unchanged deposit amount", () => {
    const result = checkSecurityDepositAmount({
      depositAmount: 1000,
      monthlyRent: 1500,
      existingAmount: 1000,
    });
    expect(result.allowed).toBe(true);
  });
});

describe("checkRentIncreaseNotice", () => {
  const leaseStartDate = d(2024, 6, 15);

  it("always allows a change on a non-periodic (fixed-term) lease", () => {
    const result = checkRentIncreaseNotice({
      periodic: false,
      leaseStartDate,
      lastRentIncreaseDate: null,
      currentRent: 1000,
      proposedRent: 2000,
      noticeGivenDate: null,
      asOf: d(2024, 7, 1),
    });
    expect(result.allowed).toBe(true);
  });

  it("always allows a decrease or no-change on a periodic lease, no notice required", () => {
    const result = checkRentIncreaseNotice({
      periodic: true,
      leaseStartDate,
      lastRentIncreaseDate: null,
      currentRent: 1000,
      proposedRent: 1000,
      noticeGivenDate: null,
      asOf: d(2024, 7, 1),
    });
    expect(result.allowed).toBe(true);
  });

  it("blocks an increase before 365 days since the anchor have elapsed", () => {
    const asOf = new Date(leaseStartDate.getTime() + 364 * MS_PER_DAY);
    const result = checkRentIncreaseNotice({
      periodic: true,
      leaseStartDate,
      lastRentIncreaseDate: null,
      currentRent: 1000,
      proposedRent: 1100,
      noticeGivenDate: null,
      asOf,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/every 365 days/);
  });

  it("requires a notice date once 365 days have elapsed", () => {
    const asOf = new Date(leaseStartDate.getTime() + 365 * MS_PER_DAY);
    const result = checkRentIncreaseNotice({
      periodic: true,
      leaseStartDate,
      lastRentIncreaseDate: null,
      currentRent: 1000,
      proposedRent: 1100,
      noticeGivenDate: null,
      asOf,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/requires written notice/);
  });

  it("blocks when notice was given less than 3 months before asOf", () => {
    const asOf = new Date(leaseStartDate.getTime() + 365 * MS_PER_DAY);
    const noticeGivenDate = new Date(asOf);
    noticeGivenDate.setMonth(noticeGivenDate.getMonth() - 2); // only 2 months' notice
    const result = checkRentIncreaseNotice({
      periodic: true,
      leaseStartDate,
      lastRentIncreaseDate: null,
      currentRent: 1000,
      proposedRent: 1100,
      noticeGivenDate,
      asOf,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/at least 3 months/);
  });

  it("allows when notice was given exactly 3 months before asOf", () => {
    const asOf = new Date(leaseStartDate.getTime() + 365 * MS_PER_DAY);
    const noticeGivenDate = new Date(asOf);
    noticeGivenDate.setMonth(noticeGivenDate.getMonth() - 3);
    const result = checkRentIncreaseNotice({
      periodic: true,
      leaseStartDate,
      lastRentIncreaseDate: null,
      currentRent: 1000,
      proposedRent: 1100,
      noticeGivenDate,
      asOf,
    });
    expect(result.allowed).toBe(true);
  });

  it("anchors to lastRentIncreaseDate instead of leaseStartDate once one exists", () => {
    const lastRentIncreaseDate = d(2026, 1, 1);
    // Well past 365 days since the original lease start, but less than a
    // year since the last recorded increase — should still be blocked.
    const asOf = new Date(lastRentIncreaseDate.getTime() + 100 * MS_PER_DAY);
    const result = checkRentIncreaseNotice({
      periodic: true,
      leaseStartDate: d(2020, 1, 1),
      lastRentIncreaseDate,
      currentRent: 1000,
      proposedRent: 1100,
      noticeGivenDate: null,
      asOf,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/every 365 days/);
  });
});

describe("needsRenewalDecision", () => {
  const endDate = d(2026, 12, 31);

  it("is false for a periodic lease even near its nominal end date", () => {
    expect(
      needsRenewalDecision({ periodic: true, endDate, hasSuccessorLease: false, asOf: endDate }),
    ).toBe(false);
  });

  it("is false when there's no end date", () => {
    expect(
      needsRenewalDecision({ periodic: false, endDate: null, hasSuccessorLease: false, asOf: d(2026, 12, 1) }),
    ).toBe(false);
  });

  it("is false once a successor lease already exists", () => {
    expect(
      needsRenewalDecision({ periodic: false, endDate, hasSuccessorLease: true, asOf: endDate }),
    ).toBe(false);
  });

  it("is false just outside the 90-day window", () => {
    const asOf = new Date(endDate.getTime() - 91 * MS_PER_DAY);
    expect(needsRenewalDecision({ periodic: false, endDate, hasSuccessorLease: false, asOf })).toBe(false);
  });

  it("is true right at the 90-day window boundary", () => {
    const asOf = new Date(endDate.getTime() - 90 * MS_PER_DAY);
    expect(needsRenewalDecision({ periodic: false, endDate, hasSuccessorLease: false, asOf })).toBe(true);
  });

  it("stays true even after the end date has passed with nothing arranged", () => {
    const asOf = new Date(endDate.getTime() + 30 * MS_PER_DAY);
    expect(needsRenewalDecision({ periodic: false, endDate, hasSuccessorLease: false, asOf })).toBe(true);
  });
});

describe("rentIncreaseNoticeWindow", () => {
  it("computes the next eligible date and the 3-months-earlier notice deadline", () => {
    const leaseStartDate = d(2025, 1, 15);
    const { nextEligibleDate, noticeDeadline } = rentIncreaseNoticeWindow({
      lastRentIncreaseDate: null,
      leaseStartDate,
    });
    expect(nextEligibleDate.getTime()).toBe(leaseStartDate.getTime() + 365 * MS_PER_DAY);
    const expectedDeadline = new Date(nextEligibleDate);
    expectedDeadline.setMonth(expectedDeadline.getMonth() - 3);
    expect(noticeDeadline.getTime()).toBe(expectedDeadline.getTime());
  });

  it("anchors to lastRentIncreaseDate when one is on file", () => {
    const lastRentIncreaseDate = d(2026, 3, 1);
    const { nextEligibleDate } = rentIncreaseNoticeWindow({
      lastRentIncreaseDate,
      leaseStartDate: d(2020, 1, 1),
    });
    expect(nextEligibleDate.getTime()).toBe(lastRentIncreaseDate.getTime() + 365 * MS_PER_DAY);
  });
});

describe("isRentIncreaseNoticeDeadlineNear", () => {
  const noticeDeadline = d(2026, 6, 1);

  it("is false well before the default 30-day lookahead", () => {
    const asOf = new Date(noticeDeadline.getTime() - 31 * MS_PER_DAY);
    expect(isRentIncreaseNoticeDeadlineNear({ noticeDeadline, asOf })).toBe(false);
  });

  it("is true exactly at the default 30-day lookahead boundary", () => {
    const asOf = new Date(noticeDeadline.getTime() - 30 * MS_PER_DAY);
    expect(isRentIncreaseNoticeDeadlineNear({ noticeDeadline, asOf })).toBe(true);
  });

  it("respects a custom lookahead window", () => {
    const asOf = new Date(noticeDeadline.getTime() - 10 * MS_PER_DAY);
    expect(isRentIncreaseNoticeDeadlineNear({ noticeDeadline, asOf, lookaheadDays: 7 })).toBe(false);
    expect(isRentIncreaseNoticeDeadlineNear({ noticeDeadline, asOf, lookaheadDays: 14 })).toBe(true);
  });
});

describe("depositReturnDeadline", () => {
  it("is 10 days after the tenancy end date", () => {
    const end = d(2026, 1, 1);
    expect(depositReturnDeadline(end).getTime()).toBe(end.getTime() + 10 * MS_PER_DAY);
  });
});

describe("isDepositOverdue", () => {
  const tenancyEndDate = d(2026, 1, 1);

  it("is false when there's no tenancy end date", () => {
    expect(isDepositOverdue({ tenancyEndDate: null, dateReturned: null, asOf: d(2026, 6, 1) })).toBe(false);
  });

  it("is false once the deposit has been returned, no matter how late", () => {
    expect(
      isDepositOverdue({ tenancyEndDate, dateReturned: d(2026, 6, 1), asOf: d(2026, 6, 1) }),
    ).toBe(false);
  });

  it("is false exactly on the 10-day deadline", () => {
    const asOf = new Date(tenancyEndDate.getTime() + 10 * MS_PER_DAY);
    expect(isDepositOverdue({ tenancyEndDate, dateReturned: null, asOf })).toBe(false);
  });

  it("is true the moment the deadline passes", () => {
    const asOf = new Date(tenancyEndDate.getTime() + 10 * MS_PER_DAY + 1);
    expect(isDepositOverdue({ tenancyEndDate, dateReturned: null, asOf })).toBe(true);
  });
});

describe("isDepositInterestStale", () => {
  it("is true when no interest year has ever been recorded", () => {
    expect(isDepositInterestStale({ interestRateYear: null, asOf: d(2026, 6, 1) })).toBe(true);
  });

  it("is false when the interest year matches the current year", () => {
    expect(isDepositInterestStale({ interestRateYear: 2026, asOf: d(2026, 6, 1) })).toBe(false);
  });

  it("is true once the interest year falls behind the current year", () => {
    expect(isDepositInterestStale({ interestRateYear: 2025, asOf: d(2026, 1, 1) })).toBe(true);
  });

  it("is false for an interest year ahead of the current year", () => {
    expect(isDepositInterestStale({ interestRateYear: 2027, asOf: d(2026, 6, 1) })).toBe(false);
  });
});

describe("isRentOverdue — Mountain-time due date boundary", () => {
  // period is stored as UTC midnight of the 1st. These UTC instants were
  // verified against the real America/Edmonton tz database for Nov 2026
  // (DST ends Nov 1, 2026): the due date doesn't start, in Mountain time,
  // until several hours after UTC midnight, and does't roll over to
  // "overdue" until Mountain calendar date actually reaches Nov 2.
  const period = new Date(Date.UTC(2026, 10, 1, 0, 0, 0)); // Nov 1 2026 00:00 UTC

  it("is not overdue at UTC midnight on the due date (still Oct 31 evening in Mountain time)", () => {
    expect(isRentOverdue({ period, paidDate: null, asOf: period })).toBe(false);
  });

  it("is not overdue at Nov 1 noon UTC (the due date itself, Mountain time)", () => {
    const asOf = new Date(Date.UTC(2026, 10, 1, 12, 0, 0));
    expect(isRentOverdue({ period, paidDate: null, asOf })).toBe(false);
  });

  it("is still not overdue at Nov 2 00:00 UTC — still Nov 1 evening in Mountain time", () => {
    const asOf = new Date(Date.UTC(2026, 10, 2, 0, 0, 0));
    expect(isRentOverdue({ period, paidDate: null, asOf })).toBe(false);
  });

  it("becomes overdue once the Mountain calendar date actually reaches Nov 2", () => {
    const asOf = new Date(Date.UTC(2026, 10, 2, 8, 0, 0)); // Nov 2, 1am MST
    expect(isRentOverdue({ period, paidDate: null, asOf })).toBe(true);
  });

  it("stays overdue on subsequent days", () => {
    const asOf = new Date(Date.UTC(2026, 10, 3, 0, 0, 0));
    expect(isRentOverdue({ period, paidDate: null, asOf })).toBe(true);
  });

  it("is never overdue once paid, no matter how late", () => {
    const asOf = new Date(Date.UTC(2026, 10, 10, 0, 0, 0));
    expect(isRentOverdue({ period, paidDate: d(2026, 11, 5), asOf })).toBe(false);
  });
});

describe("unitNeedsRenewalAttention", () => {
  it("is false when there's no active lease at all", () => {
    expect(unitNeedsRenewalAttention({ leases: [] })).toBe(false);
  });

  it("is true when the active fixed-term lease needs a renewal decision", () => {
    const endDate = d(2026, 12, 1);
    const asOf = new Date(endDate.getTime() - 30 * MS_PER_DAY); // inside the 90-day window
    const unit = {
      leases: [
        {
          id: "l1",
          startDate: d(2026, 1, 1),
          endDate,
          periodic: false,
          lastRentIncreaseDate: null,
          renewedFromLeaseId: null,
        },
      ],
    };
    expect(unitNeedsRenewalAttention(unit, asOf)).toBe(true);
  });

  it("is false for a fixed-term lease within the window that already has a successor lease", () => {
    const endDate = d(2026, 12, 1);
    const asOf = new Date(endDate.getTime() - 30 * MS_PER_DAY);
    const unit = {
      leases: [
        {
          id: "l1",
          startDate: d(2026, 1, 1),
          endDate,
          periodic: false,
          lastRentIncreaseDate: null,
          renewedFromLeaseId: null,
        },
        {
          id: "l2",
          startDate: endDate,
          endDate: null,
          periodic: true,
          lastRentIncreaseDate: null,
          renewedFromLeaseId: "l1",
        },
      ],
    };
    // asOf is before l2 even starts, so l1 is still the active lease —
    // but it already has a successor on file.
    expect(unitNeedsRenewalAttention(unit, asOf)).toBe(false);
  });

  it("is true when a periodic lease's rent-increase notice deadline is near", () => {
    const leaseStartDate = d(2024, 1, 1);
    // Far enough past 365 days that the notice deadline (nextEligible - 3
    // months) is within the 30-day lookahead.
    const asOf = new Date(leaseStartDate.getTime() + 340 * MS_PER_DAY);
    const unit = {
      leases: [
        {
          id: "l1",
          startDate: leaseStartDate,
          endDate: null,
          periodic: true,
          lastRentIncreaseDate: null,
          renewedFromLeaseId: null,
        },
      ],
    };
    expect(unitNeedsRenewalAttention(unit, asOf)).toBe(true);
  });

  it("is false for a periodic lease with nothing due soon", () => {
    const leaseStartDate = d(2026, 1, 1);
    const asOf = new Date(leaseStartDate.getTime() + 10 * MS_PER_DAY);
    const unit = {
      leases: [
        {
          id: "l1",
          startDate: leaseStartDate,
          endDate: null,
          periodic: true,
          lastRentIncreaseDate: null,
          renewedFromLeaseId: null,
        },
      ],
    };
    expect(unitNeedsRenewalAttention(unit, asOf)).toBe(false);
  });
});
