/**
 * UTC calendar and date calculation utilities.
 * Pure functions with zero system clock or timezone dependencies.
 */

const DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Checks if a Gregorian year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the number of days in a given Gregorian month (1-12).
 */
export function getDaysInMonth(year: number, month: number): number {
  switch (month) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    case 2:
      return isLeapYear(year) ? 29 : 28;
    default:
      return 0;
  }
}

export interface ParsedUtcDate {
  year: number;
  month: number;
  day: number;
  utcMs: number;
}

/**
 * Validates and parses a strict YYYY-MM-DD date in UTC.
 * Rejects invalid calendar dates like 2026-02-30 or 2025-02-29.
 */
export function parseUtcDate(dateStr: string): ParsedUtcDate {
  if (typeof dateStr !== 'string') {
    throw new Error(`Invalid date type: expected string, got ${typeof dateStr}`);
  }

  const match = DATE_REGEX.exec(dateStr);
  if (!match) {
    throw new Error(`Invalid date format "${dateStr}": expected YYYY-MM-DD`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12) {
    throw new Error(`Invalid month "${match[2]}" in date "${dateStr}"`);
  }

  const maxDays = getDaysInMonth(year, month);
  if (day < 1 || day > maxDays) {
    throw new Error(`Invalid day "${match[3]}" for month ${month} in date "${dateStr}"`);
  }

  const utcMs = Date.UTC(year, month - 1, day);
  return { year, month, day, utcMs };
}

/**
 * Calculates days between date1 and date2 (date2 - date1) in UTC.
 * Positive if date2 > date1, zero if equal, negative if date2 < date1.
 */
export function daysBetween(dateStr1: string, dateStr2: string): number {
  const d1 = parseUtcDate(dateStr1);
  const d2 = parseUtcDate(dateStr2);
  const MS_PER_DAY = 86_400_000;
  return Math.round((d2.utcMs - d1.utcMs) / MS_PER_DAY);
}

/**
 * Returns true if dateStr1 <= dateStr2.
 */
export function isDateOnOrBefore(dateStr1: string, dateStr2: string): boolean {
  return daysBetween(dateStr1, dateStr2) >= 0;
}

/**
 * Returns true if dateStr1 < dateStr2.
 */
export function isDateBefore(dateStr1: string, dateStr2: string): boolean {
  return daysBetween(dateStr1, dateStr2) > 0;
}
