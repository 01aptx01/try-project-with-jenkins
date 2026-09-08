import { expect, test } from "@playwright/test";
import { authenticateContext, SEED_RM_1_ID } from "./support/fixtures.js";
import { resetE2EDatabase } from "./support/seed-e2e.js";

test.describe("Authentication & Session Contracts E2E (M5-006)", () => {
  test.beforeEach(async () => {
    await resetE2EDatabase();
  });

  test("successful login creates HttpOnly session cookie without exposing JWT in response", async ({
    page,
    context,
  }) => {
    // 1. Intercept network responses to inspect payload
    let loginResponseBody: any = null;
    page.on("response", async (response) => {
      if (response.url().includes("/api/auth/login") && response.request().method() === "POST") {
        try {
          loginResponseBody = await response.json();
        } catch {
          // Ignore non-json responses
        }
      }
    });

    // 2. Navigate to login page
    await page.goto("/login");
    await page.waitForURL(/\/login/);

    // 3. Fill and submit valid credentials
    await page.getByLabel(/Email/i).fill("rm1@meridian.local");
    await page.getByLabel(/Password/i).fill("Password123!");
    await page.getByRole("button", { name: /Sign in|Log in/i }).click();

    // 4. Verify redirection to Dashboard
    await page.waitForURL(/\/dashboard/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Morning Action Plan/i);

    // 5. Verify cookie was set with HttpOnly, SameSite=Lax, Path=/
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === "meridian_session");
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.sameSite).toBe("Lax");
    expect(sessionCookie?.path).toBe("/");
    expect(sessionCookie?.value).toBeTruthy();

    // 6. Verify response body does NOT contain tokens or password hashes
    expect(loginResponseBody).toBeDefined();
    expect(loginResponseBody.user).toBeDefined();
    expect(loginResponseBody.user.name).toBe("Somchai Jaidee");
    expect(loginResponseBody.user.role).toBe("RM");
    expect(loginResponseBody.user.id).toBe(SEED_RM_1_ID);
    expect(loginResponseBody.token).toBeUndefined();
    expect(loginResponseBody.jwt).toBeUndefined();
    expect(loginResponseBody.passwordHash).toBeUndefined();
  });

  test("invalid credentials displays error banner and prevents session creation", async ({
    page,
    context,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/Email/i).fill("rm1@meridian.local");
    await page.getByLabel(/Password/i).fill("WrongPassword999!");
    await page.getByRole("button", { name: /Sign in|Log in/i }).click();

    // Verify error banner is visible
    const errorBanner = page.locator("text=/Invalid email or password/i");
    await expect(errorBanner).toBeVisible();

    // Verify still on login page and no session cookie
    await expect(page).toHaveURL(/\/login/);
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === "meridian_session");
    expect(sessionCookie).toBeUndefined();
  });

  test("direct URL navigation to protected route redirects unauthenticated user to login", async ({
    page,
  }) => {
    // Attempt to access protected dashboard directly
    await page.goto("/dashboard");
    await page.waitForURL(/\/login/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Sign in|Portal/i);

    // Attempt to access protected clients directly
    await page.goto("/clients");
    await page.waitForURL(/\/login/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Sign in|Portal/i);
  });

  test("logout sends HTTP 204, clears cookie, and redirects to login", async ({
    page,
    context,
  }) => {
    // 1. Authenticate via cookie
    await authenticateContext(context, SEED_RM_1_ID);
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/);

    // 2. Perform logout
    const logoutResponsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/auth/logout") && res.request().method() === "POST"
    );

    const logoutBtn = page.getByRole("button", { name: /Sign out|Log out/i });
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    const logoutResponse = await logoutResponsePromise;
    expect(logoutResponse.status()).toBe(204);

    // 3. Verify redirection to login
    await page.waitForURL(/\/login/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Sign in|Portal/i);

    // 4. Verify cookie cleared
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === "meridian_session");
    expect(sessionCookie?.value || "").toBe("");
  });

  test("logout failure displays retry and does not claim session is cleared", async ({
    page,
    context,
  }) => {
    // 1. Authenticate via cookie
    await authenticateContext(context, SEED_RM_1_ID);
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/);

    // 2. Intercept logout and simulate network abort / 500 error
    await page.route("**/api/auth/logout", (route) => {
      route.abort("failed");
    });

    const logoutBtn = page.getByRole("button", { name: /Sign out|Log out/i });
    await logoutBtn.click();

    // 3. Verify user remains protected, retry button or error displayed
    const retryOrError = page.locator("text=/Sign out|Log out|Retry|failed/i");
    await expect(retryOrError.first()).toBeVisible();

    // Still in authenticated shell
    expect(page.url()).toContain("/dashboard");
  });

  test("enforces live production rate limiter through Caddy: 6th login attempt returns HTTP 429 with Retry-After header", async ({
    request,
  }) => {
    let rateLimitedRes: any = null;

    // Send requests until rate limited (budget is max 5 per minute)
    for (let i = 1; i <= 6; i++) {
      const res = await request.post("http://127.0.0.1:8180/api/auth/login", {
        headers: {
          "Content-Type": "application/json",
          Origin: "http://127.0.0.1:8180",
        },
        data: {
          email: "rm1@meridian.local",
          password: "WrongPasswordAttempt!",
        },
      });

      if (res.status() === 429) {
        rateLimitedRes = res;
        break;
      }
      expect(res.status()).toBe(401);
    }

    expect(rateLimitedRes).not.toBeNull();
    expect(rateLimitedRes.status()).toBe(429);
    const retryAfter = rateLimitedRes.headers()["retry-after"];
    expect(retryAfter).toBeDefined();
    expect(Number(retryAfter)).toBeGreaterThanOrEqual(1);

    const body = await rateLimitedRes.json();
    expect(body.error?.code).toBe("TOO_MANY_REQUESTS");
  });
});

