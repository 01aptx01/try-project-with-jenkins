'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api, ApiClientError } from '../lib/api-client.js';
import type { FamilyGraphResponse } from '../lib/api-contracts.js';

// In-memory session cache for family graphs: Map<clientId, FamilyGraphResponse>
const familyMemoryCache = new Map<string, FamilyGraphResponse>();

export function clearFamilyGraphCache(): void {
  familyMemoryCache.clear();
}

export interface UseFamilyGraphReturn {
  data: FamilyGraphResponse | null;
  isLoading: boolean;
  errorMessage: string | null;
  isNotFound: boolean;
  hasNoRelatives: boolean;
  refetch: () => Promise<void>;
}

export function useFamilyGraph(clientId: string, enabled = true): UseFamilyGraphReturn {
  const [data, setData] = useState<FamilyGraphResponse | null>(() => {
    if (!enabled) return null;
    return familyMemoryCache.get(clientId) ?? null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (!enabled) return false;
    return !familyMemoryCache.has(clientId);
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);

  // Track active client ID to prevent late responses from overwriting when ID changes
  const activeClientIdRef = useRef(clientId);
  activeClientIdRef.current = clientId;

  const fetchFamily = useCallback(
    async (force = false) => {
      if (!clientId || !enabled) return;

      // Check in-memory cache if not forced
      if (!force && familyMemoryCache.has(clientId)) {
        const cached = familyMemoryCache.get(clientId)!;
        setData(cached);
        setIsLoading(false);
        setErrorMessage(null);
        setIsNotFound(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      setIsNotFound(false);

      try {
        const response = await api.getClientFamily(clientId);

        // Check if client ID is still current
        if (activeClientIdRef.current === clientId) {
          familyMemoryCache.set(clientId, response);
          setData(response);
          setIsLoading(false);
        }
      } catch (err) {
        if (activeClientIdRef.current !== clientId) {
          return;
        }

        if (err instanceof ApiClientError) {
          if (err.status === 404 || err.status === 403) {
            setIsNotFound(true);
            setData(null);
            setIsLoading(false);
            return;
          }
          if (err.status === 401) {
            familyMemoryCache.delete(clientId);
            setData(null);
            setErrorMessage('Authentication required');
            setIsLoading(false);
            return;
          }
        }

        setData(null);
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load family network');
        setIsLoading(false);
      }
    },
    [clientId, enabled]
  );

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const cached = familyMemoryCache.get(clientId);
    if (cached) {
      setData(cached);
      setIsLoading(false);
      setErrorMessage(null);
      setIsNotFound(false);
    } else {
      setData(null);
      void fetchFamily();
    }
  }, [clientId, enabled, fetchFamily]);

  const hasNoRelatives = Boolean(
    data && (data.nodes.filter((n) => n.type === 'RELATED').length === 0 || data.edges.length === 0)
  );

  return {
    data,
    isLoading,
    errorMessage,
    isNotFound,
    hasNoRelatives,
    refetch: () => fetchFamily(true),
  };
}
