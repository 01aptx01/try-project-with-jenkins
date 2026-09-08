import { expect, test } from "@playwright/test";

test.describe("Playwright E2E Smoke Tests (M5-005)", () => {
  test("loads the login page over single-origin Caddy proxy", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/Meridian|Sign in|Portal/i);

    const emailInput = page.getByLabel(/Email/i);
    const passwordInput = page.getByLabel(/Password/i);
    const submitBtn = page.getByRole("button", { name: /Sign in|Log in/i });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();
  });

  test("verifies proxy routing and health endpoint contract", async ({ request }) => {
    const response = await request.get("/health");
    expect(response.ok()).toBe(true);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.version).toMatch(/^[0-9a-f]{40}$/);
  });
});
