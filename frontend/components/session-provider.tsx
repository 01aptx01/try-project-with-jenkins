'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiClientError } from '../lib/api-client.js';
import type { AuthUserSummary } from '../lib/api-contracts.js';

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

  const refreshSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const me = await api.getMe();
      setUser(me);
    } catch (error) {
      setUser(null);
      if (error instanceof ApiClientError && error.status === 401 && requireAuth) {
        router.push('/login');
      }
    } finally {
      setIsLoading(false);
    }
  }, [router, requireAuth]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Ignore logout errors and proceed to clear local state
    } finally {
      setUser(null);
      router.push('/login');
    }
  }, [router]);

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
    // Redirect triggered in refreshSession; render null to prevent layout flashing
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
