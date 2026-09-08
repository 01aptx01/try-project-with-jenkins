import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FamilySection } from '../components/family-section.js';
import { clearFamilyGraphCache } from '../hooks/use-family-graph.js';
import { api, ApiClientError } from '../lib/api-client.js';
import type { FamilyGraphResponse } from '../lib/api-contracts.js';

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('FamilySection (M4-013: Lazy On-Demand Loading & Independent State)', () => {
  const clientId = 'c0000000-0000-0000-0000-000000000001';

  const mockFamilyResponse: FamilyGraphResponse = {
    nodes: [
      { id: clientId, label: 'Somchai Prasert', type: 'PRIMARY' },
      { id: 'c0000000-0000-0000-0000-000000000002', label: 'Suda Prasert', type: 'RELATED' },
      { id: 'c0000000-0000-0000-0000-000000000003', label: 'Kamon Prasert', type: 'RELATED' },
    ],
    edges: [
      {
        id: 'rel-1',
        source: clientId,
        target: 'c0000000-0000-0000-0000-000000000002',
        relationshipType: 'SPOUSE',
      },
      {
        id: 'rel-2',
        source: clientId,
        target: 'c0000000-0000-0000-0000-000000000003',
        relationshipType: 'CHILD',
      },
    ],
  };

  const mockPrimaryOnlyResponse: FamilyGraphResponse = {
    nodes: [{ id: clientId, label: 'Somchai Prasert', type: 'PRIMARY' }],
    edges: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    clearFamilyGraphCache();
  });

  it('does not fetch family network on initial render when defaultExpanded=false (zero preloading)', () => {
    const getClientFamilySpy = vi.spyOn(api, 'getClientFamily').mockResolvedValue(mockFamilyResponse);

    render(<FamilySection clientId={clientId} defaultExpanded={false} />);

    expect(screen.getByTestId('family-section')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-family-btn')).toHaveTextContent('View Family Network');
    expect(screen.queryByTestId('family-content')).toBeNull();

    // Verify 0 requests made
    expect(getClientFamilySpy).not.toHaveBeenCalled();
  });

  it('fetches family network when expanded, renders loading state, then renders relationships', async () => {
    let resolvePromise: (value: FamilyGraphResponse) => void;
    const pendingPromise = new Promise<FamilyGraphResponse>((resolve) => {
      resolvePromise = resolve;
    });

    const getClientFamilySpy = vi.spyOn(api, 'getClientFamily').mockReturnValue(pendingPromise);

    render(<FamilySection clientId={clientId} defaultExpanded={false} />);

    // Click to view family
    fireEvent.click(screen.getByTestId('toggle-family-btn'));

    expect(getClientFamilySpy).toHaveBeenCalledTimes(1);
    expect(getClientFamilySpy).toHaveBeenCalledWith(clientId, expect.anything());

    // Verify loading indicator is visible
    expect(screen.getByTestId('family-loading')).toBeInTheDocument();

    // Resolve network request
    resolvePromise!(mockFamilyResponse);

    await waitFor(() => {
      expect(screen.queryByTestId('family-loading')).toBeNull();
    });

    expect(screen.getByTestId('family-relationships-container')).toBeInTheDocument();
    expect(screen.getByText('Relationship List (2)')).toBeInTheDocument();
    expect(screen.getByTestId('relative-link-c0000000-0000-0000-0000-000000000002')).toHaveTextContent(
      'Suda Prasert'
    );
    expect(screen.getByTestId('relationship-badge-rel-1')).toHaveTextContent('SPOUSE');
    expect(screen.getByTestId('relationship-badge-rel-2')).toHaveTextContent('CHILD');
  });

  it('uses in-memory cache when toggled closed and re-opened within same session', async () => {
    const getClientFamilySpy = vi.spyOn(api, 'getClientFamily').mockResolvedValue(mockFamilyResponse);

    render(<FamilySection clientId={clientId} defaultExpanded={false} />);

    // First open: triggers fetch
    fireEvent.click(screen.getByTestId('toggle-family-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('family-relationships-container')).toBeInTheDocument();
    });
    expect(getClientFamilySpy).toHaveBeenCalledTimes(1);

    // Close
    fireEvent.click(screen.getByTestId('toggle-family-btn'));
    expect(screen.queryByTestId('family-content')).toBeNull();

    // Second open: uses memory cache, 0 new network calls
    fireEvent.click(screen.getByTestId('toggle-family-btn'));
    expect(screen.getByTestId('family-relationships-container')).toBeInTheDocument();
    expect(getClientFamilySpy).toHaveBeenCalledTimes(1);
  });

  it('renders primary-only / no visible relatives notice when client has zero relatives', async () => {
    vi.spyOn(api, 'getClientFamily').mockResolvedValue(mockPrimaryOnlyResponse);

    render(<FamilySection clientId={clientId} defaultExpanded={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('no-relatives-notice')).toBeInTheDocument();
    });

    expect(screen.getByText(/Primary Client Only/i)).toBeInTheDocument();
    expect(screen.queryByTestId('family-member-list')).toBeNull();
  });

  it('renders error banner with Retry button on network failure and allows retry', async () => {
    const getClientFamilySpy = vi
      .spyOn(api, 'getClientFamily')
      .mockRejectedValueOnce(
        new ApiClientError({
          status: 504,
          code: 'GATEWAY_TIMEOUT',
          message: 'Network timeout',
        })
      )
      .mockResolvedValueOnce(mockFamilyResponse);

    render(<FamilySection clientId={clientId} defaultExpanded={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('family-error')).toBeInTheDocument();
    });

    expect(screen.getByText('Network timeout')).toBeInTheDocument();
    expect(screen.getByTestId('family-retry-btn')).toBeInTheDocument();

    // Click Retry
    fireEvent.click(screen.getByTestId('family-retry-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('family-error')).toBeNull();
      expect(screen.getByTestId('family-relationships-container')).toBeInTheDocument();
    });

    expect(getClientFamilySpy).toHaveBeenCalledTimes(2);
  });

  it('handles 404 client not found cleanly without keeping stale family data', async () => {
    vi.spyOn(api, 'getClientFamily').mockRejectedValue(
      new ApiClientError({
        status: 404,
        code: 'NOT_FOUND',
        message: 'Client not found',
      })
    );

    render(<FamilySection clientId="unknown-client-id" defaultExpanded={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('family-not-found')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('family-member-list')).toBeNull();
  });

  it('clears and updates family data when clientId prop changes (route switch)', async () => {
    const otherClientId = 'c0000000-0000-0000-0000-000000000099';
    const otherFamilyResponse: FamilyGraphResponse = {
      nodes: [
        { id: otherClientId, label: 'Wichai Wong', type: 'PRIMARY' },
        { id: 'c0000000-0000-0000-0000-000000000098', label: 'Malee Wong', type: 'RELATED' },
      ],
      edges: [
        {
          id: 'rel-99',
          source: otherClientId,
          target: 'c0000000-0000-0000-0000-000000000098',
          relationshipType: 'SPOUSE',
        },
      ],
    };

    const getClientFamilySpy = vi
      .spyOn(api, 'getClientFamily')
      .mockImplementation(async (id) => {
        if (id === clientId) return mockFamilyResponse;
        if (id === otherClientId) return otherFamilyResponse;
        throw new Error('Unknown ID');
      });

    const { rerender } = render(<FamilySection clientId={clientId} defaultExpanded={true} />);

    await waitFor(() => {
      expect(
        screen.getByTestId('relative-link-c0000000-0000-0000-0000-000000000002')
      ).toHaveTextContent('Suda Prasert');
    });
    expect(getClientFamilySpy).toHaveBeenCalledWith(clientId, expect.anything());

    // Switch client ID
    rerender(<FamilySection clientId={otherClientId} defaultExpanded={true} />);

    await waitFor(() => {
      expect(
        screen.getByTestId('relative-link-c0000000-0000-0000-0000-000000000098')
      ).toHaveTextContent('Malee Wong');
    });

    expect(screen.queryByTestId('relative-link-c0000000-0000-0000-0000-000000000002')).toBeNull();
    expect(getClientFamilySpy).toHaveBeenCalledWith(otherClientId, expect.anything());
  });

  it('aborts in-flight request when component is unmounted (M4-R05)', () => {
    let capturedSignal: AbortSignal | undefined;
    vi.spyOn(api, 'getClientFamily').mockImplementation((_id, options) => {
      capturedSignal = options?.signal;
      return new Promise(() => {}); // never resolves
    });

    const { unmount } = render(<FamilySection clientId={clientId} defaultExpanded={true} />);

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });

  it('rejects delayed response from client B when route switches A -> B -> A (M4-R05)', async () => {
    let resolveB: (value: FamilyGraphResponse) => void;
    const pendingPromiseB = new Promise<FamilyGraphResponse>((resolve) => {
      resolveB = resolve;
    });

    const clientAId = clientId;
    const clientBId = 'c0000000-0000-0000-0000-000000000009';

    const responseB: FamilyGraphResponse = {
      nodes: [
        { id: clientBId, label: 'Client B Primary', type: 'PRIMARY' },
        { id: 'c-b-rel', label: 'Client B Relative', type: 'RELATED' },
      ],
      edges: [
        { id: 'rel-b', source: clientBId, target: 'c-b-rel', relationshipType: 'SIBLING' },
      ],
    };

    vi.spyOn(api, 'getClientFamily').mockImplementation((id) => {
      if (id === clientAId) return Promise.resolve(mockFamilyResponse);
      if (id === clientBId) return pendingPromiseB;
      throw new Error('Unknown ID');
    });

    const { rerender } = render(<FamilySection clientId={clientAId} defaultExpanded={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('relative-link-c0000000-0000-0000-0000-000000000002')).toHaveTextContent(
        'Suda Prasert'
      );
    });

    // Switch to B
    rerender(<FamilySection clientId={clientBId} defaultExpanded={true} />);
    expect(screen.getByTestId('family-loading')).toBeInTheDocument();

    // Switch back to A before B resolves
    rerender(<FamilySection clientId={clientAId} defaultExpanded={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('relative-link-c0000000-0000-0000-0000-000000000002')).toHaveTextContent(
        'Suda Prasert'
      );
    });

    // Now B finally resolves late
    resolveB!(responseB);

    // Verify A is still rendered, not overwritten by B
    expect(screen.getByTestId('relative-link-c0000000-0000-0000-0000-000000000002')).toHaveTextContent(
      'Suda Prasert'
    );
    expect(screen.queryByText('Client B Relative')).toBeNull();
  });

  it('guards against out-of-order retries so only latest retry data is displayed (M4-R05)', async () => {
    let resolveFirstRetry: (value: FamilyGraphResponse) => void;
    let resolveSecondRetry: (value: FamilyGraphResponse) => void;

    const firstPromise = new Promise<FamilyGraphResponse>((resolve) => {
      resolveFirstRetry = resolve;
    });
    const secondPromise = new Promise<FamilyGraphResponse>((resolve) => {
      resolveSecondRetry = resolve;
    });

    const response1: FamilyGraphResponse = {
      nodes: [
        { id: clientId, label: 'Somchai Prasert', type: 'PRIMARY' },
        { id: 'rel-stale', label: 'Stale Relative', type: 'RELATED' },
      ],
      edges: [{ id: 'e1', source: clientId, target: 'rel-stale', relationshipType: 'CHILD' }],
    };

    const response2: FamilyGraphResponse = {
      nodes: [
        { id: clientId, label: 'Somchai Prasert', type: 'PRIMARY' },
        { id: 'rel-fresh', label: 'Fresh Relative', type: 'RELATED' },
      ],
      edges: [{ id: 'e2', source: clientId, target: 'rel-fresh', relationshipType: 'SPOUSE' }],
    };

    let callCount = 0;
    vi.spyOn(api, 'getClientFamily').mockImplementation(() => {
      callCount++;
      if (callCount === 1) return firstPromise;
      if (callCount === 2) return secondPromise;
      return Promise.resolve(mockFamilyResponse);
    });

    render(<FamilySection clientId={clientId} defaultExpanded={true} />);

    // Trigger second call (e.g. user clicks retry)
    fireEvent.click(screen.getByTestId('toggle-family-btn')); // collapse
    fireEvent.click(screen.getByTestId('toggle-family-btn')); // expand again

    // Second retry resolves first
    resolveSecondRetry!(response2);

    await waitFor(() => {
      expect(screen.getByTestId('relative-link-rel-fresh')).toHaveTextContent('Fresh Relative');
    });

    // First retry resolves late
    resolveFirstRetry!(response1);

    // Ensure stale first retry did not overwrite fresh second retry
    expect(screen.getByTestId('relative-link-rel-fresh')).toHaveTextContent('Fresh Relative');
    expect(screen.queryByTestId('relative-link-rel-stale')).toBeNull();
  });

  it('clears cache on unmount so remounting fetches fresh data (AUD-M4-003)', async () => {
    const getClientFamilySpy = vi
      .spyOn(api, 'getClientFamily')
      .mockResolvedValue(mockFamilyResponse);

    const { unmount } = render(<FamilySection clientId={clientId} defaultExpanded={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('family-member-list')).toBeInTheDocument();
    });
    expect(getClientFamilySpy).toHaveBeenCalledTimes(1);

    // Unmount component
    unmount();

    // Remount component for same client ID
    render(<FamilySection clientId={clientId} defaultExpanded={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('family-member-list')).toBeInTheDocument();
    });

    // Must fetch fresh data (call count is 2)
    expect(getClientFamilySpy).toHaveBeenCalledTimes(2);
  });
});
