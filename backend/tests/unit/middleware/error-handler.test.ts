import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { Prisma } from "@prisma/client";
import { BadRequestError, ForbiddenError, UnauthorizedError } from "../../../src/errors.js";

describe("HTTP Middleware, Parsing, and Error Handling", () => {
  const dummyDependencies = {
    readiness: { check: async () => undefined },
    version: "test-version",
  };

  it("sets Cache-Control: no-store on all responses", async () => {
    const app = createApp(dummyDependencies);
    const response = await request(app).get("/health");
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("returns 404 with standard error envelope for unknown routes", async () => {
    const app = createApp(dummyDependencies);
    const response = await request(app).get("/non-existent-route");
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        requestId: expect.any(String),
      },
    });
  });

  it("returns 400 for malformed JSON payloads", async () => {
    const app = createApp({
      ...dummyDependencies,
      configureRoutes: (a) => {
        a.post("/test-endpoint", (_req, res) => res.status(200).json({ ok: true }));
      },
    });

    const response = await request(app)
      .post("/test-endpoint")
      .set("Content-Type", "application/json")
      .send("{ invalid json: broken ");

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "BAD_REQUEST",
        message: "Malformed JSON payload",
        requestId: expect.any(String),
      },
    });
  });

  it("returns 413 when JSON payload exceeds 16 KiB limit", async () => {
    const app = createApp({
      ...dummyDependencies,
      configureRoutes: (a) => {
        a.post("/test-endpoint", (_req, res) => res.status(200).json({ ok: true }));
      },
    });

    // Generate a payload slightly larger than 16 KiB (17 KiB)
    const largePayload = { data: "x".repeat(17 * 1024) };

    const response = await request(app)
      .post("/test-endpoint")
      .set("Content-Type", "application/json")
      .send(largePayload);

    expect(response.status).toBe(413);
    expect(response.body).toMatchObject({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Payload exceeds maximum allowed size of 16 KiB",
        requestId: expect.any(String),
      },
    });
  });

  it("returns 415 when a POST request with body uses non-JSON Content-Type", async () => {
    const app = createApp({
      ...dummyDependencies,
      configureRoutes: (a) => {
        a.post("/test-endpoint", (_req, res) => res.status(200).json({ ok: true }));
      },
    });

    const response = await request(app)
      .post("/test-endpoint")
      .set("Content-Type", "text/plain")
      .send("raw text body");

    expect(response.status).toBe(415);
    expect(response.body).toMatchObject({
      error: {
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "Content-Type must be application/json",
        requestId: expect.any(String),
      },
    });
  });

  it("handles known ApiError instances with custom status and codes", async () => {
    const app = createApp({
      ...dummyDependencies,
      configureRoutes: (a) => {
        a.get("/bad-req", () => {
          throw new BadRequestError("Validation failed", { field: "email" });
        });
        a.get("/unauth", () => {
          throw new UnauthorizedError("Session expired");
        });
        a.get("/forbid", () => {
          throw new ForbiddenError("Origin mismatch");
        });
      },
    });

    const res1 = await request(app).get("/bad-req");
    expect(res1.status).toBe(400);
    expect(res1.body.error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Validation failed",
      details: { field: "email" },
    });

    const res2 = await request(app).get("/unauth");
    expect(res2.status).toBe(401);
    expect(res2.body.error).toMatchObject({
      code: "UNAUTHORIZED",
      message: "Session expired",
    });

    const res3 = await request(app).get("/forbid");
    expect(res3.status).toBe(403);
    expect(res3.body.error).toMatchObject({
      code: "FORBIDDEN",
      message: "Origin mismatch",
    });
  });

  it("returns 503 when Prisma connection or timeout error occurs", async () => {
    const app = createApp({
      ...dummyDependencies,
      configureRoutes: (a) => {
        a.get("/prisma-conn-fail", () => {
          throw new Prisma.PrismaClientInitializationError("Cannot connect to database", "6.0.0");
        });
        a.get("/prisma-timeout-fail", () => {
          throw new Prisma.PrismaClientKnownRequestError("Timed out", {
            code: "P1001",
            clientVersion: "6.0.0",
          });
        });
      },
    });

    const res1 = await request(app).get("/prisma-conn-fail");
    expect(res1.status).toBe(503);
    expect(res1.body.error).toMatchObject({ code: "DEPENDENCY_UNAVAILABLE" });

    const res2 = await request(app).get("/prisma-timeout-fail");
    expect(res2.status).toBe(503);
    expect(res2.body.error).toMatchObject({ code: "DEPENDENCY_UNAVAILABLE" });
  });

  it("returns 500 without leaking stack traces or credentials on unexpected errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = createApp({
      ...dummyDependencies,
      configureRoutes: (a) => {
        a.get("/crash", () => {
          throw new Error("Secret credential DB_PASS=secret123 failed in query");
        });
      },
    });

    const response = await request(app).get("/crash");
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        requestId: expect.any(String),
      },
    });

    // Verify response body does not leak secret
    expect(JSON.stringify(response.body)).not.toContain("secret123");

    // Verify console.error logs safe error code and name, not password
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("500 INTERNAL_ERROR:"),
      "Error"
    );

    consoleSpy.mockRestore();
  });
});
