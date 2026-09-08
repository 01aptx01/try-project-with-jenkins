import { expect, test } from "@playwright/test";
import { createVerifiedE2EDatabase } from "./support/db-guard.js";
import { authenticateContext, createIncompleteProfileFixture, E2EFixtureRegistry } from "./support/fixtures.js";
import { resetE2EDatabase } from "./support/seed-e2e.js";
import { SEED_RM_1_ID } from "../backend/src/seed/catalogue.js";

test.describe("Client Profile Snapshot & Financial Evaluation E2E (M5-008)", () => {
  test.beforeEach(async () => {
    await resetE2EDatabase();
  });

  test("single-request snapshot loading: fetches snapshot once and renders 5-pillar health, NBA, summary, and neutral monetary formatting", async ({
    page,
    context,
  }) => {
    // 1. Authenticate as RM 1
    await authenticateContext(context, SEED_RM_1_ID);

    // 2. Track API network requests for single-request snapshot pattern
    const clientSnapshotRequests: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("/api/clients/") && !url.includes("/family")) {
        clientSnapshotRequests.push(url);
      }
    });

    // 3. Navigate to Client 1 Profile (Anan Prasert, C-001)
    const client1Id = "00000000-0000-4000-8000-000000000001";
    const snapshotResponsePromise = page.waitForResponse(
      (res) => res.url().includes(`/api/clients/${client1Id}`) && res.request().method() === "GET"
    );

    await page.goto(`/clients/${client1Id}`);
    await page.waitForURL(new RegExp(`/clients/${client1Id}`));

    const snapshotRes = await snapshotResponsePromise;
    expect(snapshotRes.status()).toBe(200);

    // 4. Verify Client Header & Identifiers
    await expect(page.locator("[data-testid='profile-display-name']")).toHaveText("Anan Prasert");
    await expect(page.locator("[data-testid='profile-customer-code']")).toHaveText("C-001");
    await expect(page.locator("[data-testid='profile-as-of-date']")).toContainText("2026-09-08");

    // Verify snapshot endpoint was called exactly once for this client
    const matchingRequests = clientSnapshotRequests.filter((url) => url.includes(client1Id));
    expect(matchingRequests.length).toBe(1);

    // 5. Verify 5-Pillar Health Score Breakdown & Exact Numeric Values
    await expect(page.locator("[data-testid='health-panel']")).toBeVisible();
    await expect(page.locator("[data-testid='health-overall-score-display']")).toHaveText("81.63 / 100");
    await expect(page.locator("[data-testid='health-status-text']")).toHaveText("Classification: GOOD");

    // Verify exact scores for all 5 components (8 + 25 + 20 + 13.63 + 15 = 81.63)
    await expect(page.locator("[data-testid='health-comp-liquidity']")).toContainText("8 / 20");
    await expect(page.locator("[data-testid='health-comp-debt']")).toContainText("25 / 20");
    await expect(page.locator("[data-testid='health-comp-savings']")).toContainText("20 / 20");
    await expect(page.locator("[data-testid='health-comp-goals']")).toContainText("13.63 / 20");
    await expect(page.locator("[data-testid='health-comp-investment']")).toContainText("15 / 20");

    // 6. Verify Next Best Action (NBA) Card
    await expect(page.locator("[data-testid='recommendation-card']")).toBeVisible();
    await expect(page.locator("[data-testid='nba-rule-id']")).toHaveText("BR-04.2");
    await expect(page.locator("[data-testid='profile-nba-action']")).toHaveText("Review Emergency Fund");
    await expect(page.locator("[data-testid='profile-nba-reason']")).toBeVisible();

    // 7. Verify Executive Portfolio Summary Consistency
    await expect(page.locator("[data-testid='summary-panel']")).toBeVisible();
    const summaryText = await page.locator("[data-testid='profile-summary-text']").textContent();
    expect(summaryText).toBeTruthy();
    expect(summaryText!.length).toBeGreaterThan(20);
    // Consistent with health score and NBA
    expect(summaryText).toContain("81.63");
    expect(summaryText?.toLowerCase()).toMatch(/emergency fund|liquidity/);

    // 8. Verify Financial Profile Panel & Monetary Formatting (AUD-M4-006: strictly neutral without ฿)
    await expect(page.locator("[data-testid='financial-profile-panel']")).toBeVisible();

    const monthlyIncome = await page.locator("[data-testid='fin-monthly-income']").textContent();
    const monthlyExpense = await page.locator("[data-testid='fin-monthly-expense']").textContent();
    const liquidAssets = await page.locator("[data-testid='fin-liquid-assets']").textContent();

    expect(monthlyIncome).toContain("85,000.00");
    expect(monthlyExpense).toContain("55,000.00");
    expect(liquidAssets).toContain("90,000.00");

    // Strictly ensure no hardcoded currency symbol "฿"
    expect(monthlyIncome).not.toContain("฿");
    expect(monthlyExpense).not.toContain("฿");
    expect(liquidAssets).not.toContain("฿");

    // 9. Verify Primary Goal Card & Progress Calculation Formula
    await expect(page.locator("[data-testid='primary-goal-card']")).toBeVisible();
    await expect(page.locator("[data-testid='primary-goal-target']")).toContainText("300,000.00");
    await expect(page.locator("[data-testid='primary-goal-current']")).toContainText("90,000.00");
    await expect(page.locator("[data-testid='primary-goal-progress']")).toContainText("91%");
  });

  test("renders incomplete profile with INSUFFICIENT_DATA and safely displays missing fields", async ({
    page,
    context,
  }) => {
    // 1. Create incomplete profile fixture
    const db = await createVerifiedE2EDatabase();
    const registry = new E2EFixtureRegistry();
    const { client } = await createIncompleteProfileFixture(db, SEED_RM_1_ID, registry);
    await db.$disconnect();

    try {
      // 2. Authenticate as RM 1
      await authenticateContext(context, SEED_RM_1_ID);

      // 3. Navigate to incomplete client's profile
      await page.goto(`/clients/${client.id}`);
      await page.waitForURL(new RegExp(`/clients/${client.id}`));

      // 4. Verify display name
      await expect(page.locator("[data-testid='profile-display-name']")).toContainText("Incomplete ProfileClient");

      // 5. Verify Insufficient Data badges and pillars
      await expect(page.getByText("Insufficient Data").first()).toBeVisible();

      // Null fields display fallback placeholder "—"
      const incomeEl = page.locator("[data-testid='fin-monthly-income']");
      await expect(incomeEl).toContainText("—");

      // Verify no progressbar with artificial value is emitted (AUD-M4-008)
      const zeroProgressBars = page.locator("[role='progressbar'][aria-valuenow='0']");
      await expect(zeroProgressBars).toHaveCount(0);
    } finally {
      const cleanupDb = await createVerifiedE2EDatabase();
      await registry.cleanup(cleanupDb);
      await cleanupDb.$disconnect();
    }
  });

  test("enforces 404 client not found when accessing non-existent client UUID", async ({
    page,
    context,
  }) => {
    await authenticateContext(context, SEED_RM_1_ID);

    const nonExistentUuid = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    await page.goto(`/clients/${nonExistentUuid}`);

    // Verify 404 alert card is shown
    const notFoundCard = page.locator("[data-testid='client-not-found']");
    await expect(notFoundCard).toBeVisible();
    await expect(notFoundCard).toContainText("Client Not Found");

    // Click return link
    const returnLink = notFoundCard.getByRole("link", { name: /Return to Client Directory/i });
    await expect(returnLink).toBeVisible();
    await returnLink.click();

    await page.waitForURL(/\/clients/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Client Directory");
  });
});
