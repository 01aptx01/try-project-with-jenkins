'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { api, ApiClientError } from '../lib/api-client.js';
import type {
  ClientCard,
  MorningActionPlanResponse,
} from '../lib/api-contracts.js';
import { PriorityBadge, HealthBadge, RiskBadge } from './ui/badges.js';
import { Pagination } from './pagination.js';

export interface MorningActionPlanViewProps {
  initialData?: MorningActionPlanResponse | undefined;
}

export function MorningActionPlanView({ initialData }: MorningActionPlanViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse page and pageSize from URL
  const rawPage = searchParams.get('page');
  const page = rawPage && parseInt(rawPage, 10) >= 1 ? parseInt(rawPage, 10) : 1;

  const rawPageSize = searchParams.get('pageSize');
  const parsedSize = rawPageSize ? parseInt(rawPageSize, 10) : 20;
  const pageSize = [20, 50, 100].includes(parsedSize) ? parsedSize : 20;

  const [data, setData] = useState<MorningActionPlanResponse | null>(
    initialData ?? null
  );
  const [isLoading, setIsLoading] = useState(!initialData);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const fetchPlan = async (targetPage: number, targetPageSize: number) => {
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }

    const controller = new AbortController();
    activeControllerRef.current = controller;
    const currentRequestId = ++requestIdRef.current;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await api.getMorningActionPlan(
        { page: targetPage, pageSize: targetPageSize },
        { signal: controller.signal }
      );

      if (currentRequestId === requestIdRef.current) {
        setData(response);
      }
    } catch (error: unknown) {
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      if (error instanceof ApiClientError) {
        if (error.isAbort) return;
        if (error.status === 503) {
          setErrorMessage('Database service is temporarily unavailable. Please try again.');
        } else if (error.isNetworkError) {
          setErrorMessage('Unable to connect to the server. Please check your connection.');
        } else {
          setErrorMessage(error.message || 'Failed to load Morning Action Plan.');
        }
      } else {
        setErrorMessage('An unexpected error occurred while loading Morning Action Plan.');
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchPlan(page, pageSize);

    return () => {
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
      }
    };
  }, [page, pageSize]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage > 1) {
      params.set('page', String(newPage));
    } else {
      params.delete('page');
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page'); // Reset to page 1 on page size change
    if (newPageSize !== 20) {
      params.set('pageSize', String(newPageSize));
    } else {
      params.delete('pageSize');
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header & Date Badge */}
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
            Morning Action Plan
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Review prioritized clients and immediate next best action recommendations
          </p>
        </div>

        {data && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span
              data-testid="map-as-of-date"
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                padding: '0.25rem 0.625rem',
                backgroundColor: 'var(--bg-muted)',
                color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
              }}
            >
              As of: {data.asOfDate}
            </span>
            <span
              data-testid="map-total-count"
              style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-secondary)' }}
            >
              Total Actions: {data.total}
            </span>
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
            onClick={() => fetchPlan(page, pageSize)}
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
          aria-label="Loading morning action plan"
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: '84px',
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
          data-testid="map-empty-state"
          style={{
            textAlign: 'center',
            padding: '3rem 1.5rem',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-muted)',
          }}
        >
          <p style={{ fontSize: '1rem', fontWeight: 500 }}>No action items found.</p>
          {data.total > 0 ? (
            <div>
              <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Page {data.page} has no records. Total {data.total} action items across{' '}
                {Math.ceil(data.total / data.pageSize)} pages.
              </p>
              <button
                type="button"
                id="map-back-first-page-btn"
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
            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
              All client portfolios are currently in order. No immediate reviews required.
            </p>
          )}
        </div>
      )}

      {/* Plan Items Table */}
      {!isLoading && !errorMessage && data && data.items.length > 0 && (
        <>
          <div
            tabIndex={0}
            role="region"
            aria-label="Morning action plan table"
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
                  <th style={{ padding: '0.75rem 1rem' }}>Priority</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Client</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Health Status</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Next Best Action</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Reason</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((client: ClientCard) => (
                  <tr
                    key={client.id}
                    data-testid={`map-row-${client.id}`}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      transition: 'background-color 0.1s ease',
                    }}
                  >
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <PriorityBadge priority={client.recommendation.priority} />
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ fontWeight: 600 }}>
                        <Link
                          href={`/clients/${client.id}`}
                          style={{ color: 'var(--primary)', textDecoration: 'none' }}
                        >
                          {client.displayName}
                        </Link>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {client.customerCode} • <RiskBadge riskLevel={client.riskLevel} />
                      </div>
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <HealthBadge health={client.health} />
                    </td>
                    <td
                      style={{
                        padding: '0.875rem 1rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {client.recommendation.action}
                    </td>
                    <td
                      style={{
                        padding: '0.875rem 1rem',
                        color: 'var(--text-secondary)',
                        maxWidth: '320px',
                      }}
                    >
                      {client.recommendation.reason}
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
                        Review Profile
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
