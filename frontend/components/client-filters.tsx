'use client';

import React, { useState, useEffect } from 'react';
import type { PriorityLevel, HealthFilter } from '../lib/api-contracts.js';

export interface ClientFiltersProps {
  search?: string | undefined;
  priority?: PriorityLevel | '' | undefined;
  health?: HealthFilter | '' | undefined;
  onApplyFilters: (filters: {
    search?: string | undefined;
    priority?: PriorityLevel | undefined;
    health?: HealthFilter | undefined;
  }) => void;
  onReset: () => void;
  isLoading?: boolean | undefined;
}

export function ClientFilters({
  search: controlledSearch = '',
  priority: controlledPriority = '',
  health: controlledHealth = '',
  onApplyFilters,
  onReset,
  isLoading = false,
}: ClientFiltersProps) {
  const [searchInput, setSearchInput] = useState(controlledSearch);
  const [selectedPriority, setSelectedPriority] = useState<PriorityLevel | ''>(
    controlledPriority
  );
  const [selectedHealth, setSelectedHealth] = useState<HealthFilter | ''>(
    controlledHealth
  );

  // Sync internal form state when incoming controlled props change (e.g. on URL navigation / reset)
  useEffect(() => {
    setSearchInput(controlledSearch);
  }, [controlledSearch]);

  useEffect(() => {
    setSelectedPriority(controlledPriority);
  }, [controlledPriority]);

  useEffect(() => {
    setSelectedHealth(controlledHealth);
  }, [controlledHealth]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApplyFilters({
      search: searchInput.trim() || undefined,
      priority: selectedPriority || undefined,
      health: selectedHealth || undefined,
    });
  };

  const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPriority = e.target.value as PriorityLevel | '';
    setSelectedPriority(newPriority);
    onApplyFilters({
      search: searchInput.trim() || undefined,
      priority: newPriority || undefined,
      health: selectedHealth || undefined,
    });
  };

  const handleHealthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newHealth = e.target.value as HealthFilter | '';
    setSelectedHealth(newHealth);
    onApplyFilters({
      search: searchInput.trim() || undefined,
      priority: selectedPriority || undefined,
      health: newHealth || undefined,
    });
  };

  const handleResetClick = () => {
    setSearchInput('');
    setSelectedPriority('');
    setSelectedHealth('');
    onReset();
  };

  const hasActiveFilters = Boolean(
    controlledSearch.trim() || controlledPriority || controlledHealth
  );

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="Client search and filter controls"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        alignItems: 'center',
        padding: '1rem',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Search Input */}
      <div style={{ display: 'flex', flex: '1 1 240px', gap: '0.5rem' }}>
        <input
          type="text"
          id="client-search-input"
          name="search"
          aria-label="Search by client name or code"
          placeholder="Search name or code..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '0.5rem 0.75rem',
            fontSize: '0.875rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          type="submit"
          id="client-search-submit"
          disabled={isLoading}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            backgroundColor: 'var(--primary)',
            color: 'var(--primary-contrast)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          Search
        </button>
      </div>

      {/* Priority Dropdown */}
      <div style={{ flex: '0 1 170px' }}>
        <select
          id="client-priority-filter"
          name="priority"
          aria-label="Filter by priority"
          value={selectedPriority}
          onChange={handlePriorityChange}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem',
            fontSize: '0.875rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          <option value="">All Priorities</option>
          <option value="HIGH">High Priority</option>
          <option value="MEDIUM">Medium Priority</option>
          <option value="LOW">Low Priority</option>
        </select>
      </div>

      {/* Health Dropdown */}
      <div style={{ flex: '0 1 190px' }}>
        <select
          id="client-health-filter"
          name="health"
          aria-label="Filter by health status"
          value={selectedHealth}
          onChange={handleHealthChange}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem',
            fontSize: '0.875rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          <option value="">All Health Statuses</option>
          <option value="GOOD">Good</option>
          <option value="MODERATE">Moderate</option>
          <option value="AT_RISK">At Risk</option>
          <option value="INSUFFICIENT_DATA">Insufficient Data</option>
        </select>
      </div>

      {/* Reset Button */}
      {hasActiveFilters && (
        <button
          type="button"
          id="client-filters-reset"
          onClick={handleResetClick}
          disabled={isLoading}
          style={{
            padding: '0.5rem 0.875rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            backgroundColor: 'transparent',
            color: 'var(--text-muted)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          Reset Filters
        </button>
      )}
    </form>
  );
}
