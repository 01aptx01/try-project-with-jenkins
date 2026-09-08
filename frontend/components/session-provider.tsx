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
import { api, setUnauthorizedListener } from '../lib/api-client.js';
import type { AuthUserSummary } from '../lib/api-contracts.js';
import { clearFamilyGraphCache } from '../hooks/use-family-graph.js';
import {
  bumpSessionGeneration,
  broadcastLogout,
  SESSION_EVENT_KEY,
  type SessionSyncMessage,
} from '../lib/session-lifecycle.js';

export interface SessionContextValue {
  user: AuthUserSummary | null;
  isLoading: boolean;
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
  const previousUserIdRef = useRef<string | null>(null);

  const handleSessionTermination = useCallback(() => {
    bumpSessionGeneration();
    clearFamilyGraphCache();
    setUser(null);
    previousUserIdRef.current = null;
    if (requireAuth) {
      router.push('/login');
    }
  }, [requireAuth, router]);

  const refreshSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const me = await api.getMe();

      // If switching RM identity, bust caches and increment generation
      if (previousUserIdRef.current && previousUserIdRef.current !== me.id) {
        bumpSessionGeneration();
        clearFamilyGraphCache();
      }
      previousUserIdRef.current = me.id;
      setUser(me);
    } catch {
      handleSessionTermination();
    } finally {
      setIsLoading(false);
    }
  }, [handleSessionTermination]);

  // 1. Initial session verification
  useEffect(() => {
    void refreshSession();
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

  // 4. BFCache restore and tab visibility revalidation
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      // If restored from BFCache, revalidate session immediately
      if (event.persisted) {
        void refreshSession();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshSession();
      }
    };

    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refreshSession]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network failure on logout; still terminate locally
    } finally {
      broadcastLogout();
      handleSessionTermination();
    }
  }, [handleSessionTermination]);

  if (requireAuth && isLoading) {
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
        logout,
        refreshSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
