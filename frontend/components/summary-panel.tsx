'use client';

import React from 'react';

export interface SummaryPanelProps {
  summary: string;
}

export function SummaryPanel({ summary }: SummaryPanelProps) {
  return (
    <section
      aria-labelledby="summary-panel-heading"
      data-testid="summary-panel"
      style={{
        padding: '1.5rem',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <h2
        id="summary-panel-heading"
        style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}
      >
        Executive Portfolio Summary
      </h2>
      <p
        data-testid="profile-summary-text"
        style={{
          marginTop: '0.625rem',
          fontSize: '0.9375rem',
          lineHeight: 1.6,
          color: 'var(--text-secondary)',
        }}
      >
        {summary}
      </p>
    </section>
  );
}
