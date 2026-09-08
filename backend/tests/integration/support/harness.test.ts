import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { evaluateClient } from "../../../src/domain/financial/evaluate-client.js";
import { SEED_RM_1_ID, SEED_RM_2_ID } from "../../../src/seed/catalogue.js";
import {
  createIncompleteProfileFixture,
  createMissingProfileFixture,
  createNoGoalsFixture,
  createZeroExpenseFixture,
} from "../../fixtures/anomaly.fixtures.js";
import { assertTestDatabaseUrl } from "../../support/db-guard.js";
import { createTestHarness, type TestHarness } from "../../support/test-harness.js";

describe("Test Harness & Anomaly Fixtures (M3-009)", () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();
    await harness.ensureNormalSeed();
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    }
  });

  it("database guard strictly rejects invalid, development, or wrong-port URLs", () => {
    // Missing URL
    expect(() => assertTestDatabaseUrl(undefined)).toThrow(
      "TEST_DATABASE_URL is required"
    );

    // Matches primary DATABASE_URL
    const devUrl = "postgresql://meridian_dev:password@127.0.0.1:5432/meridian?schema=public";
    expect(() => assertTestDatabaseUrl(devUrl, devUrl)).toThrow(
      "TEST_DATABASE_URL must not equal DATABASE_URL"
    );

    // Wrong port (5432 instead of 5433)
    expect(() =>
      assertTestDatabaseUrl("postgresql://meridian_test:password@localhost:5432/meridian_test")
    ).toThrow(/must use meridian_test@localhost:5433/);

    // Wrong database name
    expect(() =>
      assertTestDatabaseUrl("postgresql://meridian_test:password@localhost:5433/meridian_prod")
    ).toThrow(/must use meridian_test@localhost:5433/);

    // Correct URL passes without error
    expect(() =>
      assertTestDatabaseUrl(
        "postgresql://meridian_test:meridian_test_password@127.0.0.1:5433/meridian_test?schema=public"
      )
    ).not.toThrow();
  });

  it("creates anomaly fixture for missing profile and verifies domain evaluation returns INSUFFICIENT_DATA", async () => {
    const fixture = await createMissingProfileFixture(
      harness.database,
      SEED_RM_1_ID,
      harness.registry
    );

    expect(fixture.client.id).toBeDefined();
    expect(fixture.profile).toBeNull();
    expect(fixture.goals).toHaveLength(1);

    // Evaluate with pure domain
    const evalResult = evaluateClient(
      {
        client: {
          id: fixture.client.id,
          customerCode: fixture.client.customerCode,
        },
        financialProfile: null,
        goals: fixture.goals.map((g) => ({
          id: g.id,
          targetAmount: g.targetAmount.toString(),
          currentAmount: g.currentAmount.toString(),
          startDate: g.startDate.toISOString().slice(0, 10),
          targetDate: g.targetDate.toISOString().slice(0, 10),
        })),
      },
      harness.defaultAsOfDate
    );

    expect(evalResult.health.status).toBe("INSUFFICIENT_DATA");
    expect(evalResult.recommendation.action).toBe("Review Client Data");
    expect(evalResult.recommendation.priority).toBe("MEDIUM");
  });

  it("creates anomaly fixture for incomplete profile and verifies missing fields in domain evaluation", async () => {
    const fixture = await createIncompleteProfileFixture(
      harness.database,
      SEED_RM_1_ID,
      harness.registry
    );

    expect(fixture.profile).not.toBeNull();

    const evalResult = evaluateClient(
      {
        client: {
          id: fixture.client.id,
          customerCode: fixture.client.customerCode,
        },
        financialProfile: fixture.profile
          ? {
              monthlyIncome: fixture.profile.monthlyIncome?.toString() ?? null,
              monthlyExpense: fixture.profile.monthlyExpense?.toString() ?? null,
              liquidAssets: fixture.profile.liquidAssets?.toString() ?? null,
              totalAssets: fixture.profile.totalAssets?.toString() ?? null,
              totalDebt: fixture.profile.totalDebt?.toString() ?? null,
              savings: fixture.profile.savings?.toString() ?? null,
              investments: fixture.profile.investments?.toString() ?? null,
            }
          : null,
        goals: fixture.goals.map((g) => ({
          id: g.id,
          targetAmount: g.targetAmount.toString(),
          currentAmount: g.currentAmount.toString(),
          startDate: g.startDate.toISOString().slice(0, 10),
          targetDate: g.targetDate.toISOString().slice(0, 10),
        })),
      },
      harness.defaultAsOfDate
    );

    expect(evalResult.health.status).toBe("INSUFFICIENT_DATA");
    expect(evalResult.health.missingFields).toContain("financialProfile.liquidAssets");
    expect(evalResult.health.missingFields).toContain("financialProfile.monthlyIncome");
  });

  it("creates anomaly fixture for zero expense and flags missing expense denominator", async () => {
    const fixture = await createZeroExpenseFixture(
      harness.database,
      SEED_RM_1_ID,
      harness.registry
    );

    const evalResult = evaluateClient(
      {
        client: {
          id: fixture.client.id,
          customerCode: fixture.client.customerCode,
        },
        financialProfile: {
          monthlyIncome: fixture.profile!.monthlyIncome!.toString(),
          monthlyExpense: fixture.profile!.monthlyExpense!.toString(),
          liquidAssets: fixture.profile!.liquidAssets!.toString(),
          totalAssets: fixture.profile!.totalAssets!.toString(),
          totalDebt: fixture.profile!.totalDebt!.toString(),
        },
        goals: fixture.goals.map((g) => ({
          id: g.id,
          targetAmount: g.targetAmount.toString(),
          currentAmount: g.currentAmount.toString(),
          startDate: g.startDate.toISOString().slice(0, 10),
          targetDate: g.targetDate.toISOString().slice(0, 10),
        })),
      },
      harness.defaultAsOfDate
    );

    expect(evalResult.health.status).toBe("INSUFFICIENT_DATA");
    expect(evalResult.health.missingFields).toContain("financialProfile.monthlyExpense");
  });

  it("creates anomaly fixture with no goals and flags missing goals in domain evaluation", async () => {
    const fixture = await createNoGoalsFixture(
      harness.database,
      SEED_RM_2_ID,
      harness.registry
    );

    const evalResult = evaluateClient(
      {
        client: {
          id: fixture.client.id,
          customerCode: fixture.client.customerCode,
        },
        financialProfile: {
          monthlyIncome: fixture.profile!.monthlyIncome!.toString(),
          monthlyExpense: fixture.profile!.monthlyExpense!.toString(),
          liquidAssets: fixture.profile!.liquidAssets!.toString(),
          totalAssets: fixture.profile!.totalAssets!.toString(),
          totalDebt: fixture.profile!.totalDebt!.toString(),
        },
        goals: [],
      },
      harness.defaultAsOfDate
    );

    expect(evalResult.health.status).toBe("INSUFFICIENT_DATA");
    expect(evalResult.health.missingFields).toContain("goals");
  });

  it("cleanly removes fixture records during cleanup without touching normal seed records", async () => {
    const seedClientCount = await harness.database.client.count({
      where: {
        customerCode: {
          startsWith: "C-",
        },
      },
    });
    expect(seedClientCount).toBe(30);

    // Clean up fixtures created in this suite
    await harness.cleanupFixtures();

    // Verify fixture records are removed
    const remainingFixtures = await harness.database.client.count({
      where: {
        customerCode: {
          startsWith: "ANO-",
        },
      },
    });
    expect(remainingFixtures).toBe(0);

    // Verify seed records remain untouched
    const postCleanupSeedCount = await harness.database.client.count({
      where: {
        customerCode: {
          startsWith: "C-",
        },
      },
    });
    expect(postCleanupSeedCount).toBe(30);
  });
});
