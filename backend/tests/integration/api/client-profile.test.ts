import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import { createApp } from "../../../src/app.js";
import { ClientController } from "../../../src/controllers/client.controller.js";
import { createAuthGuard } from "../../../src/middleware/auth-guard.js";
import { PrismaClientRepository } from "../../../src/repositories/client.repository.js";
import { PrismaUserRepository } from "../../../src/repositories/user.repository.js";
import { createClientRouter } from "../../../src/routes/client.routes.js";
import {
  SEED_RM_1_ID,
} from "../../../src/seed/catalogue.js";
import { createMissingProfileFixture } from "../../fixtures/anomaly.fixtures.js";
import { createTestHarness, type TestHarness } from "../../support/test-harness.js";

describe("API: Client Profile Snapshot (GET /api/clients/:id) (M3-010)", () => {
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

  it("returns 200 and full profile snapshot for valid owned client", async () => {
    // C-001 is owned by RM1
    const clientId = "00000000-0000-4000-8000-000000000001";

    const response = await request(app)
      .get(`/api/clients/${clientId}`)
      .set("Cookie", rm1Cookie);

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");

    const data = response.body;
    expect(data.client.id).toBe(clientId);
    expect(data.client.customerCode).toBe("C-001");
    expect(data.client.firstName).toBe("Anan");
    expect(data.client.lastName).toBe("Prasert");
    expect(data.client.displayName).toBe("Anan Prasert");
    expect(data.client.riskLevel).toBe("MEDIUM");

    expect(data.financialProfile).not.toBeNull();
    expect(data.financialProfile.monthlyIncome).toBe("85000.00");
    expect(data.financialProfile.monthlyExpense).toBe("55000.00");
    expect(data.financialProfile.liquidAssets).toBe("90000.00");

    expect(data.goals.length).toBeGreaterThanOrEqual(1);
    expect(data.goals[0].goalType).toBe("EMERGENCY_FUND");

    expect(data.health.status).toBe("COMPLETE");
    expect(data.recommendation.action).toBe("Review Emergency Fund");
    expect(data.recommendation.priority).toBe("HIGH");
    expect(data.asOfDate).toBe(testAsOfDate);
    expect(typeof data.summary).toBe("string");
  });

  it("returns 400 Bad Request when client ID is not a valid UUID", async () => {
    const response = await request(app)
      .get("/api/clients/not-a-uuid")
      .set("Cookie", rm1Cookie);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("BAD_REQUEST");
    expect(response.body.error.message).toContain("Invalid client ID format");
  });

  it("returns 404 Not Found when client does not exist in database", async () => {
    const nonExistentId = "99999999-9999-4999-8999-999999999999";
    const response = await request(app)
      .get(`/api/clients/${nonExistentId}`)
      .set("Cookie", rm1Cookie);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(response.body.error.message).toBe("Client not found");
  });

  it("returns 404 Not Found with uniform message when accessing client owned by another RM (cross-RM ownership protection)", async () => {
    // C-016 is owned by RM2, accessed with RM1's cookie
    const rm2ClientId = "00000000-0000-4000-8000-000000000016";

    const response = await request(app)
      .get(`/api/clients/${rm2ClientId}`)
      .set("Cookie", rm1Cookie);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(response.body.error.message).toBe("Client not found");

    // But RM2 can access it successfully
    const rm2Response = await request(app)
      .get(`/api/clients/${rm2ClientId}`)
      .set("Cookie", rm2Cookie);

    expect(rm2Response.status).toBe(200);
    expect(rm2Response.body.client.customerCode).toBe("C-016");
  });

  it("returns 200 OK with INSUFFICIENT_DATA when financial profile is missing", async () => {
    const fixture = await createMissingProfileFixture(
      harness.database,
      SEED_RM_1_ID,
      harness.registry
    );

    const response = await request(app)
      .get(`/api/clients/${fixture.client.id}`)
      .set("Cookie", rm1Cookie);

    expect(response.status).toBe(200);
    expect(response.body.client.id).toBe(fixture.client.id);
    expect(response.body.financialProfile).toBeNull();
    expect(response.body.health.status).toBe("INSUFFICIENT_DATA");
    expect(response.body.recommendation.action).toBe("Review Client Data");
    expect(response.body.recommendation.priority).toBe("MEDIUM");
  });

  it("returns 401 Unauthorized when request lacks session cookie", async () => {
    const clientId = "00000000-0000-4000-8000-000000000001";
    const response = await request(app).get(`/api/clients/${clientId}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });
});
