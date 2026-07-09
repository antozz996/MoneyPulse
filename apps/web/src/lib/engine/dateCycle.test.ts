import { describe, expect, it } from "vitest";

import { calculateFinancialCycle } from "./dateCycle";

describe("financial cycle calculation", () => {
  it("calculates the salary cycle when today is before this month's salary day", () => {
    expect(calculateFinancialCycle("2026-07-09", 25)).toEqual({
      strategy: "SALARY_CYCLE",
      salaryDay: 25,
      cycleStart: "2026-06-25",
      cycleEnd: "2026-07-24",
      nextCycleStart: "2026-07-25",
      anchorDate: "2026-07-09"
    });
  });

  it("falls back to the calendar month when salary day is missing", () => {
    expect(calculateFinancialCycle("2026-07-09", null)).toEqual({
      strategy: "CALENDAR_MONTH",
      salaryDay: null,
      cycleStart: "2026-07-01",
      cycleEnd: "2026-07-31",
      nextCycleStart: "2026-08-01",
      anchorDate: "2026-07-09"
    });
  });
});
