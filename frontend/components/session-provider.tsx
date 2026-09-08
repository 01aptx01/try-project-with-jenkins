'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { api, setUnauthorizedListener, ApiClientError } from '../lib/api-client.js';
import type { AuthUserSummary } from '../lib/api-contracts.js';
import { clearFamilyGraphCache } from '../hooks/use-family-graph.js';
import {
  getSessionGeneration,
  bumpSessionGeneration,
  broadcastLogout,
  SESSION_EVENT_KEY,
  type SessionSyncMessage,
} from '../lib/session-lifecycle.js';

export interface SessionContextValue {
  user: AuthUserSummary | null;
  isLoading: boolean;
  logoutError: string | null;
  sessionError: string | null;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}

export interface SessionProviderProps {
  children: ReactNode;
  requireAuth?: boolean;
}

export function SessionProvider({
  children,
  requireAuth = true,
}: SessionProviderProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUserSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [sessionConnectionError, setSessionConnectionError] = useState<string | null>(null);
  const [isPageHidden, setIsPageHidden] = useState(false);
  const isPageHiddenRef = useRef(false);

  const previousUserIdRef = useRef<string | null>(null);
  const refreshRequestIdRef = useRef(0);
  const inFlightRefreshControllerRef = useRef<AbortController | null>(null);

  const handleSessionTermination = useCallback(() => {
    if (inFlightRefreshControllerRef.current) {
      inFlightRefreshControllerRef.current.abort();
    }
    bumpSessionGeneration();
    clearFamilyGraphCache();
    setUser(null);
    previousUserIdRef.current = null;
    setLogoutError(null);
    setIsLoggingOut(false);
    setSessionConnectionError(null);
    if (requireAuth) {
      router.push('/login');
    }
  }, [requireAuth, router]);

  const refreshSession = useCallback(async () => {
    // Abort previous in-flight getMe request
    if (inFlightRefreshControllerRef.current) {
      inFlightRefreshControllerRef.current.abort();
    }
    const controller = new AbortController();
    inFlightRefreshControllerRef.current = controller;
    const currentReqId = ++refreshRequestIdRef.current;
    const capturedGeneration = getSessionGeneration();

    setIsLoading(true);
    setSessionConnectionError(null);

    try {
      const me = await api.getMe({ signal: controller.signal });

      // Guard: Discard if newer request was dispatched or session generation changed
      if (
        refreshRequestIdRef.current !== currentReqId ||
        getSessionGeneration() !== capturedGeneration
      ) {
        return;
      }

      // If switching RM identity, bust caches and increment generation
      if (previousUserIdRef.current && previousUserIdRef.current !== me.id) {
        bumpSessionGeneration();
        clearFamilyGraphCache();
      }
      previousUserIdRef.current = me.id;
      setUser(me);
      setSessionConnectionError(null);
    } catch (err: unknown) {
      if (
        refreshRequestIdRef.current !== currentReqId ||
        getSessionGeneration() !== capturedGeneration
      ) {
        return;
      }

      if (err instanceof ApiClientError && err.isAbort) {
        return;
      }

      if (err instanceof ApiClientError && err.status === 401) {
        // Genuine unauthenticated: terminate session and redirect to login
        handleSessionTermination();
      } else {
        // 503 Service Unavailable, network error, or timeout:
        // Do NOT terminate valid session; show retry connection UI
        setSessionConnectionError(
          err instanceof ApiClientError && err.message
            ? err.message
            : 'Unable to connect to the server. Please check your network and retry.'
        );
      }
    } finally {
      if (
        refreshRequestIdRef.current === currentReqId &&
        getSessionGeneration() === capturedGeneration
      ) {
        setIsLoading(false);
      }
    }
  }, [handleSessionTermination]);

  // 1. Initial session verification
  useEffect(() => {
    void refreshSession();

    return () => {
      if (inFlightRefreshControllerRef.current) {
        inFlightRefreshControllerRef.current.abort();
      }
    };
  }, [refreshSession]);

  // 2. Global unauthorized listener for non-login endpoints
  useEffect(() => {
    setUnauthorizedListener(() => {
      handleSessionTermination();
    });

    return () => {
      setUnauthorizedListener(null);
    };
  }, [handleSessionTermination]);

  // 3. Cross-tab synchronization via storage event
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_EVENT_KEY && event.newValue) {
        try {
          const payload = JSON.parse(event.newValue) as SessionSyncMessage;
          if (payload.type === 'LOGOUT') {
            handleSessionTermination();
          }
        } catch {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, [handleSessionTermination]);

  // 4. BFCache pagehide / pageshow protection and tab visibility revalidation
  useEffect(() => {
    const onPageHide = () => {
      // Hide sensitive views before BFCache freezes DOM snapshot
      isPageHiddenRef.current = true;
      setIsPageHidden(true);
    };

    const onPageShow = (event: PageTransitionEvent | Event) => {
      // If restored from BFCache or page was hidden, revalidate before restoring view
      const persisted = 'persisted' in event ? (event as PageTransitionEvent).persisted : false;
      if (persisted || isPageHiddenRef.current) {
        setIsPageHidden(true);
        void refreshSession().finally(() => {
          isPageHiddenRef.current = false;
          setIsPageHidden(false);
        });
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshSession();
      }
    };

    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refreshSession]);

  const logout = useCallback(async () => {
    setIsLoggingOut(true);
    setLogoutError(null);

    try {
      await api.logout();
      // Only broadcast and terminate on confirmed server logout (204)
      broadcastLogout();
      handleSessionTermination();
    } catch (err: unknown) {
      // Server logout failed (e.g. 503, network drop, 403)
      // Do NOT broadcast logout or redirect; allow retry
      setIsLoggingOut(false);
      setLogoutError(
        err instanceof Error && err.message
          ? err.message
          : 'Unable to sign out from the server. Please check your connection and retry.'
      );
    }
  }, [handleSessionTermination]);

  // If page was hidden for BFCache snapshot, render minimal placeholder
  if (requireAuth && isPageHidden) {
    return (
      <div
        role="status"
        aria-label="Restoring session"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-secondary)',
          fontSize: '1rem',
        }}
      >
        <span>Restoring session...</span>
      </div>
    );
  }

  // Logout error state with accessible retry action
  if (logoutError) {
    return (
      <div
        role="alert"
        data-testid="logout-error-banner"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          backgroundColor: 'var(--bg-primary)',
          gap: '1rem',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '440px',
            padding: '1.5rem',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--priority-high-border)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--priority-high-text)' }}>
            Sign Out Incomplete
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            {logoutError}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.25rem' }}>
            <button
              type="button"
              data-testid="retry-logout-btn"
              onClick={() => void logout()}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-contrast)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Retry Sign Out
            </button>
            <button
              type="button"
              data-testid="cancel-logout-btn"
              onClick={() => setLogoutError(null)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Stay in Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active logout in progress
  if (isLoggingOut) {
    return (
      <div
        role="status"
        aria-label="Signing out"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-secondary)',
          fontSize: '1rem',
        }}
      >
        <span>Signing out...</span>
      </div>
    );
  }

  // Session connection error (e.g. 503 / network issue on /me) with retry option
  if (requireAuth && sessionConnectionError && !user) {
    return (
      <div
        role="alert"
        data-testid="session-error-banner"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          backgroundColor: 'var(--bg-primary)',
          gap: '1rem',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '440px',
            padding: '1.5rem',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Service Temporarily Unavailable
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            {sessionConnectionError}
          </p>
          <button
            type="button"
            data-testid="retry-session-btn"
            onClick={() => void refreshSession()}
            style={{
              marginTop: '1.25rem',
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-contrast)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (requireAuth && isLoading && !user) {
    return (
      <div
        role="status"
        aria-label="Loading session"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-secondary)',
          fontSize: '1rem',
        }}
      >
        <span>Loading Meridian Portal...</span>
      </div>
    );
  }

  if (requireAuth && !user && !isLoading) {
    return null;
  }

  return (
    <SessionContext.Provider
      value={{
        user,
        isLoading,
        logoutError,
        sessionError: sessionConnectionError,
        logout,
        refreshSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
