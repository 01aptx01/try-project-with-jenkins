import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import { createApp } from "../../../src/app.js";
import { ClientController } from "../../../src/controllers/client.controller.js";
import { createAuthGuard } from "../../../src/middleware/auth-guard.js";
import { PrismaClientRepository } from "../../../src/repositories/client.repository.js";
import { PrismaUserRepository } from "../../../src/repositories/user.repository.js";
import { createClientRouter } from "../../../src/routes/client.routes.js";
import { SEED_RM_1_ID } from "../../../src/seed/catalogue.js";
import { createMissingProfileFixture } from "../../fixtures/anomaly.fixtures.js";
import { createTestHarness, type TestHarness } from "../../support/test-harness.js";

describe("API: Client Sub-endpoints (/health, /recommendations, /summary) (M3-014)", () => {
  let harness: TestHarness;
  let app: Express;
  let rm1Cookie: string;
  let rm2Cookie: string;
  const testAsOfDate = "2026-09-08";

  let rm1ClientId: string;
  let rm2ClientId: string;
  let insufficientDataClientId: string;

  beforeAll(async () => {
    harness = await createTestHarness();
    await harness.ensureNormalSeed(testAsOfDate);

    rm1Cookie = harness.createRm1SessionCookie();
    rm2Cookie = harness.createRm2SessionCookie();

    const rm1Client = await harness.database.client.findFirst({
      where: { rmId: SEED_RM_1_ID },
    });
    rm1ClientId = rm1Client!.id;

    const rm2Client = await harness.database.client.findFirst({
      where: { rmId: { not: SEED_RM_1_ID } },
    });
    rm2ClientId = rm2Client!.id;

    // Create anomaly fixture for insufficient data
    const fixture = await createMissingProfileFixture(
      harness.database,
      SEED_RM_1_ID,
      harness.registry
    );
    insufficientDataClientId = fixture.client.id;

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

    app = createApp({
      readiness: { check: async () => {} },
      version: "test",
      configureRoutes: (expressApp) => {
        const clientRouter = createClientRouter({
          clientController,
          authGuard,
        });
        expressApp.use("/api/clients", clientRouter);
      },
    });
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    }
  });

  it("returns 401 on all sub-endpoints when unauthenticated", async () => {
    const healthRes = await request(app).get(`/api/clients/${rm1ClientId}/health`);
    expect(healthRes.status).toBe(401);
    expect(healthRes.body.error.code).toBe("UNAUTHORIZED");

    const recRes = await request(app).get(`/api/clients/${rm1ClientId}/recommendations`);
    expect(recRes.status).toBe(401);
    expect(recRes.body.error.code).toBe("UNAUTHORIZED");

    const sumRes = await request(app).get(`/api/clients/${rm1ClientId}/summary`);
    expect(sumRes.status).toBe(401);
    expect(sumRes.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 on malformed UUID for all sub-endpoints", async () => {
    const invalidId = "not-a-valid-uuid";
    const endpoints = ["health", "recommendations", "summary"];

    for (const ep of endpoints) {
      const res = await request(app)
        .get(`/api/clients/${invalidId}/${ep}`)
        .set("Cookie", rm1Cookie);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(res.body.error.message).toBe("Invalid client ID format");
    }
  });

  it("returns 404 on non-existent client ID for all sub-endpoints", async () => {
    const nonExistentId = "a0000000-0000-0000-0000-000000000099";
    const endpoints = ["health", "recommendations", "summary"];

    for (const ep of endpoints) {
      const res = await request(app)
        .get(`/api/clients/${nonExistentId}/${ep}`)
        .set("Cookie", rm1Cookie);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
      expect(res.body.error.message).toBe("Client not found");
    }
  });

  it("enforces cross-RM ownership isolation (returns 404 uniform message)", async () => {
    // RM1 tries to access RM2's client -> rejected with 404
    const endpoints = ["health", "recommendations", "summary"];

    for (const ep of endpoints) {
      const res = await request(app)
        .get(`/api/clients/${rm2ClientId}/${ep}`)
        .set("Cookie", rm1Cookie);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
      expect(res.body.error.message).toBe("Client not found");

      // Whereas RM2 accessing its own client succeeds
      const ownRes = await request(app)
        .get(`/api/clients/${rm2ClientId}/${ep}`)
        .set("Cookie", rm2Cookie);
      expect(ownRes.status).toBe(200);
    }
  });

  it("demonstrates 100% parity between sub-endpoints and GET /api/clients/:id snapshot", async () => {
    // 1. Fetch full snapshot
    const profileRes = await request(app)
      .get(`/api/clients/${rm1ClientId}`)
      .set("Cookie", rm1Cookie);
    expect(profileRes.status).toBe(200);
    const profile = profileRes.body;

    // 2. Test /health
    const healthRes = await request(app)
      .get(`/api/clients/${rm1ClientId}/health`)
      .set("Cookie", rm1Cookie);
    expect(healthRes.status).toBe(200);
    expect(healthRes.header["cache-control"]).toBe("no-store");
    expect(healthRes.body).toEqual(profile.health);

    // 3. Test /recommendations
    const recRes = await request(app)
      .get(`/api/clients/${rm1ClientId}/recommendations`)
      .set("Cookie", rm1Cookie);
    expect(recRes.status).toBe(200);
    expect(recRes.header["cache-control"]).toBe("no-store");
    expect(recRes.body).toEqual(profile.recommendation);

    // 4. Test /summary
    const sumRes = await request(app)
      .get(`/api/clients/${rm1ClientId}/summary`)
      .set("Cookie", rm1Cookie);
    expect(sumRes.status).toBe(200);
    expect(sumRes.header["cache-control"]).toBe("no-store");
    expect(sumRes.body).toEqual({
      summary: profile.summary,
      health: profile.health,
      primaryGoal: profile.primaryGoal,
      recommendation: profile.recommendation,
      asOfDate: profile.asOfDate,
    });
  });

  it("correctly projects INSUFFICIENT_DATA status on all sub-endpoints", async () => {
    // Fetch snapshot for client with missing profile
    const profileRes = await request(app)
      .get(`/api/clients/${insufficientDataClientId}`)
      .set("Cookie", rm1Cookie);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.health.status).toBe("INSUFFICIENT_DATA");

    // /health
    const healthRes = await request(app)
      .get(`/api/clients/${insufficientDataClientId}/health`)
      .set("Cookie", rm1Cookie);
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe("INSUFFICIENT_DATA");
    expect(healthRes.body).toEqual(profileRes.body.health);

    // /recommendations
    const recRes = await request(app)
      .get(`/api/clients/${insufficientDataClientId}/recommendations`)
      .set("Cookie", rm1Cookie);
    expect(recRes.status).toBe(200);
    expect(recRes.body).toEqual(profileRes.body.recommendation);

    // /summary
    const sumRes = await request(app)
      .get(`/api/clients/${insufficientDataClientId}/summary`)
      .set("Cookie", rm1Cookie);
    expect(sumRes.status).toBe(200);
    expect(sumRes.body.health.status).toBe("INSUFFICIENT_DATA");
    expect(sumRes.body.summary).toBe(profileRes.body.summary);
  });
});
