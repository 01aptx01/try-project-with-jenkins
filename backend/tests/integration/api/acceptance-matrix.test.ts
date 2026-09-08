import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Express } from "express";
import { createApp } from "../../../src/app.js";
import type { ClientCard, ClientProfileSnapshotResponse } from "../../../src/contracts/api.js";
import { AuthController } from "../../../src/controllers/auth.controller.js";
import { ClientController } from "../../../src/controllers/client.controller.js";
import { DashboardController } from "../../../src/controllers/dashboard.controller.js";
import { FamilyController } from "../../../src/controllers/family.controller.js";
import { DependencyUnavailableError } from "../../../src/errors.js";
import { createAuthGuard } from "../../../src/middleware/auth-guard.js";
import { PrismaClientRepository } from "../../../src/repositories/client.repository.js";
import { PrismaFamilyRepository } from "../../../src/repositories/family.repository.js";
import { PrismaUserRepository } from "../../../src/repositories/user.repository.js";
import { createAuthRouter } from "../../../src/routes/auth.routes.js";
import { createClientRouter } from "../../../src/routes/client.routes.js";
import { createDashboardRouter } from "../../../src/routes/dashboard.routes.js";
import { createFamilyRouter } from "../../../src/routes/family.routes.js";
import { AuthService } from "../../../src/services/auth.service.js";
import { createTestHarness, type TestHarness } from "../../support/test-harness.js";
import { SEED_RM_1_ID, SEED_RM_2_ID } from "../../../src/seed/catalogue.js";

