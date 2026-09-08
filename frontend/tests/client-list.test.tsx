import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClientListView } from '../components/client-list-view.js';
import { api, ApiClientError } from '../lib/api-client.js';
import {
  mockClientListResponse,
  mockCompleteClientCard,
  mockIncompleteClientCard,
} from './fixtures/api.js';

describe('ClientListView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading status on initial mount and then displays clients', async () => {
    const getClientsSpy = vi
      .spyOn(api, 'getClients')
      .mockResolvedValue(mockClientListResponse);

    render(<ClientListView />);

    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Loading client directory'
    );

    await waitFor(() => {
      expect(screen.getByText('Somchai Prasert')).toBeInTheDocument();
      expect(screen.getByText('Wandee Prasert')).toBeInTheDocument();
      expect(screen.getByTestId('client-total-count')).toHaveTextContent(
        'Total Clients: 2'
      );
    });

    expect(getClientsSpy).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('displays accurate badges and handles incomplete health without showing 0', async () => {
    vi.spyOn(api, 'getClients').mockResolvedValue({
      items: [mockCompleteClientCard, mockIncompleteClientCard],
      page: 1,
      pageSize: 20,
      total: 2,
    });

    render(<ClientListView />);

    await waitFor(() => {
      // Complete client
      expect(
        screen.getByText(/Health: 68\/100 \(MODERATE\)/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Risk: HIGH/i)).toBeInTheDocument();

      // Incomplete client (must NOT show 0 or false health score)
      expect(screen.getByText(/Health: Not available/i)).toBeInTheDocument();
      expect(screen.getByText(/Risk: LOW/i)).toBeInTheDocument();
    });

    // Ensure 0 is not rendered as a fake health score
    expect(screen.queryByText(/Health: 0/i)).not.toBeInTheDocument();
  });

  it('renders empty state when client list is empty', async () => {
    vi.spyOn(api, 'getClients').mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });

    render(<ClientListView />);

    await waitFor(() => {
      expect(screen.getByText(/no clients found/i)).toBeInTheDocument();
    });
  });

  it('displays error message and supports retry on 503 dependency unavailable', async () => {
    const getClientsSpy = vi
      .spyOn(api, 'getClients')
      .mockRejectedValueOnce(
        new ApiClientError({
          status: 503,
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'Database unavailable',
        })
      )
      .mockResolvedValueOnce(mockClientListResponse);

    render(<ClientListView />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/database service is temporarily unavailable/i);

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Somchai Prasert')).toBeInTheDocument();
    });

    expect(getClientsSpy).toHaveBeenCalledTimes(2);
  });

  it('links correctly to client profile snapshot view', async () => {
    vi.spyOn(api, 'getClients').mockResolvedValue(mockClientListResponse);

    render(<ClientListView />);

    await waitFor(() => {
      const nameLink = screen.getByRole('link', { name: 'Somchai Prasert' });
      expect(nameLink).toHaveAttribute(
        'href',
        `/clients/${mockCompleteClientCard.id}`
      );
    });
  });
});
