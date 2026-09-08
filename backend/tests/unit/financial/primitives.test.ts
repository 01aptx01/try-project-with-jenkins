import { describe, expect, it } from 'vitest';
import {
  daysBetween,
  isDateBefore,
  isDateOnOrBefore,
  isLeapYear,
  parseUtcDate,
} from '../../../src/domain/financial/dates.js';
import {
  compareRatios,
  formatSatang,
  parseSatang,
  roundHalfUp,
  roundRationalHalfUp,
  tryParseSatang,
} from '../../../src/domain/financial/money.js';

describe('Financial Money Primitives', () => {
  it('parses valid decimal strings to exact satang without floating-point drift', () => {
    expect(parseSatang('0')).toBe(0n);
    expect(parseSatang('0.00')).toBe(0n);
    expect(parseSatang('0.01')).toBe(1n);
    expect(parseSatang('0.1')).toBe(10n);
    expect(parseSatang('100.5')).toBe(10050n);
    expect(parseSatang('100.50')).toBe(10050n);
    expect(parseSatang('12345.67')).toBe(1234567n);
    expect(parseSatang('9999999999999999.99')).toBe(999999999999999999n);
  });

  it('rejects invalid money formats, negative values, and out-of-bounds numbers', () => {
    expect(() => parseSatang('-1')).toThrow();
    expect(() => parseSatang('-0.01')).toThrow();
    expect(() => parseSatang('abc')).toThrow();
    expect(() => parseSatang('')).toThrow();
    expect(() => parseSatang(' ')).toThrow();
    expect(() => parseSatang(' 10.00')).toThrow();
    expect(() => parseSatang('10.00 ')).toThrow();
    expect(() => parseSatang('010.00')).toThrow(); // leading zero on integer
    expect(() => parseSatang('10.001')).toThrow(); // more than 2 decimals
    expect(() => parseSatang('10000000000000000.00')).toThrow(); // 17 integer digits
  });

  it('tryParseSatang returns null for invalid values without throwing', () => {
    expect(tryParseSatang(null)).toBeNull();
    expect(tryParseSatang(undefined)).toBeNull();
    expect(tryParseSatang('-5.00')).toBeNull();
    expect(tryParseSatang('invalid')).toBeNull();
    expect(tryParseSatang('10.50')).toBe(1050n);
  });

  it('formats satang to standard decimal string with 2 decimal places', () => {
    expect(formatSatang(0n)).toBe('0.00');
    expect(formatSatang(1n)).toBe('0.01');
    expect(formatSatang(50n)).toBe('0.50');
    expect(formatSatang(10050n)).toBe('100.50');
    expect(formatSatang(999999999999999999n)).toBe('9999999999999999.99');
    expect(() => formatSatang(-1n)).toThrow();
  });

  it('compares rational ratios without division by zero', () => {
    expect(compareRatios(1n, 3n, 2n, 6n)).toBe(0);
    expect(compareRatios(1n, 3n, 1n, 2n)).toBe(-1);
    expect(compareRatios(1n, 2n, 1n, 3n)).toBe(1);
    expect(() => compareRatios(1n, 0n, 1n, 1n)).toThrow();
    expect(() => compareRatios(1n, 1n, 1n, 0n)).toThrow();
  });

  it('performs exact half-up rounding', () => {
    expect(roundHalfUp(10.005, 2)).toBe(10.01);
    expect(roundHalfUp(10.004, 2)).toBe(10.0);
    expect(roundHalfUp(59.995, 2)).toBe(60.0);
    expect(roundHalfUp(59.994, 2)).toBe(59.99);
    expect(roundHalfUp(79.995, 2)).toBe(80.0);
    expect(roundHalfUp(0.0, 2)).toBe(0.0);
    // Numbers formatted with scientific notation
    expect(roundHalfUp(1e-15, 2)).toBe(0.0);
    expect(roundHalfUp(1.5e-10, 2)).toBe(0.0);
  });

  it('performs exact rational half-up rounding using BigInt', () => {
    // 13.5 satang / 100 = 0.135 -> 0.14
    expect(roundRationalHalfUp(135n, 1000n, 2)).toBe(0.14);
    // 0.01 / 10^15
    expect(roundRationalHalfUp(1n, 100000000000000000n, 2)).toBe(0.0);
    // exact boundary 0.005 -> 0.01
    expect(roundRationalHalfUp(5n, 1000n, 2)).toBe(0.01);
    // exact boundary 0.004999 -> 0.00
    expect(roundRationalHalfUp(4999n, 1000000n, 2)).toBe(0.0);
  });
});

describe('Financial Date Primitives', () => {
  it('correctly validates leap years', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
  });

  it('strictly validates Gregorian dates and rejects invalid days/months/years', () => {
    expect(parseUtcDate('2026-09-08').day).toBe(8);
    expect(parseUtcDate('2024-02-29').day).toBe(29); // valid leap day
    expect(() => parseUtcDate('2025-02-29')).toThrow(); // non-leap year
    expect(() => parseUtcDate('1900-02-29')).toThrow(); // non-leap century
    expect(() => parseUtcDate('2026-02-30')).toThrow();
    expect(() => parseUtcDate('2026-04-31')).toThrow();
    expect(() => parseUtcDate('2026-13-01')).toThrow();
    expect(() => parseUtcDate('2026-00-01')).toThrow();
    expect(() => parseUtcDate('2026/09/08')).toThrow();
    expect(() => parseUtcDate('0099-01-01')).toThrow(); // 2-digit century year disallowed
  });

  it('calculates days between UTC dates consistently across all environments', () => {
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0);
    expect(daysBetween('2026-01-01', '2026-01-02')).toBe(1);
    expect(daysBetween('2026-01-02', '2026-01-01')).toBe(-1);
    // Across leap day
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
    // Across non-leap Feb
    expect(daysBetween('2025-02-28', '2025-03-01')).toBe(1);
  });

  it('evaluates date order relations', () => {
    expect(isDateOnOrBefore('2026-01-01', '2026-01-01')).toBe(true);
    expect(isDateOnOrBefore('2026-01-01', '2026-01-02')).toBe(true);
    expect(isDateOnOrBefore('2026-01-02', '2026-01-01')).toBe(false);
    expect(isDateBefore('2026-01-01', '2026-01-02')).toBe(true);
    expect(isDateBefore('2026-01-01', '2026-01-01')).toBe(false);
  });
});
