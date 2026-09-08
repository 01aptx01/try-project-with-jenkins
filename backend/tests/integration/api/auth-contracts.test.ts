import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { SESSION_COOKIE_NAME } from "../../../src/config/cookie.js";
import { SEED_RM_1_ID } from "../../../src/seed/catalogue.js";
import { createTestHarness, type TestHarness } from "../../support/test-harness.js";
import { buildServerApp } from "../../../src/server.js";
import type { Express } from "express";

describe("Session Contracts & Security Boundary (M5-006)", () => {
  let harness: TestHarness;
  let app: Express;
  const appOrigin = "http://localhost:8080";
  const jwtSecret = "xjY5eR1eUVtkUaXjTV4yqAFjhMpt+rDuKUEM3Ucqf/I=";

  beforeAll(async () => {
    harness = await createTestHarness();
    await harness.ensureNormalSeed();

    const built = buildServerApp({
      prismaClient: harness.database,
      configOverrides: {
        APP_ORIGIN: appOrigin,
        JWT_SECRET: jwtSecret,
      },
    });
    app = built.app;
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    }
  });

  describe("Expired & Invalid JWT Token Handling", () => {
    it("rejects expired JWT token with 401 and standard error envelope", async () => {
      // Create a JWT token that expired 1 hour ago
      const expiredPayload = {
        sub: SEED_RM_1_ID,
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600,
      };
      const expiredToken = jwt.sign(expiredPayload, jwtSecret);

      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe("UNAUTHORIZED");
      expect(res.body.error.message).toMatch(/expired|invalid|session/i);
    });

    it("rejects JWT token with invalid signature with 401", async () => {
      const wrongSecret = "wrong_secret_key_min_32_bytes_long_123456789=";
      const forgedToken = jwt.sign(
        { sub: SEED_RM_1_ID, iat: Math.floor(Date.now() / 1000) },
        wrongSecret,
        { expiresIn: "1h" }
      );

      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${forgedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("Origin Protection on State-Changing Requests", () => {
    it("rejects POST /api/auth/login when Origin header is completely missing with 403", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "rm1@meridian.local", password: "Password123!" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("rejects POST /api/auth/login with mismatched Origin with 403", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .set("Origin", "http://unauthorized-origin.attacker.com")
        .send({ email: "rm1@meridian.local", password: "Password123!" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("rejects POST /api/auth/logout with null Origin with 403", async () => {
      const sessionCookie = harness.createRm1SessionCookie();
      const res = await request(app)
        .post("/api/auth/logout")
        .set("Origin", "null")
        .set("Cookie", sessionCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("Rate Limiter 429 & Retry-After Contract", () => {
    it("triggers 429 Too Many Requests with Retry-After header on repeated attempts without lowering limiter max", async () => {
      // Make 5 rapid attempts to consume the default threshold of 5 attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post("/api/auth/login")
          .set("Origin", appOrigin)
          .send({ email: "rm1@meridian.local", password: "WrongPassword!" });
      }

      // 6th attempt must trigger rate limit
      const rateLimitedRes = await request(app)
        .post("/api/auth/login")
        .set("Origin", appOrigin)
        .send({ email: "rm1@meridian.local", password: "WrongPassword!" });

      expect(rateLimitedRes.status).toBe(429);
      expect(rateLimitedRes.body.error.code).toBe("TOO_MANY_REQUESTS");
      expect(rateLimitedRes.headers["retry-after"]).toBeDefined();
      expect(Number(rateLimitedRes.headers["retry-after"])).toBeGreaterThan(0);
    });
  });
});
