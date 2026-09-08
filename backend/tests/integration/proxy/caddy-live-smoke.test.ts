import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

describe("Live Caddy Reverse Proxy Smoke Tests (Container Routing - Fail-Closed)", () => {
  let harness: TestHarness;
  let server: Server;
  const caddyPort = process.env.CADDY_PORT || "8081";
  const proxyOrigin = `http://localhost:${caddyPort}`;
  const caddyBaseUrl = `http://127.0.0.1:${caddyPort}`;

  beforeAll(async () => {
    // 1. Check if Caddy container is actively listening (Fail-Closed AUD-M3-001)
    let caddyAvailable = false;
    try {
      const ping = await fetch(`${caddyBaseUrl}/health`, { signal: AbortSignal.timeout(2000) });
      const serverHeader = ping.headers.get("server") ?? "";
      if (serverHeader.toLowerCase().includes("caddy") || ping.status === 502) {
        caddyAvailable = true;
      }
    } catch {
      caddyAvailable = false;
    }

    if (!caddyAvailable) {
      throw new Error(
        `[AUD-M3-001 Fail-Closed Gate] Mandatory Caddy reverse proxy container is NOT reachable at ${caddyBaseUrl}. ` +
        `Start Caddy via 'npm run proxy:up' before running live proxy acceptance tests.`
      );
    }

    harness = await createTestHarness();
    await harness.ensureNormalSeed("2026-09-08");
    await harness.database.user.updateMany({
      where: { id: { in: [SEED_RM_1_ID, SEED_RM_2_ID] } },
      data: { passwordHash: DEFAULT_DEV_PASSWORD_HASH },
    });

    const userRepository = new PrismaUserRepository(harness.database);
    const clientRepository = new PrismaClientRepository(harness.database);

    const authService = new AuthService({
      userRepository,
      jwtSecret: harness.jwtSecret,
    });
    const authController = new AuthController(authService, false);
    const authGuard = createAuthGuard({
      userRepository,
      jwtSecret: harness.jwtSecret,
    });
    const clientController = new ClientController({
      clientRepository,
    });

    const app = createApp({
      readiness: { check: async () => {} },
      version: "live-caddy-test",
      appOrigin: proxyOrigin,
      trustProxy: resolveTrustProxySetting("loopback"),
      configureRoutes: (expressApp) => {
        const authRouter = createAuthRouter({
          authController,
          authGuard,
          rateLimiterOptions: { windowMs: 60 * 1000, max: 4 },
        });
        const clientRouter = createClientRouter({
          clientController,
          authGuard,
        });
        expressApp.use("/api/auth", authRouter);
        expressApp.use("/api/clients", clientRouter);
      },
    });

    // Bind to 0.0.0.0:3001 so Caddy container can reach it via host.docker.internal:3001
    await new Promise<void>((resolve, reject) => {
      server = app.listen(3001, "0.0.0.0", () => {
        resolve();
      });
      server.on("error", reject);
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (harness) {
      await harness.close();
    }
  });

  it("routes /health through Caddy container to backend API", async () => {
    const res = await fetch(`${caddyBaseUrl}/health`);
    expect(res.status).toBe(200);
    const healthServerHeader = res.headers.get("server");
    if (healthServerHeader) {
      expect(healthServerHeader).toContain("Caddy");
    }

    const body = (await res.json()) as { status: string; version: string };
    expect(body.status).toBe("ok");
    expect(body.version).toBe("live-caddy-test");
  });

  it("routes /api/auth/login and /api/clients through Caddy container with cookie and Origin", async () => {
    // 1. Login via Caddy
    const loginRes = await fetch(`${caddyBaseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: proxyOrigin,
      },
      body: JSON.stringify({
        email: SEED_RM_1_EMAIL,
        password: "Password123!",
      }),
    });

    expect(loginRes.status).toBe(200);
    const loginServerHeader = loginRes.headers.get("server");
    if (loginServerHeader) {
      expect(loginServerHeader).toContain("Caddy");
    }

    const setCookieHeader = loginRes.headers.get("set-cookie");
    expect(setCookieHeader).toBeDefined();
    expect(setCookieHeader).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookieHeader).toContain("HttpOnly");

    // Extract cookie value
    const sessionCookiePart = setCookieHeader!
      .split(",")
      .find((c) => c.includes(`${SESSION_COOKIE_NAME}=`)) || setCookieHeader!;
    const cookieHeader = sessionCookiePart.split(";")[0]!.trim();

    // 2. Fetch /api/auth/me through Caddy with session cookie
    const meRes = await fetch(`${caddyBaseUrl}/api/auth/me`, {
      headers: {
        Cookie: cookieHeader,
      },
    });

    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as { id: string; role: string };
    expect(meBody.id).toBe(SEED_RM_1_ID);
    expect(meBody.role).toBe("RM");

    // 3. Fetch /api/clients through Caddy with session cookie
    const clientsRes = await fetch(`${caddyBaseUrl}/api/clients`, {
      headers: {
        Cookie: cookieHeader,
      },
    });

    expect(clientsRes.status).toBe(200);
    const clientsBody = (await clientsRes.json()) as { items: unknown[]; total: number };
    expect(clientsBody.total).toBe(15);
    expect(clientsBody.items).toHaveLength(15);
  });

  it("enforces Origin guard for requests through Caddy (rejects wrong or missing Origin)", async () => {
    // Wrong Origin
    const wrongOriginRes = await fetch(`${caddyBaseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://malicious-origin.com",
      },
      body: JSON.stringify({
        email: SEED_RM_1_EMAIL,
        password: "Password123!",
      }),
    });

    expect(wrongOriginRes.status).toBe(403);
    const wrongBody = (await wrongOriginRes.json()) as { error: { code: string } };
    expect(wrongBody.error.code).toBe("FORBIDDEN");

    // Missing Origin
    const missingOriginRes = await fetch(`${caddyBaseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: SEED_RM_1_EMAIL,
        password: "Password123!",
      }),
    });

    expect(missingOriginRes.status).toBe(403);
  });
});
