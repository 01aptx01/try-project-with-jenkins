'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api, ApiClientError } from '../lib/api-client.js';
import type { FamilyGraphResponse } from '../lib/api-contracts.js';
import {
  getSessionGeneration,
  registerInFlightController,
} from '../lib/session-lifecycle.js';

// In-memory cache scoped to the current client under active RM session
let currentCachedClientId: string | null = null;
let currentCachedData: FamilyGraphResponse | null = null;

export function clearFamilyGraphCache(): void {
  currentCachedClientId = null;
  currentCachedData = null;
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
    return currentCachedClientId === clientId ? currentCachedData : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (!enabled) return false;
    return currentCachedClientId !== clientId;
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);

  // Track active client ID and request sequence
  const activeClientIdRef = useRef(clientId);
  activeClientIdRef.current = clientId;

  const requestSequenceRef = useRef(0);
  const inFlightControllerRef = useRef<AbortController | null>(null);

  const fetchFamily = useCallback(
    async (force = false) => {
      if (!clientId || !enabled) return;

      // Check current client cache if not forced
      if (!force && currentCachedClientId === clientId && currentCachedData) {
        setData(currentCachedData);
        setIsLoading(false);
        setErrorMessage(null);
        setIsNotFound(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      setIsNotFound(false);

      // Abort previous in-flight request for this hook
      if (inFlightControllerRef.current) {
        inFlightControllerRef.current.abort();
      }

      const controller = new AbortController();
      inFlightControllerRef.current = controller;
      const unregister = registerInFlightController(controller);
      const currentRequestId = ++requestSequenceRef.current;
      const capturedGeneration = getSessionGeneration();

      try {
        const response = await api.getClientFamily(clientId, {
          signal: controller.signal,
        });

        // Guard: only commit if client ID matches, this is latest request, and session unchanged
        if (
          activeClientIdRef.current === clientId &&
          requestSequenceRef.current === currentRequestId &&
          capturedGeneration === getSessionGeneration()
        ) {
          currentCachedClientId = clientId;
          currentCachedData = response;
          setData(response);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (
          activeClientIdRef.current !== clientId ||
          requestSequenceRef.current !== currentRequestId ||
          capturedGeneration !== getSessionGeneration()
        ) {
          return;
        }

        if (err instanceof ApiClientError && err.isAbort) {
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
            clearFamilyGraphCache();
            setData(null);
            setErrorMessage('Authentication required');
            setIsLoading(false);
            return;
          }
        }

        setData(null);
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load family network');
        setIsLoading(false);
      } finally {
        unregister();
        if (inFlightControllerRef.current === controller) {
          inFlightControllerRef.current = null;
        }
      }
    },
    [clientId, enabled]
  );

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    if (currentCachedClientId === clientId && currentCachedData) {
      setData(currentCachedData);
      setIsLoading(false);
      setErrorMessage(null);
      setIsNotFound(false);
    } else {
      setData(null);
      void fetchFamily();
    }

    return () => {
      // Clean up in-flight requests when component unmounts or parameters change
      if (inFlightControllerRef.current) {
        inFlightControllerRef.current.abort();
      }
    };
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