describe("Milestone 3 Acceptance Matrix (M3-017)", () => {
  let harness: TestHarness;
  let app: Express;
  let rm1Cookie: string;
  let rm2Cookie: string;
  const testAsOfDate = "2026-09-08";
  const testOrigin = "http://localhost:8080";

  let rm1ClientId: string;
  let rm2ClientId: string;

  beforeAll(async () => {
    harness = await createTestHarness();
    await harness.ensureNormalSeed(testAsOfDate);

    rm1Cookie = harness.createRm1SessionCookie();
    rm2Cookie = harness.createRm2SessionCookie();

    const rm1Client = await harness.database.client.findFirst({
      where: { rmId: SEED_RM_1_ID },
      orderBy: { customerCode: "asc" },
    });
    rm1ClientId = rm1Client!.id;

    const rm2Client = await harness.database.client.findFirst({
      where: { rmId: SEED_RM_2_ID },
      orderBy: { customerCode: "asc" },
    });
    rm2ClientId = rm2Client!.id;

    const userRepository = new PrismaUserRepository(harness.database);
    const clientRepository = new PrismaClientRepository(harness.database);
    const familyRepository = new PrismaFamilyRepository(harness.database);

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
      clock: () => testAsOfDate,
    });

    const dashboardController = new DashboardController({
      clientRepository,
      clock: () => testAsOfDate,
    });

    const familyController = new FamilyController({
      clientRepository,
      familyRepository,
    });

    app = createApp({
      readiness: { check: async () => undefined },
      version: "m3-acceptance",
      appOrigin: testOrigin,
      trustProxy: false,
      configureRoutes: (expressApp) => {
        const authRouter = createAuthRouter({
          authController,
          authGuard,
          rateLimiterOptions: { windowMs: 60000, max: 2 },
        });
        const clientRouter = createClientRouter({
          clientController,
          authGuard,
        });
        const dashboardRouter = createDashboardRouter({
          dashboardController,
          authGuard,
        });
        const familyRouter = createFamilyRouter({
          familyController,
          authGuard,
        });

        expressApp.use("/api/auth", authRouter);
        expressApp.use("/api/clients", clientRouter);
        expressApp.use("/api/clients", familyRouter);
        expressApp.use("/api/dashboard", dashboardRouter);
      },
    });
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    }
  });

  describe("1. RM Isolation Matrix across ALL endpoints", () => {
    it("enforces complete data isolation between RM1 and RM2", async () => {
      // 1. GET /api/clients
      const list1 = await request(app).get("/api/clients").set("Cookie", rm1Cookie);
      const list2 = await request(app).get("/api/clients").set("Cookie", rm2Cookie);
      expect(list1.body.total).toBe(15);
      expect(list2.body.total).toBe(15);
      const ids1 = new Set(list1.body.items.map((c: ClientCard) => c.id));
      const ids2 = new Set(list2.body.items.map((c: ClientCard) => c.id));
      for (const id of ids1) {
        expect(ids2.has(id)).toBe(false);
      }

      // 2. GET /api/dashboard/morning-action-plan
      const plan1 = await request(app).get("/api/dashboard/morning-action-plan").set("Cookie", rm1Cookie);
      const plan2 = await request(app).get("/api/dashboard/morning-action-plan").set("Cookie", rm2Cookie);
      expect(plan1.body.total).toBe(15);
      expect(plan2.body.total).toBe(15);
      for (const item of plan1.body.items) {
        expect(ids2.has(item.id)).toBe(false);
      }

      // 3. GET /api/clients/:id - cross access returns uniform 404
      const p1 = await request(app).get(`/api/clients/${rm2ClientId}`).set("Cookie", rm1Cookie);
      const p2 = await request(app).get(`/api/clients/${rm1ClientId}`).set("Cookie", rm2Cookie);
      expect(p1.status).toBe(404);
      expect(p2.status).toBe(404);
      expect(p1.body.error.message).toBe("Client not found");

      // 4. Sub-endpoints cross access returns 404
      const subPaths = ["health", "recommendations", "summary", "family"];
      for (const sub of subPaths) {
        const res = await request(app)
          .get(`/api/clients/${rm2ClientId}/${sub}`)
          .set("Cookie", rm1Cookie);
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("NOT_FOUND");
        expect(res.body.error.message).toBe("Client not found");
      }
    });
  });

  describe("2. Auth & Error Code Matrix", () => {
    it("returns 401 for unauthenticated requests on protected endpoints", async () => {
      const protectedEndpoints = [
        "/api/auth/me",
        "/api/clients",
        `/api/clients/${rm1ClientId}`,
        `/api/clients/${rm1ClientId}/health`,
        `/api/clients/${rm1ClientId}/recommendations`,
        `/api/clients/${rm1ClientId}/summary`,
        `/api/clients/${rm1ClientId}/family`,
        "/api/dashboard/morning-action-plan",
      ];

      for (const ep of protectedEndpoints) {
        const res = await request(app).get(ep);
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe("UNAUTHORIZED");
        expect(res.body.error.requestId).toBeDefined();
      }
    });

    it("verifies full error code matrix: 400, 403, 404, 413, 415, 429, 503 without stack trace leaks", async () => {
      // 400: Malformed UUID
      const r400 = await request(app)
        .get("/api/clients/not-a-uuid")
        .set("Cookie", rm1Cookie);
      expect(r400.status).toBe(400);
      expect(r400.body.error.code).toBe("BAD_REQUEST");
      expect(r400.body.stack).toBeUndefined();

      // 403: Origin mismatch on state-changing method
      const r403 = await request(app)
        .post("/api/auth/logout")
        .set("Origin", "http://malicious-origin.evil")
        .set("Cookie", rm1Cookie);
      expect(r403.status).toBe(403);
      expect(r403.body.error.code).toBe("FORBIDDEN");

      // 404: Non-existent route or resource
      const r404 = await request(app)
        .get("/api/non-existent-endpoint")
        .set("Cookie", rm1Cookie);
      expect(r404.status).toBe(404);
      expect(r404.body.error.code).toBe("NOT_FOUND");

      // 413: Payload too large (>16 KiB)
      const bigPayload = "x".repeat(17 * 1024);
      const r413 = await request(app)
        .post("/api/auth/login")
        .set("Origin", testOrigin)
        .set("Content-Type", "application/json")
        .send(`{"email":"rm1@meridian.local","password":"${bigPayload}"}`);
      expect(r413.status).toBe(413);
      expect(r413.body.error.code).toBe("PAYLOAD_TOO_LARGE");

      // 415: Unsupported Media Type
      const r415 = await request(app)
        .post("/api/auth/login")
        .set("Origin", testOrigin)
        .set("Content-Type", "text/plain")
        .send("plain text body");
      expect(r415.status).toBe(415);
      expect(r415.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");

      // 429: Rate limit exceeded (configured with max 2 in matrix test app)
      await request(app)
        .post("/api/auth/login")
        .set("Origin", testOrigin)
        .set("Content-Type", "application/json")
        .send({ email: "rm1@meridian.local", password: "Wrong" });
      await request(app)
        .post("/api/auth/login")
        .set("Origin", testOrigin)
        .set("Content-Type", "application/json")
        .send({ email: "rm1@meridian.local", password: "Wrong" });
      const r429 = await request(app)
        .post("/api/auth/login")
        .set("Origin", testOrigin)
        .set("Content-Type", "application/json")
        .send({ email: "rm1@meridian.local", password: "Wrong" });
      expect(r429.status).toBe(429);
      expect(r429.body.error.code).toBe("TOO_MANY_REQUESTS");

      // 503: Dependency Unavailable
      const unavailableApp = createApp({
        readiness: {
          check: async () => {
            throw new DependencyUnavailableError("Database unavailable");
          },
        },
        version: "test",
      });
      const r503 = await request(unavailableApp).get("/health");
      expect(r503.status).toBe(503);
      expect(r503.body.error.code).toBe("DEPENDENCY_UNAVAILABLE");
    });
  });

  describe("3. Data Consistency across all client-facing endpoints", () => {
    it("returns perfectly consistent domain results for Health, Primary Goal, Recommendation, and Summary", async () => {
      // 1. Profile snapshot
      const profileRes = await request(app)
        .get(`/api/clients/${rm1ClientId}`)
        .set("Cookie", rm1Cookie);
      expect(profileRes.status).toBe(200);
      const profile: ClientProfileSnapshotResponse = profileRes.body;

      // 2. Client list card
      const listRes = await request(app)
        .get(`/api/clients?search=${encodeURIComponent(profile.client.customerCode)}`)
        .set("Cookie", rm1Cookie);
      expect(listRes.status).toBe(200);
      const listCard: ClientCard = listRes.body.items[0];
      expect(listCard).toBeDefined();

      // 3. Morning Action Plan card
      const planRes = await request(app)
        .get(`/api/dashboard/morning-action-plan?search=${encodeURIComponent(profile.client.customerCode)}`)
        .set("Cookie", rm1Cookie);
      expect(planRes.status).toBe(200);
      const planCard: ClientCard = planRes.body.items[0];
      expect(planCard).toBeDefined();

      // 4. Sub-endpoints
      const healthRes = await request(app).get(`/api/clients/${rm1ClientId}/health`).set("Cookie", rm1Cookie);
      const recRes = await request(app).get(`/api/clients/${rm1ClientId}/recommendations`).set("Cookie", rm1Cookie);
      const sumRes = await request(app).get(`/api/clients/${rm1ClientId}/summary`).set("Cookie", rm1Cookie);

      // Verify cross-endpoint exact equality:
      // Health
      expect(listCard.health).toEqual(profile.health);
      expect(planCard.health).toEqual(profile.health);
      expect(healthRes.body).toEqual(profile.health);
      expect(sumRes.body.health).toEqual(profile.health);

      // Recommendation
      expect(listCard.recommendation).toEqual(profile.recommendation);
      expect(planCard.recommendation).toEqual(profile.recommendation);
      expect(recRes.body).toEqual(profile.recommendation);
      expect(sumRes.body.recommendation).toEqual(profile.recommendation);

      // Summary & Primary Goal
      expect(sumRes.body.summary).toEqual(profile.summary);
      expect(sumRes.body.primaryGoal).toEqual(profile.primaryGoal);
      expect(sumRes.body.asOfDate).toEqual(profile.asOfDate);
    });
  });

  describe("4. Performance & Batch Query Instrumentation", () => {
    it("guarantees 1 batch query without N+1 query regression for client list", async () => {
      const repoSpy = vi.spyOn(
        PrismaClientRepository.prototype,
        "findAllClientsByRmId"
      );

      const res = await request(app)
        .get("/api/clients")
        .set("Cookie", rm1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(15);
      // findAllClientsByRmId was called exactly 1 time for the batch of 15 clients!
      expect(repoSpy).toHaveBeenCalledTimes(1);
      repoSpy.mockRestore();
    });
  });

  describe("5. Security Headers", () => {
    it("enforces Cache-Control: no-store on all API endpoints", async () => {
      const endpoints = [
        "/api/clients",
        `/api/clients/${rm1ClientId}`,
        `/api/clients/${rm1ClientId}/health`,
        `/api/clients/${rm1ClientId}/recommendations`,
        `/api/clients/${rm1ClientId}/summary`,
        `/api/clients/${rm1ClientId}/family`,
        "/api/dashboard/morning-action-plan",
      ];

      for (const ep of endpoints) {
        const res = await request(app).get(ep).set("Cookie", rm1Cookie);
        expect(res.headers["cache-control"]).toBe("no-store");
      }
    });
  });
});
