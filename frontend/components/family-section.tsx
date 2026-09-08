'use client';

import React, { useState } from 'react';
import { useFamilyGraph } from '../hooks/use-family-graph.js';
import { FamilyGraph } from './family-graph.js';

export interface FamilySectionProps {
  clientId: string;
  defaultExpanded?: boolean;
}

export function FamilySection({ clientId, defaultExpanded = false }: FamilySectionProps) {
  const [isOpen, setIsOpen] = useState<boolean>(defaultExpanded);
  const { data, isLoading, errorMessage, isNotFound, hasNoRelatives, refetch } = useFamilyGraph(
    clientId,
    isOpen
  );

  return (
    <section
      aria-labelledby="family-network-heading"
      data-testid="family-section"
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
        <div>
          <h2
            id="family-network-heading"
            style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}
          >
            Family Network (1-Hop)
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Immediate direct relationships within your authorized coverage.
          </p>
        </div>

        <button
          type="button"
          data-testid="toggle-family-btn"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((prev) => !prev)}
          style={{
            padding: '0.4rem 0.875rem',
            backgroundColor: isOpen ? 'var(--bg-muted)' : 'var(--primary)',
            color: isOpen ? 'var(--text-primary)' : 'var(--primary-contrast)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {isOpen ? 'Collapse Family Network' : 'View Family Network'}
        </button>
      </div>

      {isOpen && (
        <div data-testid="family-content" style={{ marginTop: '0.5rem' }}>
          {/* Loading state */}
          {isLoading && (
            <div
              role="status"
              aria-label="Loading family network"
              data-testid="family-loading"
              style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontStyle: 'italic',
              }}
            >
              Loading family connections...
            </div>
          )}

          {/* Not Found */}
          {isNotFound && !isLoading && (
            <div
              role="alert"
              data-testid="family-not-found"
              style={{
                padding: '1.5rem',
                textAlign: 'center',
                backgroundColor: 'var(--bg-muted)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-secondary)',
              }}
            >
              Client or family network not accessible.
            </div>
          )}

          {/* Error Alert with Retry */}
          {errorMessage && !isLoading && !isNotFound && (
            <div
              role="alert"
              data-testid="family-error"
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
                data-testid="family-retry-btn"
                onClick={() => void refetch()}
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

          {/* Primary-only / No visible relatives */}
          {hasNoRelatives && !isLoading && !errorMessage && !isNotFound && (
            <div
              data-testid="no-relatives-notice"
              style={{
                padding: '1.5rem',
                textAlign: 'center',
                backgroundColor: 'var(--bg-muted)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                fontSize: '0.875rem',
              }}
            >
              <strong>Primary Client Only:</strong> No immediate family relationships on record
              under your relationship management coverage.
            </div>
          )}

          {/* Active Family Network Graph & Accessible List */}
          {data && !hasNoRelatives && !isLoading && !errorMessage && (
            <div data-testid="family-relationships-container">
              <FamilyGraph data={data} primaryClientId={clientId} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
