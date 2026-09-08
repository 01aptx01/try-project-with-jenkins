'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api, ApiClientError } from '../lib/api-client.js';
import type { ClientProfileSnapshotResponse } from '../lib/api-contracts.js';

export interface UseClientProfileResult {
  data: ClientProfileSnapshotResponse | null;
  isLoading: boolean;
  errorMessage: string | null;
  isNotFound: boolean;
  refetch: () => void;
}

export function useClientProfile(clientId: string): UseClientProfileResult {
  const [data, setData] = useState<ClientProfileSnapshotResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);

  const activeControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const fetchProfile = useCallback(async () => {
    // Abort previous in-flight fetch immediately
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }

    // Immediately clear previous client data to avoid showing Client A during Client B fetch
    setData(null);
    setErrorMessage(null);
    setIsNotFound(false);

    if (!clientId || clientId.trim() === '') {
      setIsNotFound(true);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    activeControllerRef.current = controller;
    const currentRequestId = ++requestIdRef.current;

    setIsLoading(true);

    try {
      // Exactly ONE snapshot request to /api/clients/:id
      const result = await api.getClientProfile(clientId, {
        signal: controller.signal,
      });

      if (currentRequestId === requestIdRef.current) {
        setData(result);
      }
    } catch (error: unknown) {
      if (currentRequestId !== requestIdRef.current) {
        return; // Ignore obsolete request response
      }

      if (error instanceof ApiClientError) {
        if (error.isAbort) return;

        // Privacy & Security (BR-09): 404 or 403 (missing / not owned) treated as Client not found
        if (error.status === 404 || error.status === 403) {
          setIsNotFound(true);
        } else if (error.status === 503) {
          setErrorMessage('Database service is temporarily unavailable. Please try again.');
        } else if (error.isNetworkError) {
          setErrorMessage('Unable to connect to the server. Please check your connection.');
        } else {
          setErrorMessage(error.message || 'Failed to load client profile.');
        }
      } else {
        setErrorMessage('An unexpected error occurred while loading client profile.');
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [clientId]);

  useEffect(() => {
    fetchProfile();

    return () => {
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
      }
    };
  }, [fetchProfile]);

  return {
    data,
    isLoading,
    errorMessage,
    isNotFound,
    refetch: fetchProfile,
  };
}
