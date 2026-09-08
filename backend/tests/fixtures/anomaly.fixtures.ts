import type { PrismaClient } from "@prisma/client";
import {
  createTestClient,
  createTestFinancialProfile,
  createTestGoal,
  createTestRelationship,
  type FixtureRegistry,
  globalFixtureRegistry,
} from "./client.fixtures.js";

export interface AnomalyFixtureResult {
  client: Awaited<ReturnType<typeof createTestClient>>;
  profile?: Awaited<ReturnType<typeof createTestFinancialProfile>> | null;
  goals: Array<Awaited<ReturnType<typeof createTestGoal>>>;
}

/**
 * Anomaly 1: Missing Financial Profile (BR-04.1 / BR-08)
 * Client exists with valid goal, but NO financial profile record.
 */
export async function createMissingProfileFixture(
  prisma: PrismaClient,
  rmId: string,
  registry: FixtureRegistry = globalFixtureRegistry
): Promise<AnomalyFixtureResult> {
  const client = await createTestClient(
    prisma,
    { rmId, customerCode: `ANO-NOPROF-${Date.now()}` },
    registry
  );

  const goal = await createTestGoal(prisma, {
    clientId: client.id,
    targetAmount: "100000.00",
    currentAmount: "25000.00",
    startDate: new Date("2026-01-01"),
    targetDate: new Date("2027-01-01"),
  });

  return { client, profile: null, goals: [goal] };
}

/**
 * Anomaly 2: Incomplete Financial Profile (missing fields)
 * Profile exists with null liquid assets and null monthly income.
 */
export async function createIncompleteProfileFixture(
  prisma: PrismaClient,
  rmId: string,
  registry: FixtureRegistry = globalFixtureRegistry
): Promise<AnomalyFixtureResult> {
  const client = await createTestClient(
    prisma,
    { rmId, customerCode: `ANO-INCOMP-${Date.now()}` },
    registry
  );

  const profile = await createTestFinancialProfile(prisma, {
    clientId: client.id,
    liquidAssets: null,
    monthlyIncome: null,
    monthlyExpense: "20000.00",
    totalAssets: "500000.00",
    totalDebt: "100000.00",
  });

  const goal = await createTestGoal(prisma, {
    clientId: client.id,
    targetAmount: "200000.00",
    currentAmount: "50000.00",
  });

  return { client, profile, goals: [goal] };
}

/**
 * Anomaly 3: Zero Denominator / Zero Expense
 * Monthly expense is 0, making liquidity months calculation invalid.
 */
export async function createZeroExpenseFixture(
  prisma: PrismaClient,
  rmId: string,
  registry: FixtureRegistry = globalFixtureRegistry
): Promise<AnomalyFixtureResult> {
  const client = await createTestClient(
    prisma,
    { rmId, customerCode: `ANO-ZEROEXP-${Date.now()}` },
    registry
  );

  const profile = await createTestFinancialProfile(prisma, {
    clientId: client.id,
    monthlyExpense: "0.00",
    monthlyIncome: "50000.00",
    liquidAssets: "100000.00",
    totalAssets: "500000.00",
    totalDebt: "50000.00",
  });

  const goal = await createTestGoal(prisma, {
    clientId: client.id,
  });

  return { client, profile, goals: [goal] };
}

/**
 * Anomaly 4: No Financial Goals
 * Complete profile exists, but 0 goals are attached.
 */
export async function createNoGoalsFixture(
  prisma: PrismaClient,
  rmId: string,
  registry: FixtureRegistry = globalFixtureRegistry
): Promise<AnomalyFixtureResult> {
  const client = await createTestClient(
    prisma,
    { rmId, customerCode: `ANO-NOGOAL-${Date.now()}` },
    registry
  );

  const profile = await createTestFinancialProfile(prisma, {
    clientId: client.id,
    monthlyIncome: "80000.00",
    monthlyExpense: "30000.00",
    liquidAssets: "200000.00",
    totalAssets: "1500000.00",
    totalDebt: "200000.00",
  });

  return { client, profile, goals: [] };
}

/**
 * Anomaly 5: Cross-RM Family Relationship
 * Creates a relationship linking a client owned by RM1 with a client owned by RM2.
 */
export async function createCrossRmFamilyFixture(
  prisma: PrismaClient,
  rm1ClientId: string,
  rm2ClientId: string,
  registry: FixtureRegistry = globalFixtureRegistry
) {
  return createTestRelationship(
    prisma,
    {
      clientId: rm1ClientId,
      relatedClientId: rm2ClientId,
      relationshipType: "SIBLING",
    },
    registry
  );
}
