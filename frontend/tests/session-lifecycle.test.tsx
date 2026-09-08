import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { SessionProvider, useSession } from '../components/session-provider.js';
import {
  bumpSessionGeneration,
  getSessionGeneration,
  broadcastLogout,
  SESSION_EVENT_KEY,
} from '../lib/session-lifecycle.js';
import { api, setUnauthorizedListener, ApiClientError } from '../lib/api-client.js';
import type { AuthUserSummary, ClientListResponse } from '../lib/api-contracts.js';
import { ClientListView } from '../components/client-list-view.js';

// Mock Next.js router
const mockPush = vi.fn();
const mockRouter = {
  push: mockPush,
};
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/clients',
  useSearchParams: () => new URLSearchParams(),
}));

let latestRefreshSession: (() => Promise<void>) | null = null;
function SessionConsumerComponent() {
  const { user, logout, refreshSession } = useSession();
  latestRefreshSession = refreshSession;
  return (
    <div>
      <div data-testid="current-user-name">{user?.name ?? 'No User'}</div>
      <div data-testid="current-user-id">{user?.id ?? 'None'}</div>
      <button data-testid="btn-logout" type="button" onClick={() => void logout()}>
        Logout
      </button>
      <button data-testid="btn-refresh" type="button" onClick={() => void refreshSession()}>
        Refresh
      </button>
    </div>
  );
}

