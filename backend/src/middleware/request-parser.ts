import type { Request, Response, NextFunction } from "express";
import { UnsupportedMediaTypeError } from "../errors.js";

/**
 * Middleware ensuring that mutation requests carrying a body have Content-Type: application/json.
 * Rejects with 415 Unsupported Media Type if a different content-type is provided.
 */
export function requireJsonContentType(request: Request, _response: Response, next: NextFunction) {
  const method = request.method.toUpperCase();
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    const contentType = request.headers["content-type"];
    const hasBody = request.headers["content-length"] !== undefined && request.headers["content-length"] !== "0";

    // For login or mutation routes with body, require application/json
    if (hasBody || contentType !== undefined) {
      if (!contentType || !contentType.toLowerCase().includes("application/json")) {
        return next(new UnsupportedMediaTypeError("Content-Type must be application/json"));
      }
    }
  }
  next();
}

/**
 * Ensures Cache-Control: no-store is set on all API responses
 * to prevent caching of sensitive client, financial, or auth data.
 */
export function noStoreCache(
  _request: Request,
  response: Response,
  next: NextFunction
) {
  response.setHeader("Cache-Control", "no-store");
  next();
}
