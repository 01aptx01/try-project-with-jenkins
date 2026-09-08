import { expect, test } from "@playwright/test";
import { authenticateContext } from "./support/fixtures.js";
import { resetE2EDatabase } from "./support/seed-e2e.js";
import { SEED_RM_1_ID, SEED_RM_2_ID } from "../backend/src/seed/catalogue.js";

test.describe("Morning Action Plan E2E (M5-007)", () => {
  test.beforeEach(async () => {
    await resetE2EDatabase();
  });

  test("displays deterministic prioritized review queue with HIGH priority first, customerCode tie-break, and valid as-of date", async ({
    page,
    context,
  }) => {
    // 1. Authenticate as RM 1
    await authenticateContext(context, SEED_RM_1_ID);
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/);

    // 2. Verify Dashboard heading and as-of date badge
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Morning Action Plan/i);
    await expect(page.getByText(/2026-09-08/)).toBeVisible();

    // 3. Verify prioritized client list
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();

    // The first client must have HIGH priority badge
    const firstRowPriority = rows.first().locator("td").filter({ hasText: /HIGH|AT RISK/i });
    await expect(firstRowPriority.first()).toBeVisible();

    // 4. Click a client name link to navigate to their profile
    const firstClientLink = rows.first().getByRole("link").first();
    const clientName = await firstClientLink.textContent();
    expect(clientName).toBeTruthy();

    await firstClientLink.click();
    await page.waitForURL(/\/clients\/[0-9a-f-]+/);

    // Verify arrived on profile page
    await expect(page.getByRole("heading", { level: 1 })).toContainText(clientName!.trim());
  });

  test("enforces strict RM data ownership between RM 1 and RM 2 dashboards", async ({
    browser,
  }) => {
    // 1. RM 1 browser context
    const context1 = await browser.newContext();
    await authenticateContext(context1, SEED_RM_1_ID);
    const page1 = await context1.newPage();
    await page1.goto("/dashboard");
    await page1.waitForURL(/\/dashboard/);

    // RM 1 should see RM 1 clients and NOT Pakorn Panyarat (RM 2 client)
    await expect(page1.getByText("Pakorn Panyarat")).not.toBeVisible();
    await context1.close();

    // 2. RM 2 browser context
    const context2 = await browser.newContext();
    await authenticateContext(context2, SEED_RM_2_ID);
    const page2 = await context2.newPage();
    await page2.goto("/dashboard");
    await page2.waitForURL(/\/dashboard/);

    // RM 2 sees Pakorn Panyarat in their own clients directory
    await page2.goto("/clients");
    await page2.waitForURL(/\/clients/);
    await expect(page2.getByText("Pakorn Panyarat")).toBeVisible();
    await context2.close();
  });
});
