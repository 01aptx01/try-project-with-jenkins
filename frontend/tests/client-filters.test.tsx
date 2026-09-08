import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClientListView } from '../components/client-list-view.js';
import { api } from '../lib/api-client.js';
import {
  mockClientListResponse,
  mockCompleteClientCard,
} from './fixtures/api.js';
import type { ClientListResponse } from '../lib/api-contracts.js';
import { normalizeClientQuery, buildClientQueryString } from '../lib/client-query.js';

const mockPush = vi.fn();
let currentMockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/clients',
  useSearchParams: () => currentMockSearchParams,
}));

describe('M4-006: Client Search and Filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMockSearchParams = new URLSearchParams();
  });

  describe('normalizeClientQuery and buildClientQueryString', () => {
    it('normalizes valid query parameters correctly', () => {
      const params = new URLSearchParams('search=Somchai&priority=HIGH&health=GOOD&page=2&pageSize=50');
      const normalized = normalizeClientQuery(params);

      expect(normalized).toEqual({
        search: 'Somchai',
        priority: 'HIGH',
        health: 'GOOD',
        page: 2,
        pageSize: 50,
      });

      expect(buildClientQueryString(normalized)).toBe(
        'search=Somchai&priority=HIGH&health=GOOD&page=2&pageSize=50'
      );
    });

    it('trims whitespace and ignores empty search input', () => {
      const params = new URLSearchParams('search=%20%20%20&page=1');
      const normalized = normalizeClientQuery(params);

      expect(normalized.search).toBeUndefined();
      expect(normalized.page).toBe(1);
      expect(buildClientQueryString(normalized)).toBe('');
    });

    it('sanitizes and drops invalid enums or page numbers', () => {
      const params = new URLSearchParams('priority=INVALID&health=UNKNOWN&page=-5&pageSize=999');
      const normalized = normalizeClientQuery(params);

      expect(normalized.priority).toBeUndefined();
      expect(normalized.health).toBeUndefined();
      expect(normalized.page).toBe(1);
      expect(normalized.pageSize).toBe(20);
    });

    it('supports Thai and English text search strings', () => {
      const params = new URLSearchParams('search=%E0%B8%AA%E0%B8%A1%E0%B8%8A%E0%B8%B2%E0%B8%A2');
      const normalized = normalizeClientQuery(params);

      expect(normalized.search).toBe('สมชาย');
    });
  });

  describe('Client Filters UI & Search Submission', () => {
    it('submits search via Enter key and updates URL with trimmed query', async () => {
      vi.spyOn(api, 'getClients').mockResolvedValue(mockClientListResponse);

      render(<ClientListView />);

      await waitFor(() => {
        expect(screen.getByText('Somchai Prasert')).toBeInTheDocument();
      });

      const searchInput = screen.getByRole('textbox', {
        name: /search by client name or code/i,
      });

      // Type search with surrounding whitespace
      fireEvent.change(searchInput, { target: { value: '  สมชาย  ' } });
      fireEvent.submit(searchInput.closest('form')!);

      expect(mockPush).toHaveBeenCalledWith('/clients?search=%E0%B8%AA%E0%B8%A1%E0%B8%8A%E0%B8%B2%E0%B8%A2');
    });

    it('submits search via Search button click', async () => {
      vi.spyOn(api, 'getClients').mockResolvedValue(mockClientListResponse);

      render(<ClientListView />);

      await waitFor(() => {
        expect(screen.getByText('Somchai Prasert')).toBeInTheDocument();
      });

      const searchInput = screen.getByRole('textbox', {
        name: /search by client name or code/i,
      });
      const submitBtn = screen.getByRole('button', { name: /search/i });

      fireEvent.change(searchInput, { target: { value: 'CUST-001' } });
      fireEvent.click(submitBtn);

      expect(mockPush).toHaveBeenCalledWith('/clients?search=CUST-001');
    });

    it('applies priority and health filters combined and resets page to 1', async () => {
      vi.spyOn(api, 'getClients').mockResolvedValue(mockClientListResponse);

      render(<ClientListView />);

      await waitFor(() => {
        expect(screen.getByText('Somchai Prasert')).toBeInTheDocument();
      });

      const prioritySelect = screen.getByRole('combobox', {
        name: /filter by priority/i,
      });
      const healthSelect = screen.getByRole('combobox', {
        name: /filter by health status/i,
      });

      // Select HIGH priority
      fireEvent.change(prioritySelect, { target: { value: 'HIGH' } });
      expect(mockPush).toHaveBeenCalledWith('/clients?priority=HIGH');

      // Now set current search params to priority=HIGH
      currentMockSearchParams = new URLSearchParams('priority=HIGH');

      // Select AT_RISK health
      fireEvent.change(healthSelect, { target: { value: 'AT_RISK' } });
      expect(mockPush).toHaveBeenCalledWith('/clients?priority=HIGH&health=AT_RISK');
    });

    it('resets all filters when clicking Reset Filters button', async () => {
      currentMockSearchParams = new URLSearchParams('search=Somchai&priority=HIGH&health=MODERATE');
      vi.spyOn(api, 'getClients').mockResolvedValue(mockClientListResponse);

      render(<ClientListView />);

      await waitFor(() => {
        expect(screen.getByText('Somchai Prasert')).toBeInTheDocument();
      });

      const resetBtn = screen.getByRole('button', { name: /reset filters/i });
      expect(resetBtn).toBeInTheDocument();

      fireEvent.click(resetBtn);

      expect(mockPush).toHaveBeenCalledWith('/clients');
    });

    it('renders filtered empty state with clear filters button when no matches exist', async () => {
      currentMockSearchParams = new URLSearchParams('search=NonExistentPerson');
      vi.spyOn(api, 'getClients').mockResolvedValue({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
      });

      render(<ClientListView />);

      await waitFor(() => {
        expect(screen.getByTestId('client-empty-state')).toHaveTextContent(
          /no client records match the selected filter criteria/i
        );
      });

      const clearBtn = screen.getByRole('button', { name: /clear filters/i });
      fireEvent.click(clearBtn);

      expect(mockPush).toHaveBeenCalledWith('/clients');
    });

    it('aborts prior in-flight request and ignores late response to prevent race conditions', async () => {
      let resolveFirst: (val: ClientListResponse) => void;
      const firstPromise = new Promise<ClientListResponse>((resolve) => {
        resolveFirst = resolve;
      });

      const secondResult: ClientListResponse = {
        items: [mockCompleteClientCard],
        page: 1,
        pageSize: 20,
        total: 1,
      };

      const getClientsSpy = vi
        .spyOn(api, 'getClients')
        .mockImplementationOnce(() => firstPromise)
        .mockResolvedValueOnce(secondResult);

      const { rerender } = render(<ClientListView />);

      // First call is pending
      expect(getClientsSpy).toHaveBeenCalledTimes(1);

      // Trigger second query by changing searchParams
      currentMockSearchParams = new URLSearchParams('search=SecondQuery');
      rerender(<ClientListView />);

      // Second call is initiated
      expect(getClientsSpy).toHaveBeenCalledTimes(2);

      // Second call resolves immediately
      await waitFor(() => {
        expect(screen.getByText('Somchai Prasert')).toBeInTheDocument();
        expect(screen.getByTestId('client-total-count')).toHaveTextContent('Total Clients: 1');
      });

      // Now late first call resolves with 2 items
      await React.act(async () => {
        resolveFirst!({
          items: [mockCompleteClientCard, { ...mockCompleteClientCard, id: 'late-id', displayName: 'Late Item' }],
          page: 1,
          pageSize: 20,
          total: 2,
        });
        await new Promise((r) => setTimeout(r, 50));
      });

      // Assert that late response did NOT overwrite second response
      expect(screen.queryByText('Late Item')).not.toBeInTheDocument();
      expect(screen.getByTestId('client-total-count')).toHaveTextContent('Total Clients: 1');
    });
  });
});
