/**
 * Browser API Client for Meridian.
 *
 * Implements fetch wrapper adhering strictly to:
 * - Relative same-origin API routing through Caddy (/api/*)
 * - Automatic Cookie-based authentication (credentials: 'same-origin')
 * - cache: 'no-store'
 * - Combined caller AbortSignal with a 10s default timeout
 * - Safe 204 No Content handling without JSON parsing
 * - Structured ApiClientError with code, message, requestId, and Retry-After
 * - Zero leakage of passwords, cookies, or payloads in logs
 * - Zero automatic retries for POST/mutating methods
 */

import type {
  ClientListQuery,
  ClientListResponse,
  ClientProfileSnapshotResponse,
  FamilyGraphResponse,
  LoginRequest,
  LoginResponse,
  MeResponse,
  MorningActionPlanResponse,
  ApiErrorEnvelope,
} from './api-contracts.js';

export interface RequestOptions {
  signal?: AbortSignal | undefined;
  timeoutMs?: number | undefined;
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string | undefined;
  readonly retryAfter?: number | undefined;
  readonly details?: unknown;
  readonly isNetworkError: boolean;
  readonly isTimeout: boolean;
  readonly isAbort: boolean;

  constructor(options: {
    status: number;
    code: string;
    message: string;
    requestId?: string | undefined;
    retryAfter?: number | undefined;
    details?: unknown;
    isNetworkError?: boolean;
    isTimeout?: boolean;
    isAbort?: boolean;
  }) {
    super(options.message);
    this.name = 'ApiClientError';
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.retryAfter = options.retryAfter;
    this.details = options.details;
    this.isNetworkError = options.isNetworkError ?? false;
    this.isTimeout = options.isTimeout ?? false;
    this.isAbort = options.isAbort ?? false;
    Object.setPrototypeOf(this, ApiClientError.prototype);
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

export type UnauthorizedListener = (url: string) => void;
let unauthorizedListener: UnauthorizedListener | null = null;

export function setUnauthorizedListener(listener: UnauthorizedListener | null): void {
  unauthorizedListener = listener;
}

async function executeRequest<T>(
  path: string,
  init: RequestInit,
  options?: RequestOptions
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  let timedOut = false;

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error('Request timed out'));
  }, timeoutMs);

  const onCallerAbort = () => {
    controller.abort(options?.signal?.reason);
  };

  if (options?.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeoutId);
      throw new ApiClientError({
        status: 0,
        code: 'ABORTED',
        message: 'Request was aborted by caller',
        isAbort: true,
      });
    }
    options.signal.addEventListener('abort', onCallerAbort, { once: true });
  }

  try {
    const response = await fetch(path, {
      ...init,
      signal: controller.signal,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...init.headers,
      },
    });

    if (path.endsWith('/api/auth/logout')) {
      if (response.status === 204) {
        return undefined as unknown as T;
      }
      throw new ApiClientError({
        status: response.status,
        code: 'INVALID_RESPONSE',
        message: `Expected HTTP 204 No Content for logout but received ${response.status}`,
      });
    }

    if (response.status === 204) {
      throw new ApiClientError({
        status: response.status,
        code: 'INVALID_RESPONSE',
        message: 'Endpoint returned unexpected 204 No Content for an endpoint requiring JSON data',
      });
    }

    let responseData: unknown = null;
    const contentType = response.headers.get('content-type') ?? '';

    if (!response.ok) {
      if (contentType.includes('application/json')) {
        try {
          responseData = await response.json();
        } catch {
          responseData = null;
        }
      }

      let code = `HTTP_${response.status}`;
      let message = response.statusText || 'An error occurred';
      let requestId: string | undefined;
      let details: unknown;

      if (
        responseData &&
        typeof responseData === 'object' &&
        'error' in responseData &&
        typeof (responseData as ApiErrorEnvelope).error === 'object' &&
        (responseData as ApiErrorEnvelope).error !== null
      ) {
        const errObj = (responseData as ApiErrorEnvelope).error;
        if (typeof errObj.code === 'string') code = errObj.code;
        if (typeof errObj.message === 'string') message = errObj.message;
        if (typeof errObj.requestId === 'string') requestId = errObj.requestId;
        details = errObj.details;
      }

      let retryAfter: number | undefined;
      const retryAfterHeader = response.headers.get('Retry-After');
      if (retryAfterHeader) {
        const parsedSec = parseInt(retryAfterHeader, 10);
        if (!isNaN(parsedSec)) {
          retryAfter = parsedSec;
        }
      }

      if (response.status === 401 && !path.includes('/api/auth/login')) {
        try {
          unauthorizedListener?.(path);
        } catch {
          // Ignore handler errors
        }
      }

      throw new ApiClientError({
        status: response.status,
        code,
        message,
        requestId,
        retryAfter,
        details,
      });
    }

    // response.ok is true (200..299):
    if (!contentType.includes('application/json')) {
      throw new ApiClientError({
        status: response.status,
        code: 'INVALID_RESPONSE',
        message: `Expected application/json response but received "${contentType}"`,
      });
    }

    try {
      responseData = await response.json();
    } catch (parseError: unknown) {
      if (
        (parseError instanceof Error && parseError.name === 'AbortError') ||
        controller.signal.aborted ||
        options?.signal?.aborted ||
        timedOut
      ) {
        throw parseError;
      }
      throw new ApiClientError({
        status: response.status,
        code: 'INVALID_RESPONSE',
        message: 'Failed to parse JSON response from server',
      });
    }

    return responseData as T;
  } catch (error: unknown) {
    if (error instanceof ApiClientError) {
      throw error;
    }

    if (timedOut) {
      throw new ApiClientError({
        status: 0,
        code: 'TIMEOUT',
        message: `Request timed out after ${timeoutMs}ms`,
        isTimeout: true,
      });
    }

    if (options?.signal?.aborted) {
      throw new ApiClientError({
        status: 0,
        code: 'ABORTED',
        message: 'Request was cancelled',
        isAbort: true,
      });
    }

    throw new ApiClientError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Network connection failed',
      isNetworkError: true,
    });
  } finally {
    clearTimeout(timeoutId);
    if (options?.signal) {
      options.signal.removeEventListener('abort', onCallerAbort);
    }
  }
}

