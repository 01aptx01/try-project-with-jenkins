'use client';

import React from 'react';
import type { HealthResult } from '../lib/api-contracts.js';
import { HealthBadge } from './ui/badges.js';

export interface HealthPanelProps {
  health: HealthResult;
}

interface BreakdownComponentConfig {
  key: keyof HealthResult['breakdown'];
  label: string;
  max: number;
  testId: string;
}

const BREAKDOWN_COMPONENTS: readonly BreakdownComponentConfig[] = [
  { key: 'liquidity', label: 'Liquidity Buffer', max: 20, testId: 'health-comp-liquidity' },
  { key: 'debt', label: 'Debt Service Ratio', max: 20, testId: 'health-comp-debt' },
  { key: 'savings', label: 'Savings Rate', max: 20, testId: 'health-comp-savings' },
  { key: 'goals', label: 'Goal Funding', max: 20, testId: 'health-comp-goals' },
  { key: 'investment', label: 'Investment Allocation', max: 20, testId: 'health-comp-investment' },
] as const;

function formatComponentScore(val: number | null, max: number): string {
  if (val === null || val === undefined) {
    return 'Not available';
  }
  return `${val} / ${max}`;
}

export function HealthPanel({ health }: HealthPanelProps) {
  const isComplete = health.status === 'COMPLETE';

  return (
    <section
      aria-labelledby="health-analysis-heading"
      data-testid="health-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        padding: '1.5rem',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header & Overall Score */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '1.25rem',
        }}
      >
        <div>
          <h2
            id="health-analysis-heading"
            style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}
          >
            Financial Health Analysis
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Comprehensive 5-pillar financial soundness evaluation
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <HealthBadge health={health} />
        </div>
      </div>

      {/* Overall Score Summary */}
      <div
        data-testid="health-overall-summary"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          padding: '1rem 1.25rem',
          backgroundColor: 'var(--bg-muted)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Overall Health Score
          </div>
          <div
            data-testid="health-overall-score-display"
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: isComplete ? 'var(--text-primary)' : 'var(--text-muted)',
              marginTop: '0.25rem',
            }}
          >
            {isComplete && health.score !== null ? `${health.score} / 100` : 'Not available'}
          </div>
        </div>

        <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Status & Classification
          </div>
          <div
            data-testid="health-status-text"
            style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '0.25rem' }}
          >
            {isComplete
              ? `Classification: ${health.classification || 'Unknown'}`
              : 'Status: Insufficient Data for Calculation'}
          </div>
        </div>
      </div>

      {/* Missing Fields Notice (when INSUFFICIENT_DATA) */}
      {!isComplete && health.missingFields && health.missingFields.length > 0 && (
        <div
          role="region"
          aria-label="Missing fields notice"
          data-testid="health-missing-fields-notice"
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'var(--priority-high-bg)',
            color: 'var(--priority-high-text)',
            border: '1px solid var(--priority-high-border)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
            Incomplete Financial Profile: The following required data fields are missing
          </div>
          <ul
            data-testid="health-missing-fields-list"
            style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', fontSize: '0.8125rem' }}
          >
            {health.missingFields.map((field) => (
              <li key={field} data-testid={`missing-field-${field}`}>
                <code>{field}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Breakdown Pillars */}
      <div>
        <h3
          style={{
            fontSize: '0.9375rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '1rem',
          }}
        >
          Score Breakdown by Category (Max 20 pts each)
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {BREAKDOWN_COMPONENTS.map((comp) => {
            const rawVal = health.breakdown ? health.breakdown[comp.key] : null;
            const scoreLabel = formatComponentScore(rawVal, comp.max);
            const percentage = rawVal !== null ? Math.min(100, Math.max(0, (rawVal / comp.max) * 100)) : 0;

            return (
              <div
                key={comp.key}
                data-testid={comp.testId}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.375rem',
                  padding: '0.75rem',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {comp.label}
                  </span>
                  <span
                    data-testid={`${comp.testId}-score`}
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      color: rawVal !== null ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                  >
                    {scoreLabel}
                  </span>
                </div>

                {/* Accessible Visual Progress Bar */}
                {rawVal !== null ? (
                  <div
                    role="progressbar"
                    aria-valuenow={rawVal}
                    aria-valuemin={0}
                    aria-valuemax={comp.max}
                    aria-label={`${comp.label} score progress`}
                    style={{
                      height: '6px',
                      width: '100%',
                      backgroundColor: 'var(--border-color)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${percentage}%`,
                        backgroundColor:
                          rawVal >= 16
                            ? 'var(--health-good-text)'
                            : rawVal >= 12
                              ? 'var(--health-mod-text)'
                              : 'var(--health-risk-text)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                ) : (
                  <div
                    aria-label={`${comp.label} score not available due to insufficient data`}
                    style={{
                      height: '6px',
                      width: '100%',
                      backgroundColor: 'var(--border-color)',
                      borderRadius: '3px',
                      opacity: 0.4,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
