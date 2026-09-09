import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { waitForE2EDatabase } from "./support/db-guard.js";
import { authenticateContext, createAuthHeaders, SEED_RM_1_ID } from "./support/fixtures.js";
import { resetE2EDatabase } from "./support/seed-e2e.js";

test.describe("Failure Recovery & Error Classification E2E (M5-011)", () => {
  test.beforeEach(async () => {
    await resetE2EDatabase();
  });

  test("standardized error classification envelopes: 400, 415, 404", async ({
    page,
  }) => {
    // 1. Malformed JSON returns 400 Bad Request with standard error envelope
    const badJsonRes = await page.request.post("/api/auth/login", {
      headers: {
        "Content-Type": "application/json",
        Origin: "http://127.0.0.1:8180",
      },
      data: "{ invalid json: true",
    });
    expect(badJsonRes.status()).toBe(400);
    const badJsonBody = await badJsonRes.json();
    expect(badJsonBody.error).toBeDefined();
    expect(badJsonBody.error.code).toBe("BAD_REQUEST");
    expect(badJsonBody.error.requestId).toBeDefined();

    // 2. Unsupported MIME type returns 415 with standard error envelope
    const unsupportedMimeRes = await page.request.post("/api/auth/login", {
      headers: {
        "Content-Type": "text/plain",
        Origin: "http://127.0.0.1:8180",
      },
      data: "email=rm1@meridian.local",
    });
    expect(unsupportedMimeRes.status()).toBe(415);
    const mimeBody = await unsupportedMimeRes.json();
    expect(mimeBody.error).toBeDefined();
    expect(mimeBody.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");

    // 3. Non-existent API route returns 404 with standard error envelope
    const notFoundRes = await page.request.get("/api/completely-unknown-route");
    expect(notFoundRes.status()).toBe(404);
    const notFoundBody = await notFoundRes.json();
    expect(notFoundBody.error).toBeDefined();
    expect(notFoundBody.error.code).toBe("NOT_FOUND");
  });

  test("real database container outage & recovery: stopping postgres-e2e triggers 503 degradation and restart restores 200 health", async ({
    request,
  }) => {
    // 1. Initial health verify: 200 OK
    const initialRes = await request.get("/health");
    expect(initialRes.status()).toBe(200);
    const initialBody = await initialRes.json();
    expect(initialBody.status).toBe("ok");

    try {
      // 2. Stop postgres-e2e container
      execSync("docker compose --profile e2e stop postgres-e2e", { stdio: "pipe" });

      // 3. Health check should return 503 DEPENDENCY_UNAVAILABLE
      await expect.poll(async () => {
        const res = await request.get("/health");
        return res.status();
      }, {
        intervals: [500, 1000],
        timeout: 10000,
      }).toBe(503);

      const downRes = await request.get("/health");
      expect(downRes.status()).toBe(503);
      const downBody = await downRes.json();
      expect(downBody.error?.code).toBe("DEPENDENCY_UNAVAILABLE");

      // Authenticated API request also yields 503
      const clientRes = await request.get("/api/clients", {
        headers: createAuthHeaders(SEED_RM_1_ID),
      });
      expect(clientRes.status()).toBe(503);
    } finally {
      // 4. Guaranteed recovery: restart postgres-e2e container and wait for readiness
      execSync("docker compose --profile e2e start postgres-e2e", { stdio: "pipe" });
      const recoveredDb = await waitForE2EDatabase(30000);
      await recoveredDb.$disconnect();
    }

    // 5. Verify healthy state is fully restored
    const recoveredRes = await request.get("/health");
    expect(recoveredRes.status()).toBe(200);
    const recoveredBody = await recoveredRes.json();
    expect(recoveredBody.status).toBe("ok");
  });

  test("503 backend service degradation (fault injection): displays connection error message and recovers smoothly on retry", async ({
    page,
    context,
  }) => {
    // 1. Authenticate RM 1 via cookie
    await authenticateContext(context, SEED_RM_1_ID);

    // 2. Navigate to Client Directory
    await page.goto("/clients");
    await page.waitForURL(/\/clients/);
    await expect(page.locator("tbody tr")).toHaveCount(15);

    // 3. Simulate backend database outage (503) on client directory queries
    await page.route("**/api/clients*", (route) => {
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Database service is temporarily unavailable. Please try again.",
          },
        }),
      });
    });

    // Trigger search while 503 is active
    const searchInput = page.locator("#client-search-input");
    await searchInput.fill("Anan");
    await page.getByRole("button", { name: /^Search$/i }).click();

    // 4. Verify UI shows 503 degradation notice and does NOT display Insufficient Data
    await expect(
      page.getByText(/Database service is temporarily unavailable/i)
    ).toBeVisible();
    await expect(page.getByText(/Insufficient Data/i)).not.toBeVisible();

    // 5. Restore healthy backend
    await page.unroute("**/api/clients*");

    // Clear search and click Search again
    await searchInput.fill("");
    await page.getByRole("button", { name: /^Search$/i }).click();

    // 6. Verify full recovery: 15 clients visible, zero error messages, no full page reload
    await expect(page.locator("tbody tr")).toHaveCount(15);
    await expect(
      page.getByText(/Database service is temporarily unavailable/i)
    ).not.toBeVisible();
  });

  test("client profile handles server failure with retry without claiming Insufficient Data (fault injection)", async ({
    page,
    context,
  }) => {
    // 1. Authenticate RM 1 via cookie
    await authenticateContext(context, SEED_RM_1_ID);

    const client1Id = "00000000-0000-4000-8000-000000000001";

    // 2. Route client profile snapshot to fail with 503
    await page.route(`**/api/clients/${client1Id}`, (route) => {
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Database service is temporarily unavailable. Please try again.",
          },
        }),
      });
    });

    await page.goto(`/clients/${client1Id}`);

    // 3. Verify error alert and retry button
    const errorAlert = page.getByRole("alert").filter({ hasText: /Database service is temporarily unavailable/i });
    await expect(errorAlert).toBeVisible();
    const retryBtn = page.getByRole("button", { name: /^Retry$/i });
    await expect(retryBtn).toBeVisible();

    // Ensure it does NOT show Insufficient Data
    await expect(page.getByText(/Insufficient Data/i)).not.toBeVisible();

    // 4. Restore service and click Retry
    await page.unroute(`**/api/clients/${client1Id}`);
    await retryBtn.click();

    // 5. Verify successful recovery and profile render
    await expect(page.locator("[data-testid='profile-display-name']")).toHaveText("Anan Prasert");
    await expect(errorAlert).not.toBeVisible();
  });
});
