import { expect, test } from "@playwright/test";
import { createVerifiedE2EDatabase } from "./support/db-guard.js";
import { authenticateContext, createCrossRmFamilyFixture, E2EFixtureRegistry } from "./support/fixtures.js";
import { resetE2EDatabase } from "./support/seed-e2e.js";
import { SEED_RM_1_ID, SEED_RM_2_ID } from "../backend/src/seed/catalogue.js";

test.describe("Family Graph & Ownership Isolation E2E (M5-009)", () => {
  test.beforeEach(async () => {
    await resetE2EDatabase();
  });

  test("lazy fetches family network on-demand and renders 1-hop relationships", async ({
    page,
    context,
  }) => {
    // 1. Authenticate as RM 1
    await authenticateContext(context, SEED_RM_1_ID);

    // 2. Navigate to Client 1 (Anan Prasert)
    const client1Id = "00000000-0000-4000-8000-000000000001";
    await page.goto(`/clients/${client1Id}`);
    await page.waitForURL(new RegExp(`/clients/${client1Id}`));

    // Before clicking toggle: family content should NOT be in the DOM
    await expect(page.locator("[data-testid='family-content']")).not.toBeVisible();

    // 3. Click toggle button to lazy-fetch family graph
    const familyPromise = page.waitForResponse(
      (res) => res.url().includes(`/api/clients/${client1Id}/family`) && res.request().method() === "GET"
    );

    const toggleBtn = page.locator("[data-testid='toggle-family-btn']");
    await toggleBtn.click();

    const familyRes = await familyPromise;
    expect(familyRes.status()).toBe(200);

    // 4. Verify family content rendered
    await expect(page.locator("[data-testid='family-content']")).toBeVisible();
    await expect(page.locator("[data-testid='family-graph-container']")).toBeVisible();

    // Verify primary node and related nodes in SVG
    await expect(page.locator(`[data-testid='svg-node-${client1Id}']`)).toBeVisible();
    await expect(page.getByText("Relationship List (2)")).toBeVisible();
  });

  test("BR-10 directional inversion rule: correctly inverts PARENT <-> CHILD and preserves SPOUSE/SIBLING", async ({
    page,
    context,
  }) => {
    // 1. Authenticate as RM 1
    await authenticateContext(context, SEED_RM_1_ID);

    // 2. View Client 1 (Anan Prasert - Parent of Client 3 Chalerm)
    const client1Id = "00000000-0000-4000-8000-000000000001";
    await page.goto(`/clients/${client1Id}`);
    await page.waitForURL(new RegExp(`/clients/${client1Id}`));

    const toggleBtn1 = page.locator("[data-testid='toggle-family-btn']");
    await toggleBtn1.click();
    await expect(page.locator("[data-testid='family-content']")).toBeVisible();

    // For Client 1:
    // Relationship to Client 2 (Bussaba) is SPOUSE
    // Relationship to Client 3 (Chalerm) is PARENT
    const list1 = page.locator("[data-testid='family-member-list']");
    await expect(list1).toContainText("SPOUSE");
    await expect(list1).toContainText("PARENT");

    // 3. View Client 3 (Chalerm Prasert - Child of Client 1 Anan)
    const client3Id = "00000000-0000-4000-8000-000000000003";
    await page.goto(`/clients/${client3Id}`);
    await page.waitForURL(new RegExp(`/clients/${client3Id}`));

    const toggleBtn3 = page.locator("[data-testid='toggle-family-btn']");
    await toggleBtn3.click();
    await expect(page.locator("[data-testid='family-content']")).toBeVisible();

    // For Client 3:
    // Relationship to Client 1 is inverted to CHILD!
    // Relationship to Client 4 is SIBLING
    const list3 = page.locator("[data-testid='family-member-list']");
    await expect(list3).toContainText("CHILD");
    await expect(list3).toContainText("SIBLING");
  });

  test("enforces strict RM data ownership: RM 2 client UUID returns 404, and cross-RM relatives are filtered out", async ({
    page,
    context,
  }) => {
    // 1. Authenticate as RM 1
    await authenticateContext(context, SEED_RM_1_ID);

    // 2. Access RM 2's client (Pakorn Panyarat, codeNumber 16) with RM 1 credentials
    const rm2ClientId = "00000000-0000-4000-8000-000000000016";
    await page.goto(`/clients/${rm2ClientId}`);
    await page.waitForURL(new RegExp(`/clients/${rm2ClientId}`));

    // Must return Client Not Found (404)
    await expect(page.locator("[data-testid='client-not-found']")).toBeVisible();
    await expect(page.getByText(/Client Not Found/i)).toBeVisible();

    // Authenticated API check to family endpoint returns 404 (not 200)
    const apiRes = await page.request.get(`/api/clients/${rm2ClientId}/family`);
    expect(apiRes.status()).toBe(404);

    // 3. Test Cross-RM Relationship Privacy Filtering
    const db = await createVerifiedE2EDatabase();
    const registry = new E2EFixtureRegistry();
    const client1Id = "00000000-0000-4000-8000-000000000001";
    const { rm2Client } = await createCrossRmFamilyFixture(db, client1Id, SEED_RM_2_ID, registry);
    await db.$disconnect();

    try {
      // Visit Client 1 profile and open family network
      await page.goto(`/clients/${client1Id}`);
      await page.waitForURL(new RegExp(`/clients/${client1Id}`));

      const toggleBtn = page.locator("[data-testid='toggle-family-btn']");
      await toggleBtn.click();
      await expect(page.locator("[data-testid='family-content']")).toBeVisible();

      // Cross-RM relative must be completely filtered out
      await expect(page.getByText(rm2Client.customerCode)).not.toBeVisible();
      await expect(page.getByText(`${rm2Client.firstName} ${rm2Client.lastName}`)).not.toBeVisible();
      // Relationship count must strictly remain 2 (only the 2 RM 1 relatives)
      await expect(page.getByText("Relationship List (2)")).toBeVisible();
    } finally {
      const cleanupDb = await createVerifiedE2EDatabase();
      await registry.cleanup(cleanupDb);
      await cleanupDb.$disconnect();
    }
  });

  test("purges family graph cache when switching clients (AUD-M4-003)", async ({
    page,
    context,
  }) => {
    // 1. Authenticate as RM 1
    await authenticateContext(context, SEED_RM_1_ID);

    // 2. Open Client 1 and expand family network
    const client1Id = "00000000-0000-4000-8000-000000000001";
    await page.goto(`/clients/${client1Id}`);
    await page.waitForURL(new RegExp(`/clients/${client1Id}`));

    await page.locator("[data-testid='toggle-family-btn']").click();
    await expect(page.locator("[data-testid='family-content']")).toBeVisible();

    // 3. Navigate to Client 2 (Bussaba Prasert) via relative link
    const client2Id = "00000000-0000-4000-8000-000000000002";
    const relativeLink = page.locator(`[data-testid='relative-link-${client2Id}']`);
    await relativeLink.click();
    await page.waitForURL(new RegExp(`/clients/${client2Id}`));

    // 4. Verify family section on Client 2 is unexpanded and does NOT show Client 1's cached nodes
    await expect(page.locator("[data-testid='family-content']")).not.toBeVisible();
    await expect(page.locator(`[data-testid='svg-node-${client1Id}']`)).not.toBeVisible();
  });
});
