import { Prisma } from "@prisma/client";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class BadRequestError extends ApiError {
  constructor(message = "Bad request", details?: unknown) {
    super(400, "BAD_REQUEST", message, details);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized") {
    super(401, "UNAUTHORIZED", message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden") {
    super(403, "FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Resource not found") {
    super(404, "NOT_FOUND", message);
    this.name = "NotFoundError";
  }
}

export class PayloadTooLargeError extends ApiError {
  constructor(message = "Payload exceeds maximum allowed size of 16 KiB") {
    super(413, "PAYLOAD_TOO_LARGE", message);
    this.name = "PayloadTooLargeError";
  }
}

export class UnsupportedMediaTypeError extends ApiError {
  constructor(message = "Content-Type must be application/json") {
    super(415, "UNSUPPORTED_MEDIA_TYPE", message);
    this.name = "UnsupportedMediaTypeError";
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(message = "Too many requests, please try again later") {
    super(429, "TOO_MANY_REQUESTS", message);
    this.name = "TooManyRequestsError";
  }
}

export class DependencyUnavailableError extends ApiError {
  constructor(message = "A required dependency is unavailable") {
    super(503, "DEPENDENCY_UNAVAILABLE", message);
    this.name = "DependencyUnavailableError";
  }
}

/**
 * Checks if an unknown error is a Prisma network/connection/timeout dependency failure.
 * Distinguishes dependency unavailability (503) from programming bugs (500)
 * such as missing tables, schema mismatches, or invalid queries.
 */
export function isPrismaDependencyError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientRustPanicError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P1xxx codes in Prisma indicate connection, host, or timeout failures
    // P2024 indicates connection pool timeout (Timed out fetching a new connection from the pool)
    return error.code.startsWith("P1") || error.code === "P2024";
  }
  return false;
}
