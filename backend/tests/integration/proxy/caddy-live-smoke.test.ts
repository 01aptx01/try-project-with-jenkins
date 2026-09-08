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

describe("Live Caddy Reverse Proxy Smoke Tests (Container Routing)", () => {
  let harness: TestHarness;
  let server: Server;
  const caddyPort = process.env.CADDY_PORT || "8081";
  const proxyOrigin = `http://localhost:${caddyPort}`;
  const caddyBaseUrl = `http://127.0.0.1:${caddyPort}`;

  let caddyAvailable = false;

  beforeAll(async () => {
    // 1. Check if Caddy container is actively listening
    try {
      const ping = await fetch(`${caddyBaseUrl}/health`, { signal: AbortSignal.timeout(1500) });
      // Caddy without backend returns 502 Bad Gateway with Server: Caddy
      const serverHeader = ping.headers.get("server") ?? "";
      if (serverHeader.toLowerCase().includes("caddy") || ping.status === 502) {
        caddyAvailable = true;
      }
    } catch {
      caddyAvailable = false;
    }

    if (!caddyAvailable) {
      console.warn(`[Live Caddy Smoke] Caddy container is not reachable on ${caddyBaseUrl}. Skipping live network tests.`);
      return;
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
          rateLimiterOptions: { windowMs: 60 * 1000, max: 20 },
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
    if (!caddyAvailable) return;

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
    if (!caddyAvailable) return;

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
});
