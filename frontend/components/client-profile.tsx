'use client';

import React from 'react';
import Link from 'next/link';
import { useClientProfile } from '../hooks/use-client-profile.js';
import { PriorityBadge, HealthBadge, RiskBadge } from './ui/badges.js';
import type { ClientProfileSnapshotResponse } from '../lib/api-contracts.js';

export interface ClientProfileProps {
  clientId: string;
  initialData?: ClientProfileSnapshotResponse | undefined;
}

export function ClientProfile({ clientId }: ClientProfileProps) {
  const { data, isLoading, errorMessage, isNotFound, refetch } = useClientProfile(clientId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Breadcrumb Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link
          href="/clients"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            color: 'var(--primary)',
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          ← Back to Client Directory
        </Link>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div
          role="status"
          aria-label="Loading client profile"
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <div
            style={{
              height: '120px',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              animation: 'pulse 1.5s infinite',
            }}
          />
          <div
            style={{
              height: '240px',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              animation: 'pulse 1.5s infinite',
            }}
          />
        </div>
      )}

      {/* Not Found State (BR-09: missing or not-owned) */}
      {isNotFound && !isLoading && (
        <div
          role="alert"
          data-testid="client-not-found"
          style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Client Not Found
          </h2>
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
              marginTop: '0.5rem',
              maxWidth: '420px',
              marginInline: 'auto',
            }}
          >
            The requested client record does not exist or you do not have permission to view it.
          </p>
          <Link
            href="/clients"
            style={{
              display: 'inline-block',
              marginTop: '1.25rem',
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-contrast)',
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Return to Client Directory
          </Link>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && !isLoading && (
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
            type="button"
            onClick={refetch}
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

      {/* Active Profile View */}
      {data && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Client Header Card */}
          <div
            style={{
              padding: '1.5rem',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <h1
                    data-testid="profile-display-name"
                    style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}
                  >
                    {data.client.displayName}
                  </h1>
                  <span
                    data-testid="profile-customer-code"
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      padding: '0.25rem 0.5rem',
                      backgroundColor: 'var(--bg-muted)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {data.client.customerCode}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    marginTop: '0.5rem',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span>
                    Age: <strong>{data.client.age !== null ? data.client.age : 'Not specified'}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Occupation:{' '}
                    <strong>{data.client.occupation || 'Not specified'}</strong>
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span
                  data-testid="profile-as-of-date"
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
                <RiskBadge riskLevel={data.client.riskLevel} />
                <HealthBadge health={data.health} />
              </div>
            </div>

            {/* Quick Navigation Tabs / Actions */}
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                borderTop: '1px solid var(--border-color)',
                paddingTop: '1rem',
              }}
            >
              <Link
                href={`/clients/${data.client.id}/family`}
                id="profile-family-link"
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--bg-muted)',
                  color: 'var(--text-primary)',
                  borderRadius: 'var(--radius-sm)',
                  textDecoration: 'none',
                  border: '1px solid var(--border-color)',
                }}
              >
                View Family Network
              </Link>
            </div>
          </div>

          {/* AI Executive Summary Card */}
          <section
            aria-labelledby="summary-heading"
            style={{
              padding: '1.25rem 1.5rem',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
            }}
          >
            <h2
              id="summary-heading"
              style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}
            >
              Portfolio Summary
            </h2>
            <p
              data-testid="profile-summary-text"
              style={{
                marginTop: '0.5rem',
                fontSize: '0.9375rem',
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
              }}
            >
              {data.summary}
            </p>
          </section>

          {/* Next Best Action Card */}
          <section
            aria-labelledby="nba-heading"
            style={{
              padding: '1.25rem 1.5rem',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2
                id="nba-heading"
                style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}
              >
                Next Best Action
              </h2>
              <PriorityBadge priority={data.recommendation.priority} />
            </div>

            <div>
              <div
                data-testid="profile-nba-action"
                style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}
              >
                {data.recommendation.action}
              </div>
              <p
                data-testid="profile-nba-reason"
                style={{
                  marginTop: '0.25rem',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                }}
              >
                {data.recommendation.reason}
              </p>
            </div>
          </section>

          {/* Financial Profile & Goals Section (Foundation for M4-010) */}
          <section
            aria-labelledby="financial-heading"
            style={{
              padding: '1.25rem 1.5rem',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
            }}
          >
            <h2
              id="financial-heading"
              style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}
            >
              Financial Profile & Health
            </h2>

            {data.financialProfile ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '1rem',
                  marginTop: '1rem',
                }}
              >
                <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Monthly Income</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                    {data.financialProfile.monthlyIncome ? `฿${data.financialProfile.monthlyIncome}` : '—'}
                  </div>
                </div>

                <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Monthly Expense</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                    {data.financialProfile.monthlyExpense ? `฿${data.financialProfile.monthlyExpense}` : '—'}
                  </div>
                </div>

                <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Liquid Assets</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                    {data.financialProfile.liquidAssets ? `฿${data.financialProfile.liquidAssets}` : '—'}
                  </div>
                </div>

                <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Debt</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                    {data.financialProfile.totalDebt ? `฿${data.financialProfile.totalDebt}` : '—'}
                  </div>
                </div>
              </div>
            ) : (
              <div
                data-testid="profile-incomplete-financial"
                style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  backgroundColor: 'var(--bg-muted)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-muted)',
                  fontSize: '0.875rem',
                }}
              >
                No financial profile recorded for this client. Financial health status is incomplete.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
