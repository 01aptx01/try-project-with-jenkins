import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import { createApp } from "../../../src/app.js";
import type { ClientCard } from "../../../src/contracts/api.js";
import { ClientController } from "../../../src/controllers/client.controller.js";
import { DashboardController } from "../../../src/controllers/dashboard.controller.js";
import { createAuthGuard } from "../../../src/middleware/auth-guard.js";
import { PrismaClientRepository } from "../../../src/repositories/client.repository.js";
import { PrismaUserRepository } from "../../../src/repositories/user.repository.js";
import { createClientRouter } from "../../../src/routes/client.routes.js";
import { createDashboardRouter } from "../../../src/routes/dashboard.routes.js";
import { createTestHarness, type TestHarness } from "../../support/test-harness.js";

describe("API: Morning Action Plan (GET /api/dashboard/morning-action-plan) (M3-013)", () => {
  let harness: TestHarness;
  let app: Express;
  let rm1Cookie: string;
  let rm2Cookie: string;
  const testAsOfDate = "2026-09-08";

  beforeAll(async () => {
    harness = await createTestHarness();
    await harness.ensureNormalSeed(testAsOfDate);

    rm1Cookie = harness.createRm1SessionCookie();
    rm2Cookie = harness.createRm2SessionCookie();

    const clientRepository = new PrismaClientRepository(harness.database);
    const userRepository = new PrismaUserRepository(harness.database);

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

    app = createApp({
      readiness: { check: async () => {} },
      version: "test",
      configureRoutes: (expressApp) => {
        const clientRouter = createClientRouter({
          clientController,
          authGuard,
        });
        const dashboardRouter = createDashboardRouter({
          dashboardController,
          authGuard,
        });
        expressApp.use("/api/clients", clientRouter);
        expressApp.use("/api/dashboard", dashboardRouter);
      },
    });
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    }
  });

  it("returns 401 when no session cookie is present", async () => {
    const res = await request(app).get("/api/dashboard/morning-action-plan");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(res.body.error.message).toBe("Authentication session required");
  });

  it("returns morning action plan with correct asOfDate and items for RM1", async () => {
    const res = await request(app)
      .get("/api/dashboard/morning-action-plan")
      .set("Cookie", rm1Cookie);

    expect(res.status).toBe(200);
    expect(res.header["cache-control"]).toBe("no-store");
    expect(res.body.asOfDate).toBe(testAsOfDate);
    expect(res.body.total).toBe(15);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(20);
    expect(res.body.items).toHaveLength(15);

    // Verify ordering: HIGH priority first
    const priorities = (res.body.items as ClientCard[]).map(
      (c) => c.recommendation.priority
    );
    const priorityWeight: Record<string, number> = {
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };
    for (let i = 0; i < priorities.length - 1; i++) {
      const current = priorityWeight[priorities[i] ?? "LOW"] ?? 0;
      const next = priorityWeight[priorities[i + 1] ?? "LOW"] ?? 0;
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });

  it("demonstrates 100% parity with GET /api/clients (same items, priority, health, recommendations)", async () => {
    const actionPlanRes = await request(app)
      .get("/api/dashboard/morning-action-plan?page=1&pageSize=10")
      .set("Cookie", rm1Cookie);

    const clientListRes = await request(app)
      .get("/api/clients?page=1&pageSize=10")
      .set("Cookie", rm1Cookie);

    expect(actionPlanRes.status).toBe(200);
    expect(clientListRes.status).toBe(200);

    // Everything except asOfDate (which is specific to morning-action-plan) matches exactly
    expect(actionPlanRes.body.total).toBe(clientListRes.body.total);
    expect(actionPlanRes.body.page).toBe(clientListRes.body.page);
    expect(actionPlanRes.body.pageSize).toBe(clientListRes.body.pageSize);
    expect(actionPlanRes.body.items).toEqual(clientListRes.body.items);
  });

  it("supports filters and text search matching client list behavior", async () => {
    const filteredActionPlan = await request(app)
      .get("/api/dashboard/morning-action-plan?priority=HIGH")
      .set("Cookie", rm1Cookie);

    const filteredClients = await request(app)
      .get("/api/clients?priority=HIGH")
      .set("Cookie", rm1Cookie);

    expect(filteredActionPlan.status).toBe(200);
    expect(filteredClients.status).toBe(200);
    expect(filteredActionPlan.body.items).toEqual(filteredClients.body.items);
    expect(filteredActionPlan.body.total).toBe(filteredClients.body.total);

    for (const item of filteredActionPlan.body.items as ClientCard[]) {
      expect(item.recommendation.priority).toBe("HIGH");
    }
  });

  it("enforces RM ownership isolation on dashboard", async () => {
    const rm1Res = await request(app)
      .get("/api/dashboard/morning-action-plan")
      .set("Cookie", rm1Cookie);

    const rm2Res = await request(app)
      .get("/api/dashboard/morning-action-plan")
      .set("Cookie", rm2Cookie);

    expect(rm1Res.status).toBe(200);
    expect(rm2Res.status).toBe(200);
    expect(rm1Res.body.total).toBe(15);
    expect(rm2Res.body.total).toBe(15);

    const rm1Ids = new Set(
      (rm1Res.body.items as ClientCard[]).map((c) => c.id)
    );
    const rm2Ids = new Set(
      (rm2Res.body.items as ClientCard[]).map((c) => c.id)
    );

    // Zero overlap
    for (const id of rm1Ids) {
      expect(rm2Ids.has(id)).toBe(false);
    }
  });

  it("handles UTC date clock injection across midnight boundaries", async () => {
    let customDate = "2026-12-31";
    const customController = new DashboardController({
      clientRepository: new PrismaClientRepository(harness.database),
      clock: () => customDate,
    });

    const customApp = createApp({
      readiness: { check: async () => {} },
      version: "test",
      configureRoutes: (expressApp) => {
        const dashboardRouter = createDashboardRouter({
          dashboardController: customController,
          authGuard: createAuthGuard({
            userRepository: new PrismaUserRepository(harness.database),
            jwtSecret: harness.jwtSecret,
          }),
        });
        expressApp.use("/api/dashboard", dashboardRouter);
      },
    });

    const res1 = await request(customApp)
      .get("/api/dashboard/morning-action-plan")
      .set("Cookie", rm1Cookie);
    expect(res1.status).toBe(200);
    expect(res1.body.asOfDate).toBe("2026-12-31");

    // Advance clock past midnight
    customDate = "2027-01-01";
    const res2 = await request(customApp)
      .get("/api/dashboard/morning-action-plan")
      .set("Cookie", rm1Cookie);
    expect(res2.status).toBe(200);
    expect(res2.body.asOfDate).toBe("2027-01-01");
  });
});
