import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import { createApp } from "../../../src/app.js";
import { ClientController } from "../../../src/controllers/client.controller.js";
import { createAuthGuard } from "../../../src/middleware/auth-guard.js";
import { PrismaClientRepository } from "../../../src/repositories/client.repository.js";
import { PrismaUserRepository } from "../../../src/repositories/user.repository.js";
import { createClientRouter } from "../../../src/routes/client.routes.js";
import { createTestHarness, type TestHarness } from "../../support/test-harness.js";

describe("API: Client List, Search, Filters & Pagination (GET /api/clients) (M3-011 & M3-012)", () => {
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

  it("enforces strict RM ownership isolation on client list", async () => {
    const rm1Res = await request(app)
      .get("/api/clients")
      .set("Cookie", rm1Cookie);

    expect(rm1Res.status).toBe(200);
    expect(rm1Res.body.total).toBe(15);
    expect(rm1Res.body.items).toHaveLength(15);
    // RM1 only owns C-001 to C-015
    for (const item of rm1Res.body.items) {
      const codeNum = parseInt(item.customerCode.replace("C-", ""), 10);
      expect(codeNum).toBeGreaterThanOrEqual(1);
      expect(codeNum).toBeLessThanOrEqual(15);
    }

    const rm2Res = await request(app)
      .get("/api/clients")
      .set("Cookie", rm2Cookie);

    expect(rm2Res.status).toBe(200);
    expect(rm2Res.body.total).toBe(15);
    expect(rm2Res.body.items).toHaveLength(15);
    // RM2 only owns C-016 to C-030
    for (const item of rm2Res.body.items) {
      const codeNum = parseInt(item.customerCode.replace("C-", ""), 10);
      expect(codeNum).toBeGreaterThanOrEqual(16);
      expect(codeNum).toBeLessThanOrEqual(30);
    }
  });

  it("searches clients by full name, partial name, and customer code case-insensitively", async () => {
    // 1. Partial name search
    const partialNameRes = await request(app)
      .get("/api/clients?search=anan")
      .set("Cookie", rm1Cookie);

    expect(partialNameRes.status).toBe(200);
    expect(partialNameRes.body.total).toBe(1);
    expect(partialNameRes.body.items[0].displayName).toBe("Anan Prasert");

    // 2. Customer code search (uppercase)
    const codeRes = await request(app)
      .get("/api/clients?search=C-005")
      .set("Cookie", rm1Cookie);

    expect(codeRes.status).toBe(200);
    expect(codeRes.body.total).toBe(1);
    expect(codeRes.body.items[0].customerCode).toBe("C-005");

    // 3. Customer code search (lowercase)
    const lowerCodeRes = await request(app)
      .get("/api/clients?search=c-005")
      .set("Cookie", rm1Cookie);

    expect(lowerCodeRes.status).toBe(200);
    expect(lowerCodeRes.body.total).toBe(1);
    expect(lowerCodeRes.body.items[0].customerCode).toBe("C-005");

    // 4. Search with leading/trailing whitespace
    const trimRes = await request(app)
      .get("/api/clients?search=%20%20bussaba%20%20")
      .set("Cookie", rm1Cookie);

    expect(trimRes.status).toBe(200);
    expect(trimRes.body.total).toBe(1);
    expect(trimRes.body.items[0].customerCode).toBe("C-002");

    // 5. Search with special characters (safe, no injection)
    const specialRes = await request(app)
      .get("/api/clients?search=%25_notfound")
      .set("Cookie", rm1Cookie);

    expect(specialRes.status).toBe(200);
    expect(specialRes.body.total).toBe(0);
    expect(specialRes.body.items).toHaveLength(0);
  });

  it("sorts clients deterministically: Priority (HIGH -> MEDIUM -> LOW) then customerCode ascending", async () => {
    const res = await request(app)
      .get("/api/clients")
      .set("Cookie", rm1Cookie);

    expect(res.status).toBe(200);
    const items = res.body.items;

    // Check priority order is non-increasing
    const rankMap: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    for (let i = 0; i < items.length - 1; i++) {
      const rankA = rankMap[items[i].recommendation.priority] ?? 0;
      const rankB = rankMap[items[i + 1].recommendation.priority] ?? 0;
      expect(rankA).toBeGreaterThanOrEqual(rankB);

      // If priorities are equal, customerCode must be strictly ascending
      if (rankA === rankB) {
        expect(items[i].customerCode.localeCompare(items[i + 1].customerCode)).toBeLessThan(0);
      }
    }
  });

  it("filters clients by Priority, Health status, and combination", async () => {
    // 1. Filter by Priority HIGH
    const highRes = await request(app)
      .get("/api/clients?priority=HIGH")
      .set("Cookie", rm1Cookie);

    expect(highRes.status).toBe(200);
    expect(highRes.body.total).toBeGreaterThanOrEqual(1);
    for (const item of highRes.body.items) {
      expect(item.recommendation.priority).toBe("HIGH");
    }

    // 2. Filter by Health MODERATE
    const modRes = await request(app)
      .get("/api/clients?health=MODERATE")
      .set("Cookie", rm1Cookie);

    expect(modRes.status).toBe(200);
    for (const item of modRes.body.items) {
      expect(item.health.classification).toBe("MODERATE");
    }

    // 3. Combined Filter (priority AND health)
    const combinedRes = await request(app)
      .get("/api/clients?priority=HIGH&health=MODERATE")
      .set("Cookie", rm1Cookie);

    expect(combinedRes.status).toBe(200);
    for (const item of combinedRes.body.items) {
      expect(item.recommendation.priority).toBe("HIGH");
      expect(item.health.classification).toBe("MODERATE");
    }
  });

  it("handles pagination boundaries and page slicing correctly", async () => {
    // 1. Page 1, PageSize 5
    const p1 = await request(app)
      .get("/api/clients?page=1&pageSize=5")
      .set("Cookie", rm1Cookie);

    expect(p1.status).toBe(200);
    expect(p1.body.page).toBe(1);
    expect(p1.body.pageSize).toBe(5);
    expect(p1.body.total).toBe(15);
    expect(p1.body.items).toHaveLength(5);

    // 2. Page 2, PageSize 5
    const p2 = await request(app)
      .get("/api/clients?page=2&pageSize=5")
      .set("Cookie", rm1Cookie);

    expect(p2.status).toBe(200);
    expect(p2.body.page).toBe(2);
    expect(p2.body.items).toHaveLength(5);
    // Page 2 items must not overlap with Page 1 items
    const p1Codes = new Set(p1.body.items.map((i: { customerCode: string }) => i.customerCode));
    for (const item of p2.body.items) {
      expect(p1Codes.has(item.customerCode)).toBe(false);
    }

    // 3. Out-of-bounds page returns empty items with accurate total
    const pOut = await request(app)
      .get("/api/clients?page=99&pageSize=5")
      .set("Cookie", rm1Cookie);

    expect(pOut.status).toBe(200);
    expect(pOut.body.page).toBe(99);
    expect(pOut.body.total).toBe(15);
    expect(pOut.body.items).toEqual([]);
  });

  it("rejects invalid pagination and filter query parameters with 400 Bad Request", async () => {
    // page = 0
    const zeroPage = await request(app)
      .get("/api/clients?page=0")
      .set("Cookie", rm1Cookie);
    expect(zeroPage.status).toBe(400);

    // pageSize = 0
    const zeroSize = await request(app)
      .get("/api/clients?pageSize=0")
      .set("Cookie", rm1Cookie);
    expect(zeroSize.status).toBe(400);

    // pageSize > 100
    const bigSize = await request(app)
      .get("/api/clients?pageSize=101")
      .set("Cookie", rm1Cookie);
    expect(bigSize.status).toBe(400);

    // Invalid priority enum
    const badPriority = await request(app)
      .get("/api/clients?priority=URGENT")
      .set("Cookie", rm1Cookie);
    expect(badPriority.status).toBe(400);

    // Invalid health enum
    const badHealth = await request(app)
      .get("/api/clients?health=PERFECT")
      .set("Cookie", rm1Cookie);
    expect(badHealth.status).toBe(400);

    // Unknown extra query parameter (strict schema)
    const extraParam = await request(app)
      .get("/api/clients?unknown=param")
      .set("Cookie", rm1Cookie);
    expect(extraParam.status).toBe(400);
  });

  it("returns 401 Unauthorized when request lacks session cookie", async () => {
    const response = await request(app).get("/api/clients");
    expect(response.status).toBe(401);
  });
});