describe('Session Lifecycle & RM Data Isolation (M4-015)', () => {
  const rmUserA: AuthUserSummary = {
    id: 'rm-user-0000-0000-000000000001',
    name: 'First Advisor',
    role: 'RM',
  };

  const rmUserB: AuthUserSummary = {
    id: 'rm-user-0000-0000-000000000002',
    name: 'Second Advisor',
    role: 'RM',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockReset();
    localStorage.clear();
    setUnauthorizedListener(null);
  });

  it('initializes session for authenticated RM', async () => {
    vi.spyOn(api, 'getMe').mockResolvedValue(rmUserA);

    render(
      <SessionProvider requireAuth={true}>
        <SessionConsumerComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-user-name')).toHaveTextContent('First Advisor');
    });

    expect(screen.getByTestId('current-user-id')).toHaveTextContent(rmUserA.id);
  });

  it('increments session generation and cleans state when RM switches identity', async () => {
    let currentUser = rmUserA;
    vi.spyOn(api, 'getMe').mockImplementation(async () => currentUser);

    const initialGen = getSessionGeneration();

    render(
      <SessionProvider requireAuth={true}>
        <SessionConsumerComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-user-name')).toHaveTextContent('First Advisor');
    });

    // Switch identity to RM B
    currentUser = rmUserB;

    // Trigger refresh using fireEvent.click
    fireEvent.click(screen.getByTestId('btn-refresh'));

    await waitFor(() => {
      expect(screen.getByTestId('current-user-name')).toHaveTextContent('Second Advisor');
    });

    // Session generation must have incremented to isolate state
    expect(getSessionGeneration()).toBeGreaterThan(initialGen);
  });

  it('discards delayed response from request A when a newer request B resolves first (M4-R02)', async () => {
    let resolveA: (user: AuthUserSummary) => void;
    let resolveB: (user: AuthUserSummary) => void;

    const promiseA = new Promise<AuthUserSummary>((resolve) => {
      resolveA = resolve;
    });
    const promiseB = new Promise<AuthUserSummary>((resolve) => {
      resolveB = resolve;
    });

    let callCount = 0;
    vi.spyOn(api, 'getMe').mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(rmUserA);
      if (callCount === 2) return promiseA;
      if (callCount === 3) return promiseB;
      return Promise.resolve(rmUserB);
    });

    render(
      <SessionProvider requireAuth={true}>
        <SessionConsumerComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-user-name')).toHaveTextContent('First Advisor');
    });

    // Initial mount completed with call 1.
    // Trigger refresh A (slow, call 2) and refresh B (fast, call 3)
    void latestRefreshSession!();
    void latestRefreshSession!();

    // Request B resolves first with rmUserB
    await act(async () => {
      resolveB!(rmUserB);
    });

    await waitFor(() => {
      expect(screen.getByTestId('current-user-name')).toHaveTextContent('Second Advisor');
    });

    // Request A resolves late with rmUserA
    await act(async () => {
      resolveA!(rmUserA);
    });

    // Request A must be discarded; user must remain Second Advisor
    expect(screen.getByTestId('current-user-name')).toHaveTextContent('Second Advisor');
  });

  it('discards delayed response if user has already logged out (M4-R02)', async () => {
    let resolveMe: (user: AuthUserSummary) => void;
    const pendingMePromise = new Promise<AuthUserSummary>((resolve) => {
      resolveMe = resolve;
    });

    vi.spyOn(api, 'getMe').mockReturnValue(pendingMePromise);
    vi.spyOn(api, 'logout').mockResolvedValue(undefined);

    render(
      <SessionProvider requireAuth={true}>
        <SessionConsumerComponent />
      </SessionProvider>
    );

    // Trigger logout before getMe resolves
    act(() => {
      bumpSessionGeneration();
    });

    // getMe finally resolves late
    resolveMe!(rmUserA);

    // Generation mismatch must prevent user from being set
    expect(screen.queryByTestId('current-user-name')).toBeNull();
  });

  it('renders logout-failed state with retry button on network error, and succeeds on retry (M4-R01)', async () => {
    vi.spyOn(api, 'getMe').mockResolvedValue(rmUserA);
    const logoutSpy = vi
      .spyOn(api, 'logout')
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValueOnce(undefined);

    render(
      <SessionProvider requireAuth={true}>
        <SessionConsumerComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-user-name')).toHaveTextContent('First Advisor');
    });

    // Click logout
    fireEvent.click(screen.getByTestId('btn-logout'));

    // On failure: must NOT redirect to /login immediately
    await waitFor(() => {
      expect(screen.getByTestId('logout-error-banner')).toBeInTheDocument();
    });

    expect(screen.getByText('Sign Out Incomplete')).toBeInTheDocument();
    expect(screen.getByTestId('retry-logout-btn')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalledWith('/login');

    // Click retry sign out
    fireEvent.click(screen.getByTestId('retry-logout-btn'));

    // Second attempt succeeds with 204 -> now redirected to /login
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });

    expect(logoutSpy).toHaveBeenCalledTimes(2);
  });

  it('handles 503 Service Unavailable on /me without terminating session, allowing retry (M4-R03)', async () => {
    const getMeSpy = vi
      .spyOn(api, 'getMe')
      .mockRejectedValueOnce(
        new ApiClientError({
          status: 503,
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'Database service unavailable',
        })
      )
      .mockResolvedValueOnce(rmUserA);

    render(
      <SessionProvider requireAuth={true}>
        <SessionConsumerComponent />
      </SessionProvider>
    );

    // 503 should display session error banner with Retry button, NOT redirect to /login
    await waitFor(() => {
      expect(screen.getByTestId('session-error-banner')).toBeInTheDocument();
    });

    expect(screen.getByText('Service Temporarily Unavailable')).toBeInTheDocument();
    expect(screen.getByTestId('retry-session-btn')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalledWith('/login');

    // Click retry connection
    fireEvent.click(screen.getByTestId('retry-session-btn'));

    // Second attempt succeeds -> session established
    await waitFor(() => {
      expect(screen.getByTestId('current-user-name')).toHaveTextContent('First Advisor');
    });

    expect(getMeSpy).toHaveBeenCalledTimes(2);
  });

  it('broadcasts zero-payload logout event across browser tabs without client data', () => {
    broadcastLogout();

    const storedValue = localStorage.getItem(SESSION_EVENT_KEY);
    expect(storedValue).not.toBeNull();

    const parsed = JSON.parse(storedValue!);
    expect(parsed.type).toBe('LOGOUT');
    expect(typeof parsed.timestamp).toBe('number');

    // Strict verification: payload contains NO client data, PII, or token
    expect(Object.keys(parsed).sort()).toEqual(['timestamp', 'type']);
  });

  it('reacts to cross-tab logout storage event and redirects to /login', async () => {
    vi.spyOn(api, 'getMe').mockResolvedValue(rmUserA);

    render(
      <SessionProvider requireAuth={true}>
        <SessionConsumerComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-user-name')).toHaveTextContent('First Advisor');
    });

    // Simulate storage event from another tab
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: SESSION_EVENT_KEY,
          newValue: JSON.stringify({ type: 'LOGOUT', timestamp: Date.now() }),
        })
      );
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('hides sensitive content on pagehide and revalidates on pageshow (M4-R04)', async () => {
    const getMeSpy = vi.spyOn(api, 'getMe').mockResolvedValue(rmUserA);

    render(
      <SessionProvider requireAuth={true}>
        <SessionConsumerComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-user-name')).toHaveTextContent('First Advisor');
    });

    // Trigger pagehide (before BFCache snapshot)
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    // Sensitive consumer should be replaced by restoring placeholder
    expect(screen.getByText('Restoring session...')).toBeInTheDocument();
    expect(screen.queryByTestId('current-user-name')).toBeNull();

    const callsBefore = getMeSpy.mock.calls.length;

    // Trigger pageshow (restored from BFCache)
    await act(async () => {
      const event = new Event('pageshow') as PageTransitionEvent & { persisted: boolean };
      Object.defineProperty(event, 'persisted', { value: true });
      window.dispatchEvent(event);
    });

    await waitFor(() => {
      expect(screen.getByTestId('current-user-name')).toHaveTextContent('First Advisor');
    });

    expect(getMeSpy.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('does not trigger global unauthorized listener on real login 401 request (M4-R07)', async () => {
    const unauthorizedSpy = vi.fn();
    setUnauthorizedListener(unauthorizedSpy);

    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } }), {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    // Call api.login directly to verify production path
    await expect(api.login({ email: 'wrong@meridian.local', password: 'bad' })).rejects.toThrow();

    // Verify unauthorizedListener was NOT called
    expect(unauthorizedSpy).not.toHaveBeenCalled();
  });

  it('remounts sensitive subtree and purges mounted client data when RM identity switches (AUD-M4-001)', async () => {
    let currentUser = rmUserA;
    vi.spyOn(api, 'getMe').mockImplementation(async () => currentUser);

    const clientListA: ClientListResponse = {
      items: [
        {
          id: 'c-001',
          customerCode: 'CUST-001',
          displayName: 'Somchai Prasert (RM 1 Client)',
          riskLevel: 'CONSERVATIVE',
          health: {
            score: 75,
            classification: 'GOOD',
            status: 'COMPLETE',
            missingFields: [],
            breakdown: { liquidity: 15, debt: 15, savings: 15, goals: 15, investment: 15 },
          },
          recommendation: {
            priority: 'HIGH',
            rule: 'BR-04.1',
            action: 'Review Client Data',
            reason: 'Profile review required',
          },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    };

    const clientListB: ClientListResponse = {
      items: [
        {
          id: 'c-002',
          customerCode: 'CUST-002',
          displayName: 'Wichai Wong (RM 2 Client)',
          riskLevel: 'AGGRESSIVE',
          health: {
            score: 82,
            classification: 'GOOD',
            status: 'COMPLETE',
            missingFields: [],
            breakdown: { liquidity: 18, debt: 18, savings: 15, goals: 15, investment: 16 },
          },
          recommendation: {
            priority: 'LOW',
            rule: 'BR-04.6',
            action: 'Routine Financial Review',
            reason: 'Quarterly review',
          },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    };

    vi.spyOn(api, 'getClients').mockImplementation(async () => {
      return currentUser.id === rmUserA.id ? clientListA : clientListB;
    });

    render(
      <SessionProvider requireAuth={true}>
        <SessionConsumerComponent />
        <ClientListView />
      </SessionProvider>
    );

    // RM 1 Client is loaded and displayed
    await waitFor(() => {
      expect(screen.getByText('Somchai Prasert (RM 1 Client)')).toBeInTheDocument();
    });

    // Switch identity to RM B
    currentUser = rmUserB;
    await act(async () => {
      await latestRefreshSession!();
    });

    // Subtree remounts under RM B: RM 1's client must be completely purged from DOM
    await waitFor(() => {
      expect(screen.getByText('Wichai Wong (RM 2 Client)')).toBeInTheDocument();
    });
    expect(screen.queryByText('Somchai Prasert (RM 1 Client)')).toBeNull();
  });

  it('gates sensitive content during revalidation on visibilitychange, shows retry on 503, and restores view on retry (AUD-M4-002)', async () => {
    let rejectMe: ((err: Error) => void) | null = null;

    let callIndex = 0;
    vi.spyOn(api, 'getMe').mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        return Promise.resolve(rmUserA);
      }
      if (callIndex === 2) {
        return new Promise<AuthUserSummary>((_, reject) => {
          rejectMe = reject;
        });
      }
      return Promise.resolve(rmUserA);
    });

    render(
      <SessionProvider requireAuth={true}>
        <SessionConsumerComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-user-name')).toHaveTextContent('First Advisor');
    });

    // Trigger visibilitychange (user returns to tab)
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // During revalidation, sensitive content must be gated (hidden)
    expect(screen.queryByTestId('current-user-name')).toBeNull();
    expect(screen.getByText('Loading Meridian Portal...')).toBeInTheDocument();

    // Revalidation fails with 503 Service Unavailable
    await act(async () => {
      rejectMe!(
        new ApiClientError({
          status: 503,
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'Database service unavailable during revalidation',
        })
      );
    });

    // Must show retry banner, NOT redirect to login
    await waitFor(() => {
      expect(screen.getByTestId('session-error-banner')).toBeInTheDocument();
    });
    expect(screen.getByText('Service Temporarily Unavailable')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalledWith('/login');

    // Click retry connection
    fireEvent.click(screen.getByTestId('retry-session-btn'));

    // Retry succeeds -> view is restored
    await waitFor(() => {
      expect(screen.getByTestId('current-user-name')).toHaveTextContent('First Advisor');
    });
    expect(screen.queryByTestId('session-error-banner')).toBeNull();
  });
});
