'use client';

import React from 'react';
import type { RecommendationResult } from '../lib/api-contracts.js';
import { PriorityBadge } from './ui/badges.js';

export interface RecommendationCardProps {
  recommendation: RecommendationResult;
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  return (
    <section
      aria-labelledby="nba-card-heading"
      data-testid="recommendation-card"
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
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h2
            id="nba-card-heading"
            style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}
          >
            Next Best Action
          </h2>
          <span
            data-testid="nba-rule-id"
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '0.2rem 0.5rem',
              backgroundColor: 'var(--bg-muted)',
              color: 'var(--text-secondary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
            }}
          >
            {recommendation.rule}
          </span>
        </div>

        <PriorityBadge priority={recommendation.priority} />
      </div>

      <div>
        <div
          data-testid="profile-nba-action"
          style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}
        >
          {recommendation.action}
        </div>
        <p
          data-testid="profile-nba-reason"
          style={{
            marginTop: '0.375rem',
            fontSize: '0.875rem',
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
          }}
        >
          {recommendation.reason}
        </p>
      </div>
    </section>
  );
}
