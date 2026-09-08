import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient, ApiClientError } from '../lib/api-client.js';
import {
  mockAuthUser,
  mockClientListResponse,
  mockCompleteProfileSnapshot,
  mockError401,
  mockError429,
  mockError503,
  mockFamilyGraphResponse,
  mockMorningActionPlanResponse,
} from './fixtures/api.js';

describe('ApiClient', () => {
  let client: ApiClient;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    client = new ApiClient();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('handles successful login (POST /api/auth/login)', async () => {
    const mockResponse = { user: mockAuthUser };
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await client.login({
      email: 'rm1@meridian.local',
      password: 'Password123!',
    });

    expect(result).toEqual(mockResponse);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Accept: 'application/json',
        }),
        body: JSON.stringify({
          email: 'rm1@meridian.local',
          password: 'Password123!',
        }),
      })
    );
  });

  it('handles 204 No Content for logout without JSON parsing (POST /api/auth/logout)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 204,
        statusText: 'No Content',
      })
    );

    const result = await client.logout();
    expect(result).toBeUndefined();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
      })
    );
  });

  it('handles getMe (GET /api/auth/me)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(mockAuthUser), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await client.getMe();
    expect(result).toEqual(mockAuthUser);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({
        method: 'GET',
      })
    );
  });

  it('formats query parameters correctly in getClients (GET /api/clients)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(mockClientListResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await client.getClients({
      search: 'Somchai',
      priority: 'HIGH',
      health: 'MODERATE',
      page: 2,
      pageSize: 50,
    });

    expect(result).toEqual(mockClientListResponse);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/clients?search=Somchai&priority=HIGH&health=MODERATE&page=2&pageSize=50',
      expect.objectContaining({
        method: 'GET',
      })
    );
  });

  it('omits default/empty parameters in getClients', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(mockClientListResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await client.getClients({
      search: '   ',
      page: 1,
      pageSize: 20,
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/clients',
      expect.objectContaining({
        method: 'GET',
      })
    );
  });

  it('fetches Morning Action Plan (GET /api/dashboard/morning-action-plan)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(mockMorningActionPlanResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await client.getMorningActionPlan();
    expect(result).toEqual(mockMorningActionPlanResponse);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/dashboard/morning-action-plan',
      expect.objectContaining({
        method: 'GET',
      })
    );
  });

  it('fetches Client Profile Snapshot (GET /api/clients/:id)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(mockCompleteProfileSnapshot), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await client.getClientProfile('client-123');
    expect(result).toEqual(mockCompleteProfileSnapshot);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/clients/client-123',
      expect.objectContaining({
        method: 'GET',
      })
    );
  });

  it('fetches Family Graph (GET /api/clients/:id/family)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(mockFamilyGraphResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await client.getClientFamily('client-123');
    expect(result).toEqual(mockFamilyGraphResponse);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/clients/client-123/family',
      expect.objectContaining({
        method: 'GET',
      })
    );
  });

  describe('Error handling', () => {
    it('throws ApiClientError with code and requestId for 401 Unauthorized', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify(mockError401), {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(
        client.login({ email: 'wrong@meridian.local', password: 'bad' })
      ).rejects.toMatchObject({
        name: 'ApiClientError',
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
        requestId: 'req-test-401',
      });
    });

    it('parses Retry-After header on 429 Too Many Requests', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify(mockError429), {
          status: 429,
          statusText: 'Too Many Requests',
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '45',
          },
        })
      );

      try {
        await client.login({ email: 'test@meridian.local', password: 'pwd' });
        expect.unreachable('Should have thrown 429');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiClientError);
        const apiErr = err as ApiClientError;
        expect(apiErr.status).toBe(429);
        expect(apiErr.code).toBe('TOO_MANY_REQUESTS');
        expect(apiErr.retryAfter).toBe(45);
        expect(apiErr.requestId).toBe('req-test-429');
      }
    });

    it('handles 503 Dependency Unavailable cleanly', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify(mockError503), {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(client.getClients()).rejects.toMatchObject({
        name: 'ApiClientError',
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Database service is temporarily unavailable',
        requestId: 'req-test-503',
      });
    });

    it('handles malformed non-JSON error responses gracefully', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce(
        new Response('<html><body>502 Bad Gateway</body></html>', {
          status: 502,
          statusText: 'Bad Gateway',
          headers: { 'Content-Type': 'text/html' },
        })
      );

      await expect(client.getClients()).rejects.toMatchObject({
        name: 'ApiClientError',
        status: 502,
        code: 'HTTP_502',
        message: 'Bad Gateway',
      });
    });

    it('handles network failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(client.getClients()).rejects.toMatchObject({
        name: 'ApiClientError',
        status: 0,
        code: 'NETWORK_ERROR',
        isNetworkError: true,
      });
    });

    it('handles caller abort signal', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        client.getClients(undefined, { signal: controller.signal })
      ).rejects.toMatchObject({
        name: 'ApiClientError',
        status: 0,
        code: 'ABORTED',
        isAbort: true,
      });
    });

    it('handles timeout when request takes too long', async () => {
      globalThis.fetch = vi.fn().mockImplementationOnce(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () => {
              reject(new Error('AbortError'));
            });
          })
      );

      await expect(
        client.getClients(undefined, { timeoutMs: 50 })
      ).rejects.toMatchObject({
        name: 'ApiClientError',
        status: 0,
        code: 'TIMEOUT',
        isTimeout: true,
      });
    });

    it('rejects 200 response returning text/html with INVALID_RESPONSE (M4-R06)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce(
        new Response('<html><body>Welcome</body></html>', {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'text/html' },
        })
      );

      await expect(client.getClients()).rejects.toMatchObject({
        name: 'ApiClientError',
        status: 200,
        code: 'INVALID_RESPONSE',
        message: expect.stringContaining('Expected application/json response'),
      });
    });

    it('rejects 200 response returning malformed JSON with INVALID_RESPONSE (M4-R06)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce(
        new Response('{ broken json', {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(client.getClients()).rejects.toMatchObject({
        name: 'ApiClientError',
        status: 200,
        code: 'INVALID_RESPONSE',
        message: 'Failed to parse JSON response from server',
      });
    });

    it('rejects 204 No Content for GET endpoints requiring JSON with INVALID_RESPONSE (M4-R06)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce(
        new Response(null, {
          status: 204,
          statusText: 'No Content',
        })
      );

      await expect(client.getClients()).rejects.toMatchObject({
        name: 'ApiClientError',
        status: 204,
        code: 'INVALID_RESPONSE',
        message: expect.stringContaining('Endpoint returned unexpected 204 No Content'),
      });
    });

    it('accepts 204 No Content for POST /api/auth/logout (M4-R06)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce(
        new Response(null, {
          status: 204,
          statusText: 'No Content',
        })
      );

      await expect(client.logout()).resolves.toBeUndefined();
    });
  });
});