export class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async login(
    input: LoginRequest,
    options?: RequestOptions
  ): Promise<LoginResponse> {
    return executeRequest<LoginResponse>(
      `${this.baseUrl}/api/auth/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
      options
    );
  }

  async logout(options?: RequestOptions): Promise<void> {
    return executeRequest<void>(
      `${this.baseUrl}/api/auth/logout`,
      {
        method: 'POST',
      },
      options
    );
  }

  async getMe(options?: RequestOptions): Promise<MeResponse> {
    return executeRequest<MeResponse>(
      `${this.baseUrl}/api/auth/me`,
      {
        method: 'GET',
      },
      options
    );
  }

  async getClients(
    query?: ClientListQuery,
    options?: RequestOptions
  ): Promise<ClientListResponse> {
    const params = new URLSearchParams();
    if (query?.search?.trim()) params.set('search', query.search.trim());
    if (query?.priority) params.set('priority', query.priority);
    if (query?.health) params.set('health', query.health);
    if (query?.page && query.page > 1) params.set('page', String(query.page));
    if (query?.pageSize && query.pageSize !== 20)
      params.set('pageSize', String(query.pageSize));

    const queryString = params.toString();
    const url = `${this.baseUrl}/api/clients${queryString ? `?${queryString}` : ''}`;

    return executeRequest<ClientListResponse>(
      url,
      {
        method: 'GET',
      },
      options
    );
  }

  async getMorningActionPlan(
    query?: { page?: number; pageSize?: number },
    options?: RequestOptions
  ): Promise<MorningActionPlanResponse> {
    const params = new URLSearchParams();
    if (query?.page && query.page > 1) params.set('page', String(query.page));
    if (query?.pageSize && query.pageSize !== 20)
      params.set('pageSize', String(query.pageSize));

    const queryString = params.toString();
    const url = `${this.baseUrl}/api/dashboard/morning-action-plan${queryString ? `?${queryString}` : ''}`;

    return executeRequest<MorningActionPlanResponse>(
      url,
      {
        method: 'GET',
      },
      options
    );
  }

  async getClientProfile(
    id: string,
    options?: RequestOptions
  ): Promise<ClientProfileSnapshotResponse> {
    return executeRequest<ClientProfileSnapshotResponse>(
      `${this.baseUrl}/api/clients/${encodeURIComponent(id)}`,
      {
        method: 'GET',
      },
      options
    );
  }

  async getClientFamily(
    id: string,
    options?: RequestOptions
  ): Promise<FamilyGraphResponse> {
    return executeRequest<FamilyGraphResponse>(
      `${this.baseUrl}/api/clients/${encodeURIComponent(id)}/family`,
      {
        method: 'GET',
      },
      options
    );
  }
}

export const api = new ApiClient();
