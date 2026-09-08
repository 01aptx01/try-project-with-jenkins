'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiClientError } from '../lib/api-client.js';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  const startCountdown = (seconds: number) => {
    setRetryCountdown(seconds);
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    countdownTimerRef.current = setInterval(() => {
      setRetryCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending || retryCountdown !== null) return;

    setErrorMessage(null);
    setIsPending(true);

    try {
      await api.login({
        email: email.trim().toLowerCase(),
        password, // Do NOT trim password
      });

      router.push('/dashboard');
    } catch (error: unknown) {
      setIsPending(false);

      if (error instanceof ApiClientError) {
        if (error.status === 401) {
          setErrorMessage('Invalid email or password. Please try again.');
        } else if (error.status === 429) {
          const waitSeconds = error.retryAfter && error.retryAfter > 0 ? error.retryAfter : 60;
          setErrorMessage(
            `Too many failed login attempts. Please wait ${waitSeconds} seconds before trying again.`
          );
          startCountdown(waitSeconds);
        } else if (error.status === 403) {
          setErrorMessage('Access denied due to security policy (Origin mismatch).');
        } else if (error.status === 503) {
          setErrorMessage('Service is temporarily unavailable. Please try again later.');
        } else if (error.isNetworkError) {
          setErrorMessage('Unable to connect to the server. Please check your network.');
        } else {
          setErrorMessage(error.message || 'An unexpected error occurred.');
        }
      } else {
        setErrorMessage('An unexpected error occurred.');
      }
    }
  };

  const isSubmitDisabled = isPending || retryCountdown !== null;

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Relationship Manager Login"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        maxWidth: '400px',
        width: '100%',
        margin: '0 auto',
        padding: '2rem',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        border: '1px solid var(--border-color)',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Meridian RM Portal
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Sign in to your Relationship Manager account
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--priority-high-bg)',
            color: 'var(--priority-high-text)',
            border: '1px solid var(--priority-high-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.875rem',
          }}
        >
          {errorMessage}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <label
          htmlFor="login-email"
          style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}
        >
          Email address
        </label>
        <input
          id="login-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
          placeholder="name@meridian.local"
          style={{
            padding: '0.625rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            fontSize: '0.9375rem',
            backgroundColor: isPending ? 'var(--bg-muted)' : 'var(--bg-surface)',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <label
          htmlFor="login-password"
          style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}
        >
          Password
        </label>
        <input
          id="login-password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isPending}
          placeholder="••••••••"
          style={{
            padding: '0.625rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            fontSize: '0.9375rem',
            backgroundColor: isPending ? 'var(--bg-muted)' : 'var(--bg-surface)',
          }}
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitDisabled}
        style={{
          marginTop: '0.5rem',
          padding: '0.75rem 1rem',
          backgroundColor: isSubmitDisabled ? 'var(--text-muted)' : 'var(--primary)',
          color: 'var(--primary-contrast)',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.15s ease',
        }}
      >
        {isPending
          ? 'Signing in...'
          : retryCountdown !== null
          ? `Wait (${retryCountdown}s)`
          : 'Sign in'}
      </button>
    </form>
  );
}
