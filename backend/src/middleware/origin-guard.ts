import type { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../errors.js";

/**
 * Creates an Origin protection middleware that enforces exact matching of the Origin header
 * against the configured application origin on all state-changing methods (POST, PUT, PATCH, DELETE).
 *
 * Missing, "null", or mismatched Origin headers are rejected with 403 Forbidden before
 * request credentials are read or rate limits are evaluated.
 */
export function createOriginGuard(appOrigin: string) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const method = request.method.toUpperCase();
    if (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE") {
      const origin = request.headers.origin;

      if (!origin || origin === "null" || origin !== appOrigin) {
        return next(new ForbiddenError("Origin mismatch or missing"));
      }
    }
    next();
  };
}
