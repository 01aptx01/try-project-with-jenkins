/**
 * Exact monetary and rational ratio arithmetic in integer satang.
 * Eliminates floating-point drift at boundary conditions.
 */

const MONEY_REGEX = /^(0|[1-9]\d*)(\.(\d{1,2}))?$/;
const MAX_INTEGER_DIGITS = 16; // Decimal(18, 2) allows up to 16 digits before the decimal point

/**
 * Parses a non-negative decimal string into integer satang (BigInt).
 * Throws Error on negative, malformed, extra decimal places, or out-of-bounds values.
 */
export function parseSatang(value: string): bigint {
  if (typeof value !== 'string') {
    throw new Error(`Invalid money type: expected string, got ${typeof value}`);
  }

  const trimmed = value.trim();
  if (trimmed !== value || value.length === 0) {
    throw new Error(`Invalid money string format "${value}"`);
  }

  const match = MONEY_REGEX.exec(value);
  if (!match || typeof match[1] !== 'string') {
    throw new Error(`Invalid money format "${value}": must be non-negative decimal with at most 2 decimal places`);
  }

  const intPart = match[1];
  if (intPart.length > MAX_INTEGER_DIGITS) {
    throw new Error(`Money value exceeds maximum Decimal(18,2) precision: "${value}"`);
  }

  const fracPart = match[3] ?? '';
  const paddedFrac = fracPart.padEnd(2, '0');

  return BigInt(intPart) * 100n + BigInt(paddedFrac);

}

/**
 * Attempts to parse a decimal string into satang. Returns null if invalid or undefined/null.
 */
export function tryParseSatang(value: unknown): bigint | null {
  if (typeof value !== 'string') {
    return null;
  }
  try {
    return parseSatang(value);
  } catch {
    return null;
  }
}

/**
 * Formats integer satang to a standard decimal string with 2 decimal places (e.g. "1234.56").
 */
export function formatSatang(satang: bigint): string {
  if (satang < 0n) {
    throw new Error(`Negative satang formatting not supported: ${satang.toString()}`);
  }
  const whole = satang / 100n;
  const frac = satang % 100n;
  return `${whole.toString()}.${frac.toString().padStart(2, '0')}`;
}

/**
 * Compares two ratios (aNum / aDen) and (bNum / bDen) exactly using cross-multiplication.
 * Returns > 0 if A > B, < 0 if A < B, 0 if A == B.
 * Both denominators must be strictly positive.
 */
export function compareRatios(
  aNum: bigint,
  aDen: bigint,
  bNum: bigint,
  bDen: bigint
): number {
  if (aDen <= 0n || bDen <= 0n) {
    throw new Error('Denominators must be strictly positive');
  }
  const left = aNum * bDen;
  const right = bNum * aDen;
  if (left > right) return 1;
  if (left < right) return -1;
  return 0;
}

/**
 * Performs exact half-up rounding on a number to the specified number of decimal places.
 * e.g. roundHalfUp(10.005, 2) => 10.01, roundHalfUp(10.004, 2) => 10.00
 */
export function roundHalfUp(value: number, decimals: number = 2): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot round non-finite value: ${value}`);
  }
  // Using scientific notation shift avoids floating-point binary representation artifacts
  const shifted = Number(`${value}e${decimals}`);
  const rounded = Math.round(shifted);
  return Number(`${rounded}e-${decimals}`);
}
