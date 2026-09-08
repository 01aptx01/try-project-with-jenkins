/**
 * Session Lifecycle Manager (M4-015)
 * Coordinates session generations, aborts in-flight requests on session change,
 * broadcasts zero-payload cross-tab logout events, and protects BFCache transitions.
 */

let sessionGeneration = 0;
const inFlightControllers = new Set<AbortController>();

export function getSessionGeneration(): number {
  return sessionGeneration;
}

export function bumpSessionGeneration(): number {
  sessionGeneration += 1;
  abortAllInFlight();
  return sessionGeneration;
}

export function registerInFlightController(controller: AbortController): () => void {
  inFlightControllers.add(controller);
  return () => {
    inFlightControllers.delete(controller);
  };
}

export function abortAllInFlight(): void {
  for (const controller of inFlightControllers) {
    try {
      controller.abort(new Error('Session terminated or switched'));
    } catch {
      // Ignore
    }
  }
  inFlightControllers.clear();
}

export const SESSION_EVENT_KEY = 'meridian:session-sync';

export interface SessionSyncMessage {
  type: 'LOGOUT';
  timestamp: number;
}

/**
 * Broadcasts logout event across browser tabs.
 * STRICT PRIVACY REQUIREMENT: Payload contains only event type and timestamp.
 * Absolutely ZERO client data, usernames, or token strings are sent.
 */
export function broadcastLogout(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const message: SessionSyncMessage = {
        type: 'LOGOUT',
        timestamp: Date.now(),
      };
      window.localStorage.setItem(SESSION_EVENT_KEY, JSON.stringify(message));
    }
  } catch {
    // Graceful fallback if localStorage is disabled
  }
}
