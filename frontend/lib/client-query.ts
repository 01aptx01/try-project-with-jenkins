import type {
  PriorityLevel,
  HealthFilter,
} from './api-contracts.js';

export const VALID_PRIORITIES: readonly PriorityLevel[] = [
  'HIGH',
  'MEDIUM',
  'LOW',
] as const;

export const VALID_HEALTH_FILTERS: readonly HealthFilter[] = [
  'GOOD',
  'MODERATE',
  'AT_RISK',
  'INSUFFICIENT_DATA',
] as const;

export interface ParsedClientQuery {
  search?: string | undefined;
  priority?: PriorityLevel | undefined;
  health?: HealthFilter | undefined;
  page: number;
  pageSize: number;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const VALID_PAGE_SIZES = [20, 50, 100] as const;

/**
 * Normalizes an input query or URLSearchParams into a validated, type-safe query object.
 * Trims search text, validates enums, normalizes page and pageSize.
 */
export function normalizeClientQuery(
  source?: URLSearchParams | Record<string, unknown> | null
): ParsedClientQuery {
  if (!source) {
    return {
      page: DEFAULT_PAGE,
      pageSize: DEFAULT_PAGE_SIZE,
    };
  }

  const getVal = (key: string): string | undefined => {
    if (source instanceof URLSearchParams) {
      const val = source.get(key);
      return val !== null ? val : undefined;
    }
    const val = source[key];
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    return undefined;
  };

  // 1. Search: trimmed string, omitted if empty
  const rawSearch = getVal('search');
  const search = rawSearch && rawSearch.trim().length > 0 ? rawSearch.trim() : undefined;

  // 2. Priority: must be one of VALID_PRIORITIES
  const rawPriority = getVal('priority');
  const priority =
    rawPriority && (VALID_PRIORITIES as readonly string[]).includes(rawPriority)
      ? (rawPriority as PriorityLevel)
      : undefined;

  // 3. Health: must be one of VALID_HEALTH_FILTERS
  const rawHealth = getVal('health');
  const health =
    rawHealth && (VALID_HEALTH_FILTERS as readonly string[]).includes(rawHealth)
      ? (rawHealth as HealthFilter)
      : undefined;

  // 4. Page: positive integer >= 1, defaults to 1
  const rawPage = getVal('page');
  let page = DEFAULT_PAGE;
  if (rawPage) {
    const parsedPage = parseInt(rawPage, 10);
    if (!Number.isNaN(parsedPage) && parsedPage >= 1) {
      page = parsedPage;
    }
  }

  // 5. PageSize: must be in [20, 50, 100], defaults to 20
  const rawPageSize = getVal('pageSize');
  let pageSize = DEFAULT_PAGE_SIZE;
  if (rawPageSize) {
    const parsedSize = parseInt(rawPageSize, 10);
    if (
      !Number.isNaN(parsedSize) &&
      (VALID_PAGE_SIZES as readonly number[]).includes(parsedSize)
    ) {
      pageSize = parsedSize;
    }
  }

  return {
    search,
    priority,
    health,
    page,
    pageSize,
  };
}

/**
 * Builds URLSearchParams from query parameters, omitting default or empty values.
 */
export function buildClientSearchParams(
  query: Partial<ParsedClientQuery>
): URLSearchParams {
  const params = new URLSearchParams();

  if (query.search && query.search.trim()) {
    params.set('search', query.search.trim());
  }

  if (
    query.priority &&
    (VALID_PRIORITIES as readonly string[]).includes(query.priority)
  ) {
    params.set('priority', query.priority);
  }

  if (
    query.health &&
    (VALID_HEALTH_FILTERS as readonly string[]).includes(query.health)
  ) {
    params.set('health', query.health);
  }

  if (query.page && query.page > 1) {
    params.set('page', String(query.page));
  }

  if (query.pageSize && query.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set('pageSize', String(query.pageSize));
  }

  return params;
}

/**
 * Builds a query string representation (without leading '?')
 */
export function buildClientQueryString(query: Partial<ParsedClientQuery>): string {
  return buildClientSearchParams(query).toString();
}
