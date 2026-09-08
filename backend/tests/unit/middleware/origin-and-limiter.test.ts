import request from "supertest";
import { describe, it, expect } from "vitest";
import { createApp } from "../../../src/app.js";
import { createLoginRateLimiter } from "../../../src/middleware/rate-limiter.js";

describe("Origin Protection & Rate Limiting", () => {
  const allowedOrigin = "http://localhost:8080";
  const dummyDependencies = {
    readiness: { check: async () => undefined },
    version: "test-version",
    appOrigin: allowedOrigin,
  };

  describe("Origin Protection", () => {
    it("allows POST request with exact matching Origin", async () => {
      const app = createApp({
        ...dummyDependencies,
        configureRoutes: (a) => {
          a.post("/api/test-origin", (_req, res) => res.status(200).json({ ok: true }));
        },
      });

      const response = await request(app)
        .post("/api/test-origin")
        .set("Origin", allowedOrigin)
        .set("Content-Type", "application/json")
        .send({ test: true });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true });
    });

    it("rejects POST request with missing Origin header with 403", async () => {
      const app = createApp({
        ...dummyDependencies,
        configureRoutes: (a) => {
          a.post("/api/test-origin", (_req, res) => res.status(200).json({ ok: true }));
        },
      });

      const response = await request(app)
        .post("/api/test-origin")
        .set("Content-Type", "application/json")
        .send({ test: true });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        error: {
          code: "FORBIDDEN",
          message: "Origin mismatch or missing",
          requestId: expect.any(String),
        },
      });
    });

    it("rejects POST request with 'null' Origin header with 403", async () => {
      const app = createApp({
        ...dummyDependencies,
        configureRoutes: (a) => {
          a.post("/api/test-origin", (_req, res) => res.status(200).json({ ok: true }));
        },
      });

      const response = await request(app)
        .post("/api/test-origin")
        .set("Origin", "null")
        .set("Content-Type", "application/json")
        .send({ test: true });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects POST request with mismatched Origin header with 403", async () => {
      const app = createApp({
        ...dummyDependencies,
        configureRoutes: (a) => {
          a.post("/api/test-origin", (_req, res) => res.status(200).json({ ok: true }));
        },
      });

      const response = await request(app)
        .post("/api/test-origin")
        .set("Origin", "http://evil-attacker.example.com")
        .set("Content-Type", "application/json")
        .send({ test: true });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatchObject({ code: "FORBIDDEN" });
    });

    it("allows GET request without Origin header", async () => {
      const app = createApp({
        ...dummyDependencies,
        configureRoutes: (a) => {
          a.get("/api/test-get", (_req, res) => res.status(200).json({ ok: true }));
        },
      });

      const response = await request(app).get("/api/test-get");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true });
    });
  });

  describe("Login Rate Limiter", () => {
    it("allows up to 5 login requests and blocks the 6th with 429 and Retry-After", async () => {
      const limiter = createLoginRateLimiter({ windowMs: 60 * 1000, max: 5 });
      const app = createApp({
        ...dummyDependencies,
        configureRoutes: (a) => {
          a.post("/api/auth/login", limiter, (_req, res) => res.status(200).json({ ok: true }));
        },
      });

      // Send 5 requests: all should succeed
      for (let i = 1; i <= 5; i++) {
        const response = await request(app)
          .post("/api/auth/login")
          .set("Origin", allowedOrigin)
          .set("Content-Type", "application/json")
          .send({ email: "rm1@meridian.local", password: "password" });

        expect(response.status).toBe(200);
      }

      // 6th request: must be blocked with 429
      const blockedResponse = await request(app)
        .post("/api/auth/login")
        .set("Origin", allowedOrigin)
        .set("Content-Type", "application/json")
        .send({ email: "rm1@meridian.local", password: "password" });

      expect(blockedResponse.status).toBe(429);
      expect(blockedResponse.headers["retry-after"]).toBeDefined();
      expect(blockedResponse.body).toMatchObject({
        error: {
          code: "TOO_MANY_REQUESTS",
          message: "Too many login attempts, please try again later",
          requestId: expect.any(String),
        },
      });
    });

    it("origin failure blocks before hitting rate limit counter", async () => {
      const limiter = createLoginRateLimiter({ windowMs: 60 * 1000, max: 5 });
      const app = createApp({
        ...dummyDependencies,
        configureRoutes: (a) => {
          a.post("/api/auth/login", limiter, (_req, res) => res.status(200).json({ ok: true }));
        },
      });

      // Send 10 requests with invalid origin -> all should return 403, NOT 429
      for (let i = 0; i < 10; i++) {
        const res = await request(app)
          .post("/api/auth/login")
          .set("Origin", "http://bad.com")
          .send({});
        expect(res.status).toBe(403);
      }
    });

    it("untrusted proxy configuration prevents IP spoofing via X-Forwarded-For", async () => {
      const limiter = createLoginRateLimiter({ windowMs: 60 * 1000, max: 2 });
      // Trust proxy is false by default
      const app = createApp({
        ...dummyDependencies,
        trustProxy: false,
        configureRoutes: (a) => {
          a.post("/api/auth/login", limiter, (_req, res) => res.status(200).json({ ok: true }));
        },
      });

      // Client attempts to spoof IP by altering X-Forwarded-For each request
      const res1 = await request(app)
        .post("/api/auth/login")
        .set("Origin", allowedOrigin)
        .set("X-Forwarded-For", "1.1.1.1")
        .set("Content-Type", "application/json")
        .send({});
      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .post("/api/auth/login")
        .set("Origin", allowedOrigin)
        .set("X-Forwarded-For", "2.2.2.2")
        .set("Content-Type", "application/json")
        .send({});
      expect(res2.status).toBe(200);

      // Third request from same physical client must be blocked, despite changing X-Forwarded-For
      const res3 = await request(app)
        .post("/api/auth/login")
        .set("Origin", allowedOrigin)
        .set("X-Forwarded-For", "3.3.3.3")
        .set("Content-Type", "application/json")
        .send({});
      expect(res3.status).toBe(429);
    });
  });
});
