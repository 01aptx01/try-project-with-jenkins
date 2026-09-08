import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClientListView } from '../components/client-list-view.js';
import { api } from '../lib/api-client.js';
import { mockCompleteClientCard } from './fixtures/api.js';
import type { ClientCard, ClientListResponse } from '../lib/api-contracts.js';

const mockPush = vi.fn();
let currentMockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/clients',
  useSearchParams: () => currentMockSearchParams,
}));

function createClients(count: number, startIdx = 1): ClientCard[] {
  return Array.from({ length: count }, (_, i) => {
    const idx = startIdx + i;
    return {
      ...mockCompleteClientCard,
      id: `client-id-${idx}`,
      customerCode: `CUST-${String(idx).padStart(4, '0')}`,
      displayName: `Client ${idx}`,
      recommendation: {
        ...mockCompleteClientCard.recommendation,
        // Later items have HIGH priority
        priority: idx > 20 ? 'HIGH' : 'LOW',
      },
    };
  });
}

describe('M4-007: Client Pagination & Browser History', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMockSearchParams = new URLSearchParams();
  });

  it('renders pagination controls with correct range and disabled Previous on page 1', async () => {
    const page1Items = createClients(20, 1);
    const mockResponse: ClientListResponse = {
      items: page1Items,
      page: 1,
      pageSize: 20,
      total: 45,
    };

    vi.spyOn(api, 'getClients').mockResolvedValue(mockResponse);

    render(<ClientListView />);

    await waitFor(() => {
      expect(screen.getByText('Client 1')).toBeInTheDocument();
      expect(screen.getByText('Client 20')).toBeInTheDocument();
    });

    // Verify pagination summary
    const info = screen.getByTestId('pagination-info');
    expect(info).toHaveTextContent(/showing 1–20 of 45 clients \(page 1 of 3\)/i);

    // Verify button states
    const prevBtn = screen.getByRole('button', { name: /go to previous page/i });
    const nextBtn = screen.getByRole('button', { name: /go to next page/i });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    // Click Next button
    fireEvent.click(nextBtn);
    expect(mockPush).toHaveBeenCalledWith('/clients?page=2');
  });

  it('preserves server-side pagination without client-side re-sorting', async () => {
    // Page 1 contains LOW priority items (indices 1..20)
    // Server order should be preserved without client placing HIGH on top
    const page1Items = createClients(20, 1);
    vi.spyOn(api, 'getClients').mockResolvedValue({
      items: page1Items,
      page: 1,
      pageSize: 20,
      total: 45,
    });

    render(<ClientListView />);

    await waitFor(() => {
      expect(screen.getByText('Client 1')).toBeInTheDocument();
    });

    // All items on page 1 should have LOW priority badge
    const priorityBadges = screen.getAllByText(/Priority: LOW/i);
    expect(priorityBadges).toHaveLength(20);
    expect(screen.queryByText(/Priority: HIGH/i)).not.toBeInTheDocument();
  });

  it('disables Next button on the last page and allows navigating Previous', async () => {
    currentMockSearchParams = new URLSearchParams('page=3');
    const page3Items = createClients(5, 41);
    const mockResponse: ClientListResponse = {
      items: page3Items,
      page: 3,
      pageSize: 20,
      total: 45,
    };

    vi.spyOn(api, 'getClients').mockResolvedValue(mockResponse);

    render(<ClientListView />);

    await waitFor(() => {
      expect(screen.getByText('Client 41')).toBeInTheDocument();
    });

    const info = screen.getByTestId('pagination-info');
    expect(info).toHaveTextContent(/showing 41–45 of 45 clients \(page 3 of 3\)/i);

    const prevBtn = screen.getByRole('button', { name: /go to previous page/i });
    const nextBtn = screen.getByRole('button', { name: /go to next page/i });

    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).toBeDisabled();

    fireEvent.click(prevBtn);
    expect(mockPush).toHaveBeenCalledWith('/clients?page=2');
  });

  it('updates page size and resets page to 1 when changing pageSize selector', async () => {
    currentMockSearchParams = new URLSearchParams('page=2');
    vi.spyOn(api, 'getClients').mockResolvedValue({
      items: createClients(20, 21),
      page: 2,
      pageSize: 20,
      total: 45,
    });

    render(<ClientListView />);

    await waitFor(() => {
      expect(screen.getByText('Client 21')).toBeInTheDocument();
    });

    const pageSizeSelect = screen.getByRole('combobox', {
      name: /clients per page/i,
    });

    fireEvent.change(pageSizeSelect, { target: { value: '50' } });

    // Expect page reset to 1 and pageSize=50
    expect(mockPush).toHaveBeenCalledWith('/clients?pageSize=50');
  });

  it('handles out-of-range page by showing return button without setting total to zero', async () => {
    currentMockSearchParams = new URLSearchParams('page=99');
    vi.spyOn(api, 'getClients').mockResolvedValue({
      items: [],
      page: 99,
      pageSize: 20,
      total: 45,
    });

    render(<ClientListView />);

    await waitFor(() => {
      expect(screen.getByTestId('client-total-count')).toHaveTextContent('Total Clients: 45');
      expect(screen.getByTestId('client-empty-state')).toHaveTextContent(
        /page 99 has no results\. total 45 clients available across 3 pages\./i
      );
    });

    const backFirstPageBtn = screen.getByRole('button', {
      name: /back to first page/i,
    });
    fireEvent.click(backFirstPageBtn);

    expect(mockPush).toHaveBeenCalledWith('/clients');
  });

  it('preserves existing search and filter queries when navigating pages', async () => {
    currentMockSearchParams = new URLSearchParams('search=Somchai&priority=HIGH&page=1');
    vi.spyOn(api, 'getClients').mockResolvedValue({
      items: createClients(20, 1),
      page: 1,
      pageSize: 20,
      total: 35,
    });

    render(<ClientListView />);

    await waitFor(() => {
      expect(screen.getByText('Client 1')).toBeInTheDocument();
    });

    const nextBtn = screen.getByRole('button', { name: /go to next page/i });
    fireEvent.click(nextBtn);

    expect(mockPush).toHaveBeenCalledWith('/clients?search=Somchai&priority=HIGH&page=2');
  });
});
