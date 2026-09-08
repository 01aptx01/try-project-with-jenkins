import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ClientProfile } from '../components/client-profile.js';
import { api, ApiClientError } from '../lib/api-client.js';
import {
  mockCompleteProfileSnapshot,
  mockIncompleteProfileSnapshot,
} from './fixtures/api.js';
import type { ClientProfileSnapshotResponse } from '../lib/api-contracts.js';

describe('M4-009: Client Profile Snapshot View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads client profile via single snapshot request and displays all core sections without sub-endpoint calls', async () => {
    const getProfileSpy = vi
      .spyOn(api, 'getClientProfile')
      .mockResolvedValue(mockCompleteProfileSnapshot);

    const getFamilySpy = vi.spyOn(api, 'getClientFamily');

    render(<ClientProfile clientId="client-1" />);

    // Shows loading skeleton initially
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Loading client profile'
    );

    // After snapshot loads
    await waitFor(() => {
      expect(screen.getByTestId('profile-display-name')).toHaveTextContent(
        'Somchai Prasert'
      );
      expect(screen.getByTestId('profile-customer-code')).toHaveTextContent('C-001');
      expect(screen.getByTestId('profile-as-of-date')).toHaveTextContent(
        'As of: 2026-09-08'
      );
      expect(screen.getByTestId('profile-summary-text')).toHaveTextContent(
        mockCompleteProfileSnapshot.summary
      );
      expect(screen.getByTestId('profile-nba-action')).toHaveTextContent(
        'Review Emergency Fund'
      );
    });

    // Verify EXACTLY ONE call to getClientProfile
    expect(getProfileSpy).toHaveBeenCalledTimes(1);
    expect(getProfileSpy).toHaveBeenCalledWith(
      'client-1',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    // Verify Family API is NEVER called during Profile view load
    expect(getFamilySpy).not.toHaveBeenCalled();
  });

  it('gracefully renders incomplete profile with null financialProfile and primaryGoal', async () => {
    vi.spyOn(api, 'getClientProfile').mockResolvedValue(
      mockIncompleteProfileSnapshot
    );

    render(<ClientProfile clientId="client-2" />);

    await waitFor(() => {
      expect(screen.getByTestId('profile-display-name')).toHaveTextContent(
        'Wandee Prasert'
      );
      expect(
        screen.getByTestId('profile-incomplete-financial')
      ).toBeInTheDocument();
      // Health is safe null
      expect(screen.getByText(/Health: Not available/i)).toBeInTheDocument();
      expect(screen.queryByText(/Health: 0/i)).not.toBeInTheDocument();
    });
  });

  it('displays unified Client Not Found for both 404 missing and 403 unowned clients (BR-09)', async () => {
    // 1. Missing client (404)
    vi.spyOn(api, 'getClientProfile').mockRejectedValueOnce(
      new ApiClientError({
        status: 404,
        code: 'NOT_FOUND',
        message: 'Client not found',
      })
    );

    const { rerender } = render(<ClientProfile clientId="missing-id" />);

    await waitFor(() => {
      expect(screen.getByTestId('client-not-found')).toHaveTextContent(
        /the requested client record does not exist or you do not have permission to view it/i
      );
    });

    // 2. Unowned client (403 forbidden) -> renders identical not found message
    vi.spyOn(api, 'getClientProfile').mockRejectedValueOnce(
      new ApiClientError({
        status: 403,
        code: 'FORBIDDEN',
        message: 'Access denied',
      })
    );

    rerender(<ClientProfile clientId="unowned-id" />);

    await waitFor(() => {
      expect(screen.getByTestId('client-not-found')).toHaveTextContent(
        /the requested client record does not exist or you do not have permission to view it/i
      );
    });
  });

  it('clears previous profile immediately when switching client ID and rejects late responses', async () => {
    let resolveFirst: (val: ClientProfileSnapshotResponse) => void;
    const firstPromise = new Promise<ClientProfileSnapshotResponse>((resolve) => {
      resolveFirst = resolve;
    });

    const getProfileSpy = vi
      .spyOn(api, 'getClientProfile')
      .mockImplementationOnce(() => firstPromise)
      .mockResolvedValueOnce(mockIncompleteProfileSnapshot);

    const { rerender } = render(<ClientProfile clientId="client-A" />);

    expect(getProfileSpy).toHaveBeenCalledTimes(1);

    // Switch to client-B while client-A is still pending
    rerender(<ClientProfile clientId="client-B" />);

    expect(getProfileSpy).toHaveBeenCalledTimes(2);

    // Client B resolves immediately
    await waitFor(() => {
      expect(screen.getByTestId('profile-display-name')).toHaveTextContent(
        'Wandee Prasert'
      );
    });

    // Late response from Client A resolves
    await React.act(async () => {
      resolveFirst!(mockCompleteProfileSnapshot);
      await new Promise((r) => setTimeout(r, 50));
    });

    // Make sure Client B is still shown and Client A was dropped
    expect(screen.getByTestId('profile-display-name')).toHaveTextContent(
      'Wandee Prasert'
    );
    expect(screen.queryByText('Somchai Prasert')).not.toBeInTheDocument();
  });
});
