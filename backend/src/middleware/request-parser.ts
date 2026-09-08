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
    const contentLength = request.headers["content-length"];
    const transferEncoding = request.headers["transfer-encoding"];
    const isChunked =
      typeof transferEncoding === "string" &&
      transferEncoding.toLowerCase().includes("chunked");
    const hasBody =
      (contentLength !== undefined && contentLength !== "0") || isChunked;

    // For mutation routes with body or Content-Type header, require strict JSON MIME type
    if (hasBody || contentType !== undefined) {
      if (!contentType) {
        return next(
          new UnsupportedMediaTypeError("Content-Type header is required for request body")
        );
      }

      // Express request.is checks full MIME type and parameters (e.g. application/json; charset=utf-8)
      // Strictly rejects lookalike types such as text/application/json or application/jsonp
      const isJson = Boolean(
        request.is("application/json") || request.is("application/*+json")
      );
      if (!isJson) {
        return next(
          new UnsupportedMediaTypeError("Content-Type must be application/json")
        );
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
