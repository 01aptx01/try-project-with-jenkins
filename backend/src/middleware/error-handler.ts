import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { ApiError, isPrismaDependencyError } from "../errors.js";

interface BodyParserError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
  body?: unknown;
}

export function errorHandler(
  error: unknown,
  request: Request,
  response: Response,
  _next: NextFunction
) {
  void _next;
  const requestId = (response.locals.requestId as string) || randomUUID();

  // 1. Check for body-parser payload limit (413)
  const bpErr = error as BodyParserError;
  if (bpErr?.type === "entity.too.large" || bpErr?.status === 413 || bpErr?.statusCode === 413) {
    return response.status(413).json({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Payload exceeds maximum allowed size of 16 KiB",
        requestId,
      },
    });
  }

  // 2. Check for malformed JSON syntax errors (400)
  if (error instanceof SyntaxError && (bpErr?.status === 400 || bpErr?.statusCode === 400)) {
    return response.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "Malformed JSON payload",
        requestId,
      },
    });
  }

  // 3. Check for Zod validation schema errors (400)
  if (error instanceof ZodError) {
    return response.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid request payload or schema validation failed",
        requestId,
        details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    });
  }

  // 4. Known domain & API errors
  if (error instanceof ApiError) {
    return response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        requestId,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    });
  }

  // 5. Prisma database connectivity / timeout failures (503)
  if (isPrismaDependencyError(error)) {
    return response.status(503).json({
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "Database dependency is currently unavailable",
        requestId,
      },
    });
  }

  // 6. Unhandled / programming / query / schema errors (500)
  // Safe logging: log request ID, method, route template/path, status, and error code.
  // Never log sensitive credentials, passwords, tokens, or expose raw stack traces to the client.
  const routePath = request.route?.path ? `${request.baseUrl}${request.route.path}` : request.path;
  console.error(`[${requestId}] ${request.method} ${routePath} 500 INTERNAL_ERROR:`, (error as Error)?.name || "UnknownError");

  return response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      requestId,
    },
  });
}
