import { expect, test } from "@playwright/test";
import { authenticateContext, SEED_RM_1_ID } from "./support/fixtures.js";
import { resetE2EDatabase } from "./support/seed-e2e.js";

function computeStats(samples: number[]) {
  if (!samples.length || samples.some((n) => !Number.isFinite(n))) throw new Error("Invalid samples");
  const sorted = [...samples].sort((a, b) => a - b);
  const min = Math.round(sorted[0]! * 100) / 100;
  const max = Math.round(sorted[sorted.length - 1]! * 100) / 100;
  const p50 = Math.round(sorted[Math.ceil(sorted.length * 0.5) - 1]! * 100) / 100;
  const p95 = Math.round(sorted[Math.ceil(sorted.length * 0.95) - 1]! * 100) / 100;
  const avg = Math.round((sorted.reduce((a, b) => a + b, 0) / sorted.length) * 100) / 100;
  return { min, p50, p95, max, avg };
}

test.describe("Usability & Performance Baselines E2E (M5-012)", () => {
  test.beforeEach(async () => {
    await resetE2EDatabase();
  });

  test("usability: responsive layouts at 1280x720, 1440x900, and layout reflow at 640x480 (emulating 200% zoom)", async ({
    page,
    context,
  }) => {
    await authenticateContext(context, SEED_RM_1_ID);

    const viewports = [
      { name: "Desktop Standard", width: 1280, height: 720 },
      { name: "Laptop Standard", width: 1440, height: 900 },
      { name: "200% Zoom Reflow Emulation", width: 640, height: 480 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/clients");
      await page.waitForURL(/\/clients/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Client Directory");

      // Verify no horizontal document overflow on main container
      const hasHorizontalScroll = await page.evaluate(() => {
        const docEl = document.documentElement;
        return docEl.scrollWidth > docEl.clientWidth;
      });
      expect(hasHorizontalScroll).toBe(false);

      // Verify Client table is visible
      await expect(page.locator("table")).toBeVisible();
    }
  });

  test("usability: keyboard navigation and full tab key traversal", async ({
    page,
    context,
  }) => {
    await authenticateContext(context, SEED_RM_1_ID);

    await page.goto("/clients");
    await page.waitForURL(/\/clients/);
    await expect(page.locator("tbody tr").first()).toBeVisible();

    // Tab 1: Skip to main content link
    await page.keyboard.press("Tab");
    await expect(page.locator(".skip-link")).toBeFocused();

    // Tab 2: Logo link (Meridian)
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: /^Meridian$/i })).toBeFocused();

    // Tab 3: Nav link (Morning Action Plan)
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: /Morning Action Plan/i })).toBeFocused();

    // Tab 4: Nav link (Clients)
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: /^Clients$/i })).toBeFocused();

    // Tab 5: Sign out button
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /Sign out/i })).toBeFocused();

    // Tab 6: Search input in main content
    await page.keyboard.press("Tab");
    const searchInput = page.locator("#client-search-input");
    await expect(searchInput).toBeFocused();

    // Tab 7: Search submit button
    await page.keyboard.press("Tab");
    const searchBtn = page.locator("#client-search-submit");
    await expect(searchBtn).toBeFocused();

    // Tab 8: Priority filter select
    await page.keyboard.press("Tab");
    const prioritySelect = page.locator("#client-priority-filter");
    await expect(prioritySelect).toBeFocused();
  });

  test("performance baseline: collects 30 samples per flow and validates NFR-02 latency budgets", async ({
    page,
    context,
  }) => {
    test.setTimeout(90000);

    await authenticateContext(context, SEED_RM_1_ID);
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/);

    const client1Id = "00000000-0000-4000-8000-000000000001";
    const SAMPLES = 30;

    // Warm-up (5 cycles for API and Page Navigation)
    for (let i = 0; i < 5; i++) {
      await page.request.get("/api/dashboard/morning-action-plan");
      await page.request.get("/api/clients?page=1&pageSize=20");
      await page.request.get(`/api/clients/${client1Id}`);
      await page.goto("/clients");
      await page.waitForSelector("table tbody tr");
    }

    // Measurement 1: Dashboard API (30 samples)
    const dashboardSamples: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const t0 = performance.now();
      const res = await page.request.get("/api/dashboard/morning-action-plan");
      const duration = performance.now() - t0;
      expect(res.status()).toBe(200);
      dashboardSamples.push(duration);
    }

    // Measurement 2: Client Directory API (30 samples)
    const clientListSamples: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const t0 = performance.now();
      const res = await page.request.get("/api/clients?page=1&pageSize=20");
      const duration = performance.now() - t0;
      expect(res.status()).toBe(200);
      clientListSamples.push(duration);
    }

    // Measurement 3: Client Profile Snapshot API (30 samples)
    const profileSamples: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const t0 = performance.now();
      const res = await page.request.get(`/api/clients/${client1Id}`);
      const duration = performance.now() - t0;
      expect(res.status()).toBe(200);
      profileSamples.push(duration);
    }

    // Measurement 4: Page Navigation Time-to-Ready (Client Directory) (30 samples)
    const pageNavSamples: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const t0 = performance.now();
      await page.goto("/clients");
      await page.waitForSelector("table tbody tr");
      const duration = performance.now() - t0;
      pageNavSamples.push(duration);
    }

    const dashboardStats = computeStats(dashboardSamples);
    const clientListStats = computeStats(clientListSamples);
    const profileStats = computeStats(profileSamples);
    const pageNavStats = computeStats(pageNavSamples);

    const report = {
      environment: "Local Windows 11 loopback measurement (not cloud production baseline)",
      samplesCount: SAMPLES,
      metrics: {
        dashboardApiMs: dashboardStats,
        clientListApiMs: clientListStats,
        profileSnapshotApiMs: profileStats,
        clientDirectoryPageMs: pageNavStats,
      },
    };

    console.log("[PERFORMANCE_BASELINE_REPORT]", JSON.stringify(report, null, 2));

    // Assert NFR-02 thresholds: API p95 < 500ms, Page Load p95 < 2000ms
    expect(dashboardStats.p95).toBeLessThan(500);
    expect(clientListStats.p95).toBeLessThan(500);
    expect(profileStats.p95).toBeLessThan(500);
    expect(pageNavStats.p95).toBeLessThan(2000);
  });
});
