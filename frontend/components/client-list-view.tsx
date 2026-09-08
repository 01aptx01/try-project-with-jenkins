'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api, ApiClientError } from '../lib/api-client.js';
import type { ClientCard, ClientListResponse } from '../lib/api-contracts.js';
import { PriorityBadge, HealthBadge, RiskBadge } from './ui/badges.js';

export interface ClientListViewProps {
  initialData?: ClientListResponse | undefined;
}

export function ClientListView({ initialData }: ClientListViewProps) {
  const [data, setData] = useState<ClientListResponse | null>(initialData ?? null);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setData(null); // Clear old results to prevent stale data display

    try {
      const response = await api.getClients({ page: 1, pageSize: 20 });
      setData(response);
    } catch (error: unknown) {
      if (error instanceof ApiClientError) {
        if (error.status === 503) {
          setErrorMessage('Database service is temporarily unavailable. Please try again.');
        } else if (error.isNetworkError) {
          setErrorMessage('Unable to connect to the server. Please check your connection.');
        } else {
          setErrorMessage(error.message || 'Failed to load client directory.');
        }
      } else {
        setErrorMessage('An unexpected error occurred while loading clients.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialData) {
      fetchClients();
    }
  }, [fetchClients, initialData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header & Count */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '0.75rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Client Directory
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Manage and review assigned client relationships
          </p>
        </div>

        {data && (
          <div
            data-testid="client-total-count"
            style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-secondary)' }}
          >
            Total Clients: {data.total}
          </div>
        )}
      </div>

      {/* Error state */}
      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: '1rem',
            backgroundColor: 'var(--priority-high-bg)',
            color: 'var(--priority-high-text)',
            border: '1px solid var(--priority-high-border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{errorMessage}</span>
          <button
            onClick={fetchClients}
            type="button"
            style={{
              padding: '0.375rem 0.75rem',
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-contrast)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div
          role="status"
          aria-label="Loading client directory"
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: '72px',
                backgroundColor: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                animation: 'pulse 1.5s infinite',
              }}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !errorMessage && data && data.items.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '3rem 1.5rem',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-muted)',
          }}
        >
          <p style={{ fontSize: '1rem', fontWeight: 500 }}>No clients found.</p>
          <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
            No client records assigned to your RM portfolio.
          </p>
        </div>
      )}

      {/* Data Table */}
      {!isLoading && !errorMessage && data && data.items.length > 0 && (
        <div
          style={{
            overflowX: 'auto',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '0.875rem',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-muted)',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                }}
              >
                <th style={{ padding: '0.75rem 1rem' }}>Code</th>
                <th style={{ padding: '0.75rem 1rem' }}>Client Name</th>
                <th style={{ padding: '0.75rem 1rem' }}>Risk Level</th>
                <th style={{ padding: '0.75rem 1rem' }}>Health Status</th>
                <th style={{ padding: '0.75rem 1rem' }}>Priority</th>
                <th style={{ padding: '0.75rem 1rem' }}>Next Best Action</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((client: ClientCard) => (
                <tr
                  key={client.id}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background-color 0.1s ease',
                  }}
                >
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {client.customerCode}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <Link
                      href={`/clients/${client.id}`}
                      style={{ color: 'var(--primary)', textDecoration: 'none' }}
                    >
                      {client.displayName}
                    </Link>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <RiskBadge riskLevel={client.riskLevel} />
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <HealthBadge health={client.health} />
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <PriorityBadge priority={client.recommendation.priority} />
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)' }}>
                    {client.recommendation.action}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                    <Link
                      href={`/clients/${client.id}`}
                      style={{
                        padding: '0.375rem 0.625rem',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        backgroundColor: 'var(--bg-muted)',
                        color: 'var(--text-primary)',
                        borderRadius: 'var(--radius-sm)',
                        textDecoration: 'none',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      Profile
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
