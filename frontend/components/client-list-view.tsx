'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { api, ApiClientError } from '../lib/api-client.js';
import type {
  ClientCard,
  ClientListQuery,
  ClientListResponse,
  PriorityLevel,
  HealthFilter,
} from '../lib/api-contracts.js';
import { PriorityBadge, HealthBadge, RiskBadge } from './ui/badges.js';
import { ClientFilters } from './client-filters.js';
import { Pagination } from './pagination.js';
import {
  normalizeClientQuery,
  buildClientQueryString,
  type ParsedClientQuery,
} from '../lib/client-query.js';
import {
  getSessionGeneration,
  registerInFlightController,
} from '../lib/session-lifecycle.js';

export interface ClientListViewProps {
  initialData?: ClientListResponse | undefined;
}

export function ClientListView({ initialData }: ClientListViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Normalize current query from URL
  const currentQuery: ParsedClientQuery = normalizeClientQuery(searchParams);

  const [data, setData] = useState<ClientListResponse | null>(initialData ?? null);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Keep track of the active request to cancel in-flight or ignore outdated responses
  const activeControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const fetchClients = async (query: ParsedClientQuery) => {
    // Abort previous in-flight request if any
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }

    const controller = new AbortController();
    activeControllerRef.current = controller;
    const currentRequestId = ++requestIdRef.current;
    const capturedGeneration = getSessionGeneration();
    const unregister = registerInFlightController(controller);

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const queryPayload: ClientListQuery = {
        page: query.page,
        pageSize: query.pageSize,
      };
      if (query.search) queryPayload.search = query.search;
      if (query.priority) queryPayload.priority = query.priority;
      if (query.health) queryPayload.health = query.health;

      const response = await api.getClients(queryPayload, { signal: controller.signal });

      // Only update state if this is still the latest request and session generation unchanged
      if (
        currentRequestId === requestIdRef.current &&
        capturedGeneration === getSessionGeneration()
      ) {
        setData(response);
      }
    } catch (error: unknown) {
      if (
        currentRequestId !== requestIdRef.current ||
        capturedGeneration !== getSessionGeneration()
      ) {
        // Obsolete request or session changed, ignore
        return;
      }

      if (error instanceof ApiClientError) {
        if (error.isAbort) {
          // Request was cancelled due to rapid query change, do nothing
          return;
        }
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
      unregister();
      if (
        currentRequestId === requestIdRef.current &&
        capturedGeneration === getSessionGeneration()
      ) {
        setIsLoading(false);
      }
    }
  };

  // Trigger fetch whenever searchParams change (or on initial mount if no initialData)
  useEffect(() => {
    fetchClients(currentQuery);

    return () => {
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
      }
    };
  }, [
    currentQuery.search,
    currentQuery.priority,
    currentQuery.health,
    currentQuery.page,
    currentQuery.pageSize,
  ]);

  const handleApplyFilters = (newFilters: {
    search?: string | undefined;
    priority?: PriorityLevel | undefined;
    health?: HealthFilter | undefined;
  }) => {
    const updatedQuery: ParsedClientQuery = {
      ...currentQuery,
      search: newFilters.search,
      priority: newFilters.priority,
      health: newFilters.health,
      page: 1, // Reset page to 1 whenever filters change
    };

    const qs = buildClientQueryString(updatedQuery);
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const handleResetFilters = () => {
    router.push(pathname);
  };

  const handlePageChange = (newPage: number) => {
    const updatedQuery: ParsedClientQuery = {
      ...currentQuery,
      page: newPage,
    };
    const qs = buildClientQueryString(updatedQuery);
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    const updatedQuery: ParsedClientQuery = {
      ...currentQuery,
      pageSize: newPageSize,
      page: 1, // Reset to page 1 on page size change
    };
    const qs = buildClientQueryString(updatedQuery);
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const hasFiltersApplied = Boolean(
    currentQuery.search || currentQuery.priority || currentQuery.health
  );

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

      {/* Filter and Search Bar */}
      <ClientFilters
        search={currentQuery.search ?? ''}
        priority={currentQuery.priority}
        health={currentQuery.health}
        onApplyFilters={handleApplyFilters}
        onReset={handleResetFilters}
        isLoading={isLoading}
      />

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
            onClick={() => fetchClients(currentQuery)}
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
          data-testid="client-empty-state"
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
          {data.total > 0 ? (
            <div>
              <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Page {data.page} has no results. Total {data.total} clients available across{' '}
                {Math.ceil(data.total / data.pageSize)} pages.
              </p>
              <button
                type="button"
                id="pagination-back-first-page-btn"
                onClick={() => handlePageChange(1)}
                style={{
                  marginTop: '1rem',
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-contrast)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                }}
              >
                Back to First Page
              </button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {hasFiltersApplied
                  ? 'No client records match the selected filter criteria.'
                  : 'No client records assigned to your RM portfolio.'}
              </p>
              {hasFiltersApplied && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  style={{
                    marginTop: '1rem',
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--primary)',
                    border: '1px solid var(--primary)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Data Table */}
      {!isLoading && !errorMessage && data && data.items.length > 0 && (
        <>
          <div
            tabIndex={0}
            role="region"
            aria-label="Client directory table"
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

          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            isLoading={isLoading}
          />
        </>
      )}
    </div>
  );
}
