/**
 * Display formatting utilities for Meridian.
 *
 * Preserves exact decimal precision for monetary strings, avoids floating point drift,
 * safely distinguishes between null and zero ("0.00"), and formats date-only strings
 * without timezone shifting.
 */

/**
 * Formats a decimal string into a localized currency representation (e.g., ฿150,000.00).
 * Returns fallback (default: "—") strictly when the input is null or undefined.
 * Zero ("0.00" or "0") is formatted as "฿0.00" and never converted to fallback.
 */
export function formatCurrency(
  value: string | number | null | undefined,
  fallback = '—'
): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  const str = String(value).trim();
  if (str === '') {
    return fallback;
  }

  // Handle negative prefix if any
  const isNegative = str.startsWith('-');
  const cleanStr = isNegative ? str.slice(1) : str;

  // Split into integer and fractional parts without floating point parse
  const parts = cleanStr.split('.');
  const intPart = parts[0] || '0';
  const rawDec = parts.length > 1 && parts[1] !== undefined ? parts[1] : '00';

  // Format integer with commas
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // Ensure at least 2 decimal places preserved
  const formattedDec = rawDec.length === 1 ? `${rawDec}0` : rawDec;

  return `${isNegative ? '-' : ''}฿${formattedInt}.${formattedDec}`;
}

/**
 * Formats a date-only string (YYYY-MM-DD) into a clean, human-readable format
 * without timezone shifting.
 */
export function formatDateOnly(
  dateStr: string | null | undefined,
  fallback = '—'
): string {
  if (!dateStr || dateStr.trim() === '') {
    return fallback;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (!match || !match[1] || !match[2] || !match[3]) {
    return dateStr;
  }

  const year = match[1];
  const month = match[2];
  const day = match[3];
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const monthIdx = parseInt(month, 10) - 1;
  const monthLabel = monthNames[monthIdx] ?? month;
  const dayNum = parseInt(day, 10);

  return `${dayNum} ${monthLabel} ${year}`;
}

/**
 * Formats a ratio / progress number into a percentage string.
 * Example: 0.59 -> "59%"
 */
export function formatProgressPercent(progress: number | null | undefined): string {
  if (progress === null || progress === undefined || Number.isNaN(progress)) {
    return '0%';
  }
  return `${Math.round(progress * 100)}%`;
}
