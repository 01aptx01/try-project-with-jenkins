import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionProvider, useSession } from '../components/session-provider.js';
import { AppShell } from '../components/app-shell.js';
import { api, ApiClientError } from '../lib/api-client.js';
import { mockAuthUser } from './fixtures/api.js';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/dashboard',
}));

function DummyConsumer() {
  const { user } = useSession();
  return <div data-testid="user-display">{user ? user.name : 'No User'}</div>;
}

describe('Session Shell & Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('authenticates user on mount and renders protected content', async () => {
    vi.spyOn(api, 'getMe').mockResolvedValue(mockAuthUser);

    render(
      <SessionProvider requireAuth={true}>
        <AppShell>
          <div data-testid="protected-content">Dashboard View</div>
        </AppShell>
      </SessionProvider>
    );

    // Initial loading state
    expect(screen.getByText(/loading meridian portal/i)).toBeInTheDocument();

    // After session loads
    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      expect(screen.getByText(mockAuthUser.name)).toBeInTheDocument();
      expect(screen.getByText(mockAuthUser.role)).toBeInTheDocument();
    });

    // Verify navigation links
    expect(
      screen.getByRole('link', { name: /morning action plan/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /clients/i })
    ).toBeInTheDocument();
  });

  it('redirects to /login when session is unauthorized (401)', async () => {
    vi.spyOn(api, 'getMe').mockRejectedValue(
      new ApiClientError({
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'No session cookie',
      })
    );

    render(
      <SessionProvider requireAuth={true}>
        <AppShell>
          <div data-testid="should-not-render">Secret Content</div>
        </AppShell>
      </SessionProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });

    expect(screen.queryByTestId('should-not-render')).not.toBeInTheDocument();
  });

  it('handles sign out by calling logout API and redirecting to /login', async () => {
    vi.spyOn(api, 'getMe').mockResolvedValue(mockAuthUser);
    const logoutSpy = vi.spyOn(api, 'logout').mockResolvedValue(undefined);

    render(
      <SessionProvider requireAuth={true}>
        <AppShell>
          <div>Main App</div>
        </AppShell>
      </SessionProvider>
    );

    const signOutBtn = await screen.findByRole('button', {
      name: /sign out of account/i,
    });
    expect(signOutBtn).toBeInTheDocument();

    fireEvent.click(signOutBtn);

    await waitFor(() => {
      expect(logoutSpy).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('allows public rendering when requireAuth is false', async () => {
    vi.spyOn(api, 'getMe').mockRejectedValue(
      new ApiClientError({
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'No session',
      })
    );

    render(
      <SessionProvider requireAuth={false}>
        <DummyConsumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-display')).toHaveTextContent('No User');
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});
