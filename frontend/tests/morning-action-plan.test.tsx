import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MorningActionPlanView } from '../components/morning-action-plan.js';
import { api, ApiClientError } from '../lib/api-client.js';
import {
  mockCompleteClientCard,
  mockIncompleteClientCard,
} from './fixtures/api.js';
import type { MorningActionPlanResponse } from '../lib/api-contracts.js';

const mockPush = vi.fn();
let currentMockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => currentMockSearchParams,
}));

describe('M4-008: Morning Action Plan Dashboard View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMockSearchParams = new URLSearchParams();
  });

  const mockPlanResponse: MorningActionPlanResponse = {
    items: [
      {
        ...mockCompleteClientCard,
        id: 'client-high-1',
        customerCode: 'CUST-0001',
        displayName: 'Adisorn Sukprasert',
        recommendation: {
          action: 'Review Debt Position',
          reason: 'Total debt service exceeds safe liquidity buffer',
          priority: 'HIGH',
          rule: 'BR-04.3',
        },
      },
      {
        ...mockCompleteClientCard,
        id: 'client-med-1',
        customerCode: 'CUST-0002',
        displayName: 'Boonmee Rattana',
        recommendation: {
          action: 'Review Emergency Fund',
          reason: 'Liquid reserves below 3 months mandatory expenses',
          priority: 'MEDIUM',
          rule: 'BR-04.2',
        },
      },
      {
        ...mockIncompleteClientCard,
        id: 'client-low-1',
        customerCode: 'CUST-0003',
        displayName: 'Chaiwat Charoen',
        recommendation: {
          action: 'Review Client Data',
          reason: 'Financial profile incomplete, annual review overdue',
          priority: 'LOW',
          rule: 'BR-04.1',
        },
      },
    ],
    page: 1,
    pageSize: 20,
    total: 3,
    asOfDate: '2026-09-08',
  };

  it('renders loading status and then displays plan items faithfully in response order', async () => {
    const getPlanSpy = vi
      .spyOn(api, 'getMorningActionPlan')
      .mockResolvedValue(mockPlanResponse);

    render(<MorningActionPlanView />);

    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Loading morning action plan'
    );

    await waitFor(() => {
      expect(screen.getByText('Adisorn Sukprasert')).toBeInTheDocument();
      expect(screen.getByText('Boonmee Rattana')).toBeInTheDocument();
      expect(screen.getByText('Chaiwat Charoen')).toBeInTheDocument();
    });

    // Check asOfDate and total count badges
    expect(screen.getByTestId('map-as-of-date')).toHaveTextContent('As of: 2026-09-08');
    expect(screen.getByTestId('map-total-count')).toHaveTextContent('Total Actions: 3');

    // Confirm recommendations and reasons are displayed
    expect(screen.getByText('Review Debt Position')).toBeInTheDocument();
    expect(
      screen.getByText('Total debt service exceeds safe liquidity buffer')
    ).toBeInTheDocument();
    expect(screen.getByText('Review Emergency Fund')).toBeInTheDocument();
    expect(screen.getByText('Review Client Data')).toBeInTheDocument();

    // Verify spy was called with page 1, pageSize 20 and AbortSignal
    expect(getPlanSpy).toHaveBeenCalledWith(
      { page: 1, pageSize: 20 },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    // Ensure incomplete client health handles safely without false 0
    expect(screen.getByText(/Health: Not available/i)).toBeInTheDocument();
    expect(screen.queryByText(/Health: 0/i)).not.toBeInTheDocument();
  });

  it('provides Profile review links that point to /clients/:id', async () => {
    vi.spyOn(api, 'getMorningActionPlan').mockResolvedValue(mockPlanResponse);

    render(<MorningActionPlanView />);

    await waitFor(() => {
      expect(screen.getByText('Adisorn Sukprasert')).toBeInTheDocument();
    });

    const links = screen.getAllByRole('link', { name: /review profile/i });
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute('href', '/clients/client-high-1');
  });

  it('supports pagination controls and URL navigation', async () => {
    const pagedResponse: MorningActionPlanResponse = {
      ...mockPlanResponse,
      page: 1,
      pageSize: 20,
      total: 35,
    };
    vi.spyOn(api, 'getMorningActionPlan').mockResolvedValue(pagedResponse);

    render(<MorningActionPlanView />);

    await waitFor(() => {
      expect(screen.getByText('Adisorn Sukprasert')).toBeInTheDocument();
    });

    const nextBtn = screen.getByRole('button', { name: /go to next page/i });
    expect(nextBtn).toBeEnabled();

    fireEvent.click(nextBtn);
    expect(mockPush).toHaveBeenCalledWith('/dashboard?page=2');
  });

  it('renders empty state when no action items exist', async () => {
    vi.spyOn(api, 'getMorningActionPlan').mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      asOfDate: '2026-09-08',
    });

    render(<MorningActionPlanView />);

    await waitFor(() => {
      expect(screen.getByTestId('map-empty-state')).toHaveTextContent(
        /all client portfolios are currently in order/i
      );
    });
  });

  it('handles error state and supports retry', async () => {
    const getPlanSpy = vi
      .spyOn(api, 'getMorningActionPlan')
      .mockRejectedValueOnce(
        new ApiClientError({
          status: 503,
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'Database temporarily unavailable',
        })
      )
      .mockResolvedValueOnce(mockPlanResponse);

    render(<MorningActionPlanView />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/database service is temporarily unavailable/i);

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Adisorn Sukprasert')).toBeInTheDocument();
    });

    expect(getPlanSpy).toHaveBeenCalledTimes(2);
  });
});
