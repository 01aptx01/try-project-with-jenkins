import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  assertE2EDatabaseUrl,
  createVerifiedE2EDatabase,
  EXPECTED_E2E_DB_NAME,
  EXPECTED_E2E_PORT,
  EXPECTED_E2E_USER,
} from "../../../e2e/support/db-guard.js";
import {
  createCrossRmFamilyFixture,
  createIncompleteProfileFixture,
  createPaginationFixtures,
  E2EFixtureRegistry,
} from "../../../e2e/support/fixtures.js";
import { resetE2EDatabase } from "../../../e2e/support/seed-e2e.js";
import { SEED_RM_1_ID, SEED_RM_2_ID } from "../../src/seed/catalogue.js";

describe("E2E Database Isolation & Fixtures (M5-003)", () => {
  let e2ePrisma: PrismaClient;

  beforeAll(async () => {
    e2ePrisma = await createVerifiedE2EDatabase();
  });

  afterAll(async () => {
    if (e2ePrisma) {
      await e2ePrisma.$disconnect();
    }
  });

  it("E2E database guard strictly rejects invalid, development, or wrong-port URLs", () => {
    // 1. Missing URL
    expect(() => assertE2EDatabaseUrl(undefined)).toThrow(
      "E2E_DATABASE_URL is required"
    );

    // 2. Matches primary DATABASE_URL or TEST_DATABASE_URL
    const devUrl = "postgresql://meridian_dev:meridian_dev_password@127.0.0.1:5432/meridian?schema=public";
    const testUrl = "postgresql://meridian_test:meridian_test_password@127.0.0.1:5433/meridian_test?schema=public";
    expect(() => assertE2EDatabaseUrl(devUrl, [devUrl, testUrl])).toThrow(
      "E2E_DATABASE_URL must not equal DATABASE_URL or TEST_DATABASE_URL"
    );

    // 3. Wrong port (5432 instead of 5544)
    expect(() =>
      assertE2EDatabaseUrl(
        "postgresql://meridian_e2e:meridian_e2e_password@127.0.0.1:5432/meridian_e2e"
      )
    ).toThrow(new RegExp(`must strictly use ${EXPECTED_E2E_USER}@127.0.0.1:${EXPECTED_E2E_PORT}`));

    // 4. Wrong database name
    expect(() =>
      assertE2EDatabaseUrl(
        "postgresql://meridian_e2e:meridian_e2e_password@127.0.0.1:5544/meridian"
      )
    ).toThrow(new RegExp(`must strictly use ${EXPECTED_E2E_USER}@127.0.0.1:${EXPECTED_E2E_PORT}`));

    // 5. Wrong user
    expect(() =>
      assertE2EDatabaseUrl(
        "postgresql://meridian_dev:password@127.0.0.1:5544/meridian_e2e"
      )
    ).toThrow(new RegExp(`must strictly use ${EXPECTED_E2E_USER}@127.0.0.1:${EXPECTED_E2E_PORT}`));

    // 6. Valid E2E URL passes
    const validUrl = "postgresql://meridian_e2e:meridian_e2e_password@127.0.0.1:5544/meridian_e2e?schema=public";
    expect(assertE2EDatabaseUrl(validUrl, [devUrl, testUrl])).toBe(validUrl);
  });

  it("connects to E2E database and confirms identity is strictly meridian_e2e", async () => {
    const rows = (await e2ePrisma.$queryRaw`SELECT current_database() AS "dbName"`) as Array<{
      dbName: string;
    }>;
    expect(rows[0]?.dbName).toBe(EXPECTED_E2E_DB_NAME);
  });

  it("resets and seeds E2E database twice with identical idempotent results", async () => {
    const run1 = await resetE2EDatabase();
    expect(run1.counts.rms).toBe(2);
    expect(run1.counts.clients).toBe(30);
    expect(run1.counts.profiles).toBe(30);
    expect(run1.counts.goals).toBe(30);
    expect(run1.counts.relationships).toBe(8);

    const run2 = await resetE2EDatabase();
    expect(run2.counts).toEqual(run1.counts);

    // Verify in database
    const rmCount = await e2ePrisma.user.count();
    const clientCount = await e2ePrisma.client.count();
    expect(rmCount).toBe(2);
    expect(clientCount).toBe(30);
  });

  it("creates pagination fixture with >20 clients for RM 1 and cleans up without touching normal seed", async () => {
    const registry = new E2EFixtureRegistry();

    // Initial RM 1 client count is 15
    const initialRm1Count = await e2ePrisma.client.count({
      where: { rmId: SEED_RM_1_ID },
    });
    expect(initialRm1Count).toBe(15);

    // Create pagination fixtures (adds 10 clients)
    const { extraClients, boundaryHighClient } = await createPaginationFixtures(
      e2ePrisma,
      SEED_RM_1_ID,
      registry
    );

    expect(extraClients).toHaveLength(10);
    expect(boundaryHighClient.riskLevel).toBe("HIGH");

    const totalRm1Count = await e2ePrisma.client.count({
      where: { rmId: SEED_RM_1_ID },
    });
    expect(totalRm1Count).toBe(25); // > 20 for pagination

    // Cleanup registry
    await registry.cleanup(e2ePrisma);

    const restoredRm1Count = await e2ePrisma.client.count({
      where: { rmId: SEED_RM_1_ID },
    });
    expect(restoredRm1Count).toBe(15);
  });

  it("creates anomaly and cross-RM fixtures and cleans them up cleanly", async () => {
    const registry = new E2EFixtureRegistry();

    // Incomplete profile
    const { client: incompleteClient, profile: incompleteProfile } =
      await createIncompleteProfileFixture(e2ePrisma, SEED_RM_1_ID, registry);
    expect(incompleteProfile.monthlyIncome).toBeNull();
    expect(incompleteProfile.liquidAssets).toBeNull();

    // Cross-RM relationship
    const { rm2Client, relationship } = await createCrossRmFamilyFixture(
      e2ePrisma,
      incompleteClient.id,
      undefined,
      registry
    );
    expect(rm2Client.rmId).toBe(SEED_RM_2_ID);
    expect(relationship.relationshipType).toBe("SIBLING");

    // Total clients increased by 2
    const currentTotal = await e2ePrisma.client.count();
    expect(currentTotal).toBe(32);

    // Clean up
    await registry.cleanup(e2ePrisma);

    const postCleanupTotal = await e2ePrisma.client.count();
    expect(postCleanupTotal).toBe(30);
  });
});
