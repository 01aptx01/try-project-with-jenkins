import rateLimit, { MemoryStore } from "express-rate-limit";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";

export interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  validate?: boolean | { xForwardedForHeader?: boolean; default?: boolean };
}

/**
 * Creates a rate limiter for login attempts.
 * Uses an isolated MemoryStore per instance so that test suites run in isolation.
 * Defaults to 5 requests per 60 seconds per client IP.
 */
export function createLoginRateLimiter(options: RateLimiterOptions = {}) {
  const windowMs = options.windowMs ?? 60 * 1000;
  const max = options.max ?? 5;

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true, // Draft-6 RateLimit-* headers
    legacyHeaders: true, // X-RateLimit-* and Retry-After headers
    store: new MemoryStore(),
    validate: options.validate ?? { xForwardedForHeader: false },
    handler: (_req: Request, res: Response) => {
      const requestId = (res.locals.requestId as string) || randomUUID();
      res.status(429).json({
        error: {
          code: "TOO_MANY_REQUESTS",
          message: "Too many login attempts, please try again later",
          requestId,
        },
      });
    },
  });
}
