import type { FinancialCycle } from "./types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function parseDate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }

  return parsed;
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayDateString(): string {
  return formatDate(new Date());
}

export function addDays(value: string, days: number): string {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

export function addMonths(value: string, months: number): string {
  const date = parseDate(value);
  const day = date.getUTCDate();

  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  date.setUTCDate(Math.min(day, getDaysInMonth(date.getUTCFullYear(), date.getUTCMonth())));

  return formatDate(date);
}

export function compareDateStrings(left: string, right: string): number {
  return parseDate(left).getTime() - parseDate(right).getTime();
}

export function isDateWithinRange(value: string, start: string, end: string): boolean {
  return compareDateStrings(value, start) >= 0 && compareDateStrings(value, end) <= 0;
}

export function daysBetweenInclusive(start: string, end: string): number {
  const difference = parseDate(end).getTime() - parseDate(start).getTime();
  return Math.max(1, Math.floor(difference / DAY_IN_MS) + 1);
}

function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function clampSalaryDay(year: number, monthIndex: number, salaryDay: number): number {
  return Math.min(Math.max(1, salaryDay), getDaysInMonth(year, monthIndex));
}

function buildSalaryAnchor(year: number, monthIndex: number, salaryDay: number): string {
  const anchor = new Date(
    Date.UTC(year, monthIndex, clampSalaryDay(year, monthIndex, salaryDay))
  );

  return formatDate(anchor);
}

export function calculateFinancialCycle(
  anchorDate: string,
  salaryDay: number | null
): FinancialCycle {
  const anchor = parseDate(anchorDate);

  if (!salaryDay) {
    const cycleStart = formatDate(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1)));
    const nextCycleStart = formatDate(
      new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1))
    );

    return {
      strategy: "CALENDAR_MONTH",
      salaryDay: null,
      cycleStart,
      cycleEnd: addDays(nextCycleStart, -1),
      nextCycleStart,
      anchorDate
    };
  }

  const thisMonthSalaryDate = buildSalaryAnchor(
    anchor.getUTCFullYear(),
    anchor.getUTCMonth(),
    salaryDay
  );
  const cycleStart =
    compareDateStrings(anchorDate, thisMonthSalaryDate) >= 0
      ? thisMonthSalaryDate
      : buildSalaryAnchor(anchor.getUTCFullYear(), anchor.getUTCMonth() - 1, salaryDay);
  const nextCycleStart = buildSalaryAnchor(
    parseDate(cycleStart).getUTCFullYear(),
    parseDate(cycleStart).getUTCMonth() + 1,
    salaryDay
  );

  return {
    strategy: "SALARY_CYCLE",
    salaryDay,
    cycleStart,
    cycleEnd: addDays(nextCycleStart, -1),
    nextCycleStart,
    anchorDate
  };
}
