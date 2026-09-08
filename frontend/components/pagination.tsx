'use client';

import React from 'react';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  isLoading?: boolean | undefined;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isPreviousDisabled = page <= 1 || isLoading;
  const isNextDisabled = page >= totalPages || isLoading;

  const fromItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toItem = Math.min(page * pageSize, total);

  return (
    <nav
      role="navigation"
      aria-label="Pagination controls"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.875rem 1rem',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        gap: '1rem',
      }}
    >
      {/* Range and Total Info */}
      <div
        data-testid="pagination-info"
        style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}
      >
        {total === 0 ? (
          'No clients to display'
        ) : (
          <span>
            Showing <strong>{fromItem}–{toItem}</strong> of{' '}
            <strong>{total}</strong> clients (Page <strong>{page}</strong> of{' '}
            <strong>{totalPages}</strong>)
          </span>
        )}
      </div>

      {/* Page controls & Page size selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Page Size Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label
            htmlFor="client-page-size-select"
            style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}
          >
            Per page:
          </label>
          <select
            id="client-page-size-select"
            aria-label="Clients per page"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            disabled={isLoading}
            style={{
              padding: '0.375rem 0.5rem',
              fontSize: '0.875rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        {/* Previous & Next Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            id="pagination-prev-btn"
            aria-label="Go to previous page"
            disabled={isPreviousDisabled}
            onClick={() => onPageChange(page - 1)}
            style={{
              padding: '0.375rem 0.75rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              backgroundColor: isPreviousDisabled
                ? 'var(--bg-muted)'
                : 'var(--bg-card)',
              color: isPreviousDisabled
                ? 'var(--text-muted)'
                : 'var(--text-primary)',
              cursor: isPreviousDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            Previous
          </button>
          <button
            type="button"
            id="pagination-next-btn"
            aria-label="Go to next page"
            disabled={isNextDisabled}
            onClick={() => onPageChange(page + 1)}
            style={{
              padding: '0.375rem 0.75rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              backgroundColor: isNextDisabled
                ? 'var(--bg-muted)'
                : 'var(--bg-card)',
              color: isNextDisabled
                ? 'var(--text-muted)'
                : 'var(--text-primary)',
              cursor: isNextDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            Next
          </button>
        </div>
      </div>
    </nav>
  );
}
