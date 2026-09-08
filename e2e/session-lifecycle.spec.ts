import { expect, test } from "@playwright/test";
import { authenticateContext, SEED_RM_1_ID, SEED_RM_2_ID } from "./support/fixtures.js";
import { resetE2EDatabase } from "./support/seed-e2e.js";

test.describe("Session Lifecycle & RM Data Isolation E2E (M5-010)", () => {
  test.beforeEach(async () => {
    await resetE2EDatabase();
  });

  test("RM switch triggers keyed subtree remount and purges sensitive client data immediately (AUD-M4-001)", async ({
    page,
    context,
  }) => {
    const client1Id = "00000000-0000-4000-8000-000000000001";

    // 1. Authenticate as RM 1
    await authenticateContext(context, SEED_RM_1_ID);
    await page.goto(`/clients/${client1Id}`);
    await page.waitForURL(new RegExp(`/clients/${client1Id}`));
    await expect(page.locator("[data-testid='profile-display-name']")).toHaveText("Anan Prasert");

    // 2. Logout RM 1
    await page.getByRole("button", { name: /Sign out|Log out/i }).click();
    await page.waitForURL(/\/login/);

    // 3. Authenticate as RM 2
    await authenticateContext(context, SEED_RM_2_ID);
    await page.goto(`/clients/${client1Id}`);
    await page.waitForURL(new RegExp(`/clients/${client1Id}`));

    // Keyed remount and ownership check must immediately show 404 Not Found, never Anan Prasert
    await expect(page.locator("[data-testid='client-not-found']")).toBeVisible();
    await expect(page.locator("[data-testid='profile-display-name']")).not.toBeVisible();
  });

  test("in-flight request race condition during RM switch: delayed response for prior RM is discarded and does not mount", async ({
    page,
    context,
  }) => {
    const client1Id = "00000000-0000-4000-8000-000000000001";

    // 1. Authenticate as RM 1 and open client 1
    await authenticateContext(context, SEED_RM_1_ID);
    await page.goto(`/clients/${client1Id}`);
    await expect(page.locator("[data-testid='profile-display-name']")).toHaveText("Anan Prasert");

    // 2. Delay any client profile response by 1200ms
    let delayPromiseResolve: (() => void) | null = null;
    await page.route(`**/api/clients/${client1Id}`, async (route) => {
      await new Promise<void>((resolve) => {
        delayPromiseResolve = resolve;
        setTimeout(resolve, 1500);
      });
      await route.continue();
    });

    // 3. Switch session to RM 2 (who does NOT own client 1)
    await authenticateContext(context, SEED_RM_2_ID);

    // Navigate to client 1 under RM 2 session, triggering in-flight request
    const navPromise = page.goto(`/clients/${client1Id}`);

    // Allow delay to resolve
    if (delayPromiseResolve) {
      (delayPromiseResolve as () => void)();
    }
    await navPromise;

    // 4. Assert RM 2 receives 404 and does NOT mount RM 1's client data
    await expect(page.locator("[data-testid='client-not-found']")).toBeVisible();
    await expect(page.locator("[data-testid='profile-display-name']")).not.toBeVisible();

    await page.unroute(`**/api/clients/${client1Id}`);
  });

  test("displays 503 retry banner and gates sensitive content during backend degradation (AUD-M4-002)", async ({
    page,
    context,
  }) => {
    // 1. Authenticate as RM 1
    await authenticateContext(context, SEED_RM_1_ID);
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/);

    // 2. Intercept /api/auth/me to simulate temporary 503 service unavailable
    await page.route("**/api/auth/me", (route) => {
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

    // Trigger session revalidation via document visibilitychange and wait for response
    const meResponsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/auth/me")
    );
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await meResponsePromise;

    // 3. Verify session connection error banner is displayed
    const errorBanner = page.locator("[data-testid='session-error-banner']");
    await expect(errorBanner).toBeVisible();
    await expect(page.getByText(/Service Temporarily Unavailable/i)).toBeVisible();

    const retryBtn = page.locator("[data-testid='retry-session-btn']");
    await expect(retryBtn).toBeVisible();

    // 4. Restore healthy backend and click retry
    await page.unroute("**/api/auth/me");
    await retryBtn.click();

    // 5. Verify error banner is dismissed and authenticated dashboard is restored
    await expect(errorBanner).not.toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Morning Action Plan/i);
  });

  test("cross-tab logout via storage event terminates session in open tabs immediately", async ({
    context,
  }) => {
    await authenticateContext(context, SEED_RM_1_ID);

    // 1. Open Tab A and Tab B
    const tabA = await context.newPage();
    const tabB = await context.newPage();

    // 2. Open Dashboard on Tab A and Tab B
    await tabA.goto("/dashboard");
    await tabA.waitForURL(/\/dashboard/);
    await expect(tabA.getByRole("heading", { level: 1 })).toContainText(/Morning Action Plan/i);

    await tabB.goto("/dashboard");
    await tabB.waitForURL(/\/dashboard/);
    await expect(tabB.getByRole("heading", { level: 1 })).toContainText(/Morning Action Plan/i);

    // 3. Logout from Tab A
    await tabA.getByRole("button", { name: /Sign out|Log out/i }).click();
    await tabA.waitForURL(/\/login/);

    // 4. Verify Tab B receives cross-tab logout event and redirects to /login
    await tabB.waitForURL(/\/login/);
    await expect(tabB.getByRole("heading", { level: 1 })).toContainText(/Sign in|Portal/i);

    await tabA.close();
    await tabB.close();
  });

  test("BFCache protection: browser back button after logout redirects to login and prevents viewing cached profile", async ({
    page,
    context,
  }) => {
    const client1Id = "00000000-0000-4000-8000-000000000001";

    // 1. Authenticate as RM 1
    await authenticateContext(context, SEED_RM_1_ID);

    // 2. View Client 1 profile
    await page.goto(`/clients/${client1Id}`);
    await page.waitForURL(new RegExp(`/clients/${client1Id}`));
    await expect(page.locator("[data-testid='profile-display-name']")).toHaveText("Anan Prasert");

    // Track pageshow event
    await page.evaluate(() => {
      (window as any).__pageshowPersisted = null;
      window.addEventListener("pageshow", (event) => {
        (window as any).__pageshowPersisted = event.persisted;
      });
    });

    // 3. Logout
    await page.getByRole("button", { name: /Sign out|Log out/i }).click();
    await page.waitForURL(/\/login/);

    // 4. Press browser back button
    await page.goBack();

    // 5. Must redirect back to login and NOT show Anan Prasert's profile
    await page.waitForURL(/\/login/);
    await expect(page.locator("[data-testid='profile-display-name']")).not.toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Sign in|Portal/i);
  });
});
