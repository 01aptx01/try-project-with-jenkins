import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from '../components/login-form.js';
import { api, ApiClientError } from '../lib/api-client.js';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('LoginForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('renders login form with inputs and submit button', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign in/i })
    ).toBeInTheDocument();
  });

  it('submits valid credentials, does not trim password, and redirects to dashboard', async () => {
    const loginSpy = vi.spyOn(api, 'login').mockResolvedValueOnce({
      user: { id: 'rm-1', name: 'Sarah Jenkins', role: 'RM' },
    });

    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: ' RM1@meridian.local ' } });
    fireEvent.change(passwordInput, { target: { value: '  SecretPass123!  ' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledWith({
        email: 'rm1@meridian.local',
        password: '  SecretPass123!  ', // UNTRIMMED
      });
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    // Verify no credentials or tokens are saved to localStorage or sessionStorage
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('displays 401 error message for wrong credentials', async () => {
    vi.spyOn(api, 'login').mockRejectedValueOnce(
      new ApiClientError({
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
      })
    );

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'rm1@meridian.local' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrongpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/invalid email or password/i);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('handles 429 Too Many Requests with Retry-After and disables button', async () => {
    vi.spyOn(api, 'login').mockRejectedValueOnce(
      new ApiClientError({
        status: 429,
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests',
        retryAfter: 30,
      })
    );

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'rm1@meridian.local' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/wait 30 seconds/i);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/wait/i);
  });

  it('displays appropriate message for 503 service unavailable', async () => {
    vi.spyOn(api, 'login').mockRejectedValueOnce(
      new ApiClientError({
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Database unavailable',
      })
    );

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'rm1@meridian.local' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/service is temporarily unavailable/i);
  });

  it('displays appropriate message for network connection failure', async () => {
    vi.spyOn(api, 'login').mockRejectedValueOnce(
      new ApiClientError({
        status: 0,
        code: 'NETWORK_ERROR',
        message: 'Failed to fetch',
        isNetworkError: true,
      })
    );

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'rm1@meridian.local' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/unable to connect to the server/i);
  });
});
