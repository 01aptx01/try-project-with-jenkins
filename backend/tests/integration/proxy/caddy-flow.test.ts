import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import { createApp } from "../../../src/app.js";
import { SESSION_COOKIE_NAME } from "../../../src/config/cookie.js";
import { resolveTrustProxySetting } from "../../../src/config/proxy.js";
import { AuthController } from "../../../src/controllers/auth.controller.js";
import { ClientController } from "../../../src/controllers/client.controller.js";
import { createAuthGuard } from "../../../src/middleware/auth-guard.js";
import { PrismaClientRepository } from "../../../src/repositories/client.repository.js";
import { PrismaUserRepository } from "../../../src/repositories/user.repository.js";
import { createAuthRouter } from "../../../src/routes/auth.routes.js";
import { createClientRouter } from "../../../src/routes/client.routes.js";
import { AuthService } from "../../../src/services/auth.service.js";
import {
  DEFAULT_DEV_PASSWORD_HASH,
  SEED_RM_1_EMAIL,
  SEED_RM_1_ID,
  SEED_RM_2_ID,
} from "../../../src/seed/catalogue.js";
import { createTestHarness, type TestHarness } from "../../support/test-harness.js";

describe("Caddy Proxy & Local Auth Flow Verification (M3-016)", () => {
  let harness: TestHarness;
  const testAsOfDate = "2026-09-08";
  const defaultProxyOrigin = "http://localhost:8080";

  beforeAll(async () => {
    harness = await createTestHarness();
    await harness.ensureNormalSeed(testAsOfDate);
    await harness.database.user.updateMany({
      where: { id: { in: [SEED_RM_1_ID, SEED_RM_2_ID] } },
      data: { passwordHash: DEFAULT_DEV_PASSWORD_HASH },
    });
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    }
  });

  function createTestAppWithProxy(options: {
    appOrigin?: string;
    trustProxySetting?: string;
    rateLimiterMax?: number;
  }): Express {
    const userRepository = new PrismaUserRepository(harness.database);
    const clientRepository = new PrismaClientRepository(harness.database);

    const authService = new AuthService({
      userRepository,
      jwtSecret: harness.jwtSecret,
    });

    // In local development / test, isProduction is false -> cookie Secure = false
    const authController = new AuthController(authService, false);
    const authGuard = createAuthGuard({
      userRepository,
      jwtSecret: harness.jwtSecret,
    });
    const clientController = new ClientController({
      clientRepository,
      clock: () => testAsOfDate,
    });

    return createApp({
      readiness: { check: async () => {} },
      version: "test-caddy",
      appOrigin: options.appOrigin ?? defaultProxyOrigin,
      trustProxy: resolveTrustProxySetting(options.trustProxySetting ?? "loopback"),
      configureRoutes: (expressApp) => {
        const authRouter = createAuthRouter({
          authController,
          authGuard,
          rateLimiterOptions: {
            windowMs: 60 * 1000,
            max: options.rateLimiterMax ?? 5,
          },
        });
        const clientRouter = createClientRouter({
          clientController,
          authGuard,
        });
        expressApp.use("/api/auth", authRouter);
        expressApp.use("/api/clients", clientRouter);
      },
    });
  }

  it("completes full auth flow through proxy origin (login -> /auth/me -> /clients -> logout)", async () => {
    const app = createTestAppWithProxy({ appOrigin: defaultProxyOrigin });

    // 1. Check /health
    const healthRes = await request(app).get("/health");
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe("ok");

    // 2. Login via proxy origin
    const loginRes = await request(app)
      .post("/api/auth/login")
      .set("Origin", defaultProxyOrigin)
      .set("Content-Type", "application/json")
      .send({
        email: SEED_RM_1_EMAIL,
        password: "Password123!",
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.id).toBe(SEED_RM_1_ID);
    expect(loginRes.body.user.role).toBe("RM");
    // Security: no password hash or token in body
    expect(loginRes.body.token).toBeUndefined();
    expect(loginRes.body.passwordHash).toBeUndefined();

    // Cookie verification: HttpOnly, SameSite=Lax, NOT Secure (local HTTP)
    const cookies = loginRes.headers["set-cookie"] as unknown as string[];
    expect(cookies).toBeDefined();
    const sessionCookie = cookies.find((c: string) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("SameSite=Lax");
    expect(sessionCookie).not.toContain("Secure");

    const cookieHeader = sessionCookie!.split(";")[0]!;

    // 3. Access /api/auth/me with session cookie
    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Cookie", cookieHeader);
    expect(meRes.status).toBe(200);
    expect(meRes.body.id).toBe(SEED_RM_1_ID);

    // 4. Access /api/clients with session cookie
    const clientsRes = await request(app)
      .get("/api/clients")
      .set("Cookie", cookieHeader);
    expect(clientsRes.status).toBe(200);
    expect(clientsRes.body.items).toHaveLength(15);

    // 5. Logout via proxy origin
    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Origin", defaultProxyOrigin)
      .set("Cookie", cookieHeader);
    expect(logoutRes.status).toBe(204);

    const clearedCookies = logoutRes.headers["set-cookie"] as unknown as string[];
    const clearedSessionCookie = clearedCookies.find((c: string) =>
      c.startsWith(`${SESSION_COOKIE_NAME}=`)
    );
    expect(clearedSessionCookie).toBeDefined();
    // Cookie cleared with past expiration / Max-Age=0
    expect(
      clearedSessionCookie!.includes("Max-Age=0") ||
      clearedSessionCookie!.includes("Expires=Thu, 01 Jan 1970")
    ).toBe(true);

    // 6. Access /api/auth/me after logout -> 401 Unauthorized
    const unauthRes = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `${SESSION_COOKIE_NAME}=`);
    expect(unauthRes.status).toBe(401);
  });

  it("supports configurable CADDY_PORT via APP_ORIGIN (e.g. 8081)", async () => {
    const customOrigin = "http://localhost:8081";
    const app = createTestAppWithProxy({ appOrigin: customOrigin });

    // Request with matching custom origin succeeds
    const successRes = await request(app)
      .post("/api/auth/login")
      .set("Origin", customOrigin)
      .set("Content-Type", "application/json")
      .send({
        email: SEED_RM_1_EMAIL,
        password: "Password123!",
      });
    expect(successRes.status).toBe(200);

    // Request with mismatched origin is rejected with 403 Forbidden
    const forbiddenRes = await request(app)
      .post("/api/auth/login")
      .set("Origin", "http://localhost:8080")
      .set("Content-Type", "application/json")
      .send({
        email: SEED_RM_1_EMAIL,
        password: "Password123!",
      });
    expect(forbiddenRes.status).toBe(403);
    expect(forbiddenRes.body.error.code).toBe("FORBIDDEN");
    expect(forbiddenRes.body.error.message).toBe("Origin mismatch or missing");
  });

  it("prevents rate limiter evasion for untrusted direct clients (trust proxy: false)", async () => {
    // App with trustProxy: false (untrusted direct client)
    const app = createTestAppWithProxy({
      appOrigin: defaultProxyOrigin,
      trustProxySetting: "false",
      rateLimiterMax: 3,
    });

    // Attacker tries to bypass rate limit by sending different spoofed X-Forwarded-For headers
    for (let i = 1; i <= 3; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .set("Origin", defaultProxyOrigin)
        .set("Content-Type", "application/json")
        .set("X-Forwarded-For", `198.51.100.${i}`)
        .send({
          email: SEED_RM_1_EMAIL,
          password: "WrongPassword!",
        });
      expect(res.status).toBe(401);
    }

    // 4th request from same socket (even with yet another forged IP) must be blocked by rate limiter
    const blockedRes = await request(app)
      .post("/api/auth/login")
      .set("Origin", defaultProxyOrigin)
      .set("Content-Type", "application/json")
      .set("X-Forwarded-For", "198.51.100.99")
      .send({
        email: SEED_RM_1_EMAIL,
        password: "WrongPassword!",
      });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error.code).toBe("TOO_MANY_REQUESTS");
    expect(blockedRes.body.error.message).toBe(
      "Too many login attempts, please try again later"
    );
  });

  it("handles trusted Caddy proxy hop and prevents upstream spoofing (trust proxy: loopback)", async () => {
    // App behind trusted Caddy proxy (loopback)
    const app = createTestAppWithProxy({
      appOrigin: defaultProxyOrigin,
      trustProxySetting: "loopback",
      rateLimiterMax: 3,
    });

    const clientA = "203.0.113.10";
    const clientB = "203.0.113.20";

    // Client A exhausts attempts
    for (let i = 1; i <= 3; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .set("Origin", defaultProxyOrigin)
        .set("Content-Type", "application/json")
        .set("X-Forwarded-For", clientA)
        .send({
          email: SEED_RM_1_EMAIL,
          password: "WrongPassword!",
        });
      expect(res.status).toBe(401);
    }

    // 4th request from Client A is rate limited
    const blockedRes = await request(app)
      .post("/api/auth/login")
      .set("Origin", defaultProxyOrigin)
      .set("Content-Type", "application/json")
      .set("X-Forwarded-For", clientA)
      .send({
        email: SEED_RM_1_EMAIL,
        password: "WrongPassword!",
      });
    expect(blockedRes.status).toBe(429);

    // Client A attempts to spoof by prepending upstream IPs: "1.2.3.4, 203.0.113.10"
    // Express trusts only the loopback hop and inspects 203.0.113.10 -> still blocked!
    const spoofAttemptRes = await request(app)
      .post("/api/auth/login")
      .set("Origin", defaultProxyOrigin)
      .set("Content-Type", "application/json")
      .set("X-Forwarded-For", `1.2.3.4, ${clientA}`)
      .send({
        email: SEED_RM_1_EMAIL,
        password: "WrongPassword!",
      });
    expect(spoofAttemptRes.status).toBe(429);

    // Meanwhile, Client B (different forwarded IP from trusted Caddy) is NOT blocked
    const clientBRes = await request(app)
      .post("/api/auth/login")
      .set("Origin", defaultProxyOrigin)
      .set("Content-Type", "application/json")
      .set("X-Forwarded-For", clientB)
      .send({
        email: SEED_RM_1_EMAIL,
        password: "WrongPassword!",
      });
    expect(clientBRes.status).toBe(401);
  });

  it("strictly rejects global trust proxy true in configuration", () => {
    expect(() =>
      createTestAppWithProxy({
        appOrigin: defaultProxyOrigin,
        trustProxySetting: "true",
      })
    ).toThrow("Global 'trust proxy: true' is insecure and strictly disallowed");
  });
});
