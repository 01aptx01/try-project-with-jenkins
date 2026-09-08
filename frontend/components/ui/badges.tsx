import React from 'react';
import type {
  HealthResult,
  PriorityLevel,
} from '../../lib/api-contracts.js';

export function PriorityBadge({ priority }: { priority: PriorityLevel }) {
  let bg = 'var(--priority-low-bg)';
  let text = 'var(--priority-low-text)';
  let border = 'var(--priority-low-border)';

  if (priority === 'HIGH') {
    bg = 'var(--priority-high-bg)';
    text = 'var(--priority-high-text)';
    border = 'var(--priority-high-border)';
  } else if (priority === 'MEDIUM') {
    bg = 'var(--priority-med-bg)';
    text = 'var(--priority-med-text)';
    border = 'var(--priority-med-border)';
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.2rem 0.5rem',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.75rem',
        fontWeight: 600,
        backgroundColor: bg,
        color: text,
        border: `1px solid ${border}`,
        letterSpacing: '0.025em',
      }}
    >
      Priority: {priority}
    </span>
  );
}

export function HealthBadge({ health }: { health: HealthResult }) {
  if (health.status === 'INSUFFICIENT_DATA' || health.score === null) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0.2rem 0.5rem',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.75rem',
          fontWeight: 600,
          backgroundColor: 'var(--bg-muted)',
          color: 'var(--text-muted)',
          border: '1px solid var(--border-color)',
        }}
      >
        Health: Not available
      </span>
    );
  }

  let bg = 'var(--priority-low-bg)';
  let text = 'var(--priority-low-text)';
  let border = 'var(--priority-low-border)';

  if (health.classification === 'AT_RISK') {
    bg = 'var(--priority-high-bg)';
    text = 'var(--priority-high-text)';
    border = 'var(--priority-high-border)';
  } else if (health.classification === 'MODERATE') {
    bg = 'var(--priority-med-bg)';
    text = 'var(--priority-med-text)';
    border = 'var(--priority-med-border)';
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.2rem 0.5rem',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.75rem',
        fontWeight: 600,
        backgroundColor: bg,
        color: text,
        border: `1px solid ${border}`,
      }}
    >
      Health: {health.score}/100 ({health.classification})
    </span>
  );
}

export function RiskBadge({ riskLevel }: { riskLevel: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.2rem 0.5rem',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.75rem',
        fontWeight: 500,
        backgroundColor: 'var(--bg-muted)',
        color: 'var(--text-secondary)',
        border: '1px solid var(--border-color)',
      }}
    >
      Risk: {riskLevel}
    </span>
  );
}
