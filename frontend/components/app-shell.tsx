'use client';

import React, { type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from './session-provider.js';

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user, logout } = useSession();
  const pathname = usePathname();

  const isDashboardActive = pathname === '/dashboard' || pathname === '/';
  const isClientsActive = pathname?.startsWith('/clients');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-color)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '0.75rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          {/* Logo & Main Nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <Link
              href="/dashboard"
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--primary)',
                letterSpacing: '-0.025em',
                textDecoration: 'none',
              }}
            >
              Meridian
            </Link>

            <nav aria-label="Main Navigation" style={{ display: 'flex', gap: '0.5rem' }}>
              <Link
                href="/dashboard"
                aria-current={isDashboardActive ? 'page' : undefined}
                style={{
                  padding: '0.5rem 0.875rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.9375rem',
                  fontWeight: isDashboardActive ? 600 : 500,
                  color: isDashboardActive ? 'var(--primary)' : 'var(--text-secondary)',
                  backgroundColor: isDashboardActive ? 'var(--bg-muted)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'color 0.15s ease, background-color 0.15s ease',
                }}
              >
                Morning Action Plan
              </Link>

              <Link
                href="/clients"
                aria-current={isClientsActive ? 'page' : undefined}
                style={{
                  padding: '0.5rem 0.875rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.9375rem',
                  fontWeight: isClientsActive ? 600 : 500,
                  color: isClientsActive ? 'var(--primary)' : 'var(--text-secondary)',
                  backgroundColor: isClientsActive ? 'var(--bg-muted)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'color 0.15s ease, background-color 0.15s ease',
                }}
              >
                Clients
              </Link>
            </nav>
          </div>

          {/* User Profile & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {user && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  color: 'var(--text-primary)',
                }}
              >
                <span style={{ fontWeight: 600 }}>{user.name}</span>
                <span
                  style={{
                    backgroundColor: 'var(--bg-muted)',
                    color: 'var(--text-muted)',
                    padding: '0.125rem 0.375rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {user.role}
                </span>
              </div>
            )}

            <button
              onClick={() => logout()}
              type="button"
              aria-label="Sign out of account"
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        style={{
          flex: 1,
          maxWidth: '1280px',
          width: '100%',
          margin: '0 auto',
          padding: '2rem 1.5rem',
        }}
      >
        {children}
      </main>
    </div>
  );
}
