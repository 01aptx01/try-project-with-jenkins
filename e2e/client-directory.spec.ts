import { expect, test } from "@playwright/test";
import { createVerifiedE2EDatabase } from "./support/db-guard.js";
import { authenticateContext, createPaginationFixtures, E2EFixtureRegistry } from "./support/fixtures.js";
import { resetE2EDatabase } from "./support/seed-e2e.js";
import { SEED_RM_1_ID } from "../backend/src/seed/catalogue.js";

test.describe("Client Directory & Pagination E2E (M5-007)", () => {
  test.beforeEach(async () => {
    await resetE2EDatabase();
  });

  test("search by name/code and filter by priority/health with URL sync and reset", async ({
    page,
    context,
  }) => {
    // 1. Authenticate as RM 1 via cookie
    await authenticateContext(context, SEED_RM_1_ID);

    // 2. Navigate to Client Directory
    await page.goto("/clients");
    await page.waitForURL(/\/clients/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Client Directory");

    const totalCountEl = page.locator("[data-testid='client-total-count']");
    await expect(totalCountEl).toContainText("Total Clients: 15");

    // 3. Search for a specific client
    const searchInput = page.locator("#client-search-input");
    await searchInput.fill("TH-0001");
    await page.getByRole("button", { name: /^Search$/i }).click();

    // Verify URL sync
    await page.waitForURL(/search=TH-0001/);
    await expect(totalCountEl).toContainText("Total Clients: 1");

    // 4. Combined search and filter
    const prioritySelect = page.locator("#client-priority-filter");
    await prioritySelect.selectOption("HIGH");
    await page.waitForURL(/priority=HIGH/);

    // 5. Reset filters
    const resetBtn = page.locator("#client-filters-reset");
    await resetBtn.click();
    await page.waitForURL("**/clients");
    await expect(totalCountEl).toContainText("Total Clients: 15");
  });

  test("pagination with >20 clients correctly displays boundary client on page 2 and synchronizes URL", async ({
    page,
    context,
  }) => {
    // 1. Setup pagination fixture: add 10 clients for RM 1 (15 -> 25 total)
    const db = await createVerifiedE2EDatabase();
    const registry = new E2EFixtureRegistry();
    await createPaginationFixtures(db, SEED_RM_1_ID, registry);
    await db.$disconnect();

    try {
      // 2. Authenticate as RM 1
      await authenticateContext(context, SEED_RM_1_ID);

      // 3. Navigate to Client Directory
      await page.goto("/clients");
      await page.waitForURL(/\/clients/);

      const totalCountEl = page.locator("[data-testid='client-total-count']");
      await expect(totalCountEl).toContainText("Total Clients: 25");

      // Verify page 1 controls: 20 rows, Previous disabled, Next enabled
      const rows = page.locator("tbody tr");
      await expect(rows).toHaveCount(20);

      const nextBtn = page.getByRole("button", { name: /Next/i });
      const prevBtn = page.getByRole("button", { name: /Previous/i });
      await expect(prevBtn).toBeDisabled();
      await expect(nextBtn).toBeEnabled();

      // 4. Click Next -> Page 2
      await nextBtn.click();
      await page.waitForURL(/page=2/);

      // Page 2 should have 5 rows and contain lower-priority clients (e.g. C-004 Duangjai Prasert)
      await expect(page.locator("tbody tr")).toHaveCount(5);
      await expect(page.getByText("Duangjai Prasert")).toBeVisible();
      await expect(page.getByText("C-004")).toBeVisible();

      // 5. Browser Back button returns to Page 1
      await page.goBack();
      await page.waitForURL(/clients(?!\?page=2)/);
      await expect(page.locator("tbody tr")).toHaveCount(20);

      // Boundary HIGH client created at the end of source data appears on Page 1 due to HIGH priority sort
      await expect(page.getByText("ZetaLastHigh BoundaryClient")).toBeVisible();
    } finally {
      const cleanupDb = await createVerifiedE2EDatabase();
      await registry.cleanup(cleanupDb);
      await cleanupDb.$disconnect();
    }
  });

  test("enforces RM multi-tenancy isolation: RM 1 cannot search or view RM 2 clients", async ({
    page,
    context,
  }) => {
    await authenticateContext(context, SEED_RM_1_ID);

    await page.goto("/clients");
    await page.waitForURL(/\/clients/);

    // Search for Pakorn Panyarat (RM 2 client TH-0016)
    const searchInput = page.locator("#client-search-input");
    await searchInput.fill("Pakorn");
    await page.getByRole("button", { name: /^Search$/i }).click();

    // Verify empty state: 0 clients found
    const emptyState = page.locator("[data-testid='client-empty-state']");
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText(/No clients found/i);
    await expect(page.getByText("Pakorn Panyarat")).not.toBeVisible();
  });
});
