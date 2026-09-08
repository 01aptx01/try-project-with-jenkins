import type { PrismaClient } from "@prisma/client";
import { SESSION_COOKIE_NAME } from "../../src/config/cookie.js";
import {
  buildSeedCatalogue,
  SEED_RM_1_ID,
  SEED_RM_2_ID,
} from "../../src/seed/catalogue.js";
import { runSeed } from "../../src/seed/runner.js";
import { signSessionToken } from "../../src/services/token.service.js";
import { FixtureRegistry } from "../fixtures/client.fixtures.js";
import { createVerifiedTestDatabase } from "../integration/test-database.js";
import { assertTestDatabaseConnection } from "./db-guard.js";

export interface TestHarness {
  database: PrismaClient;
  registry: FixtureRegistry;
  defaultAsOfDate: string;
  jwtSecret: string;
  ensureNormalSeed: (asOfDate?: string) => Promise<void>;
  createRm1SessionCookie: () => string;
  createRm2SessionCookie: () => string;
  cleanupFixtures: () => Promise<void>;
  close: () => Promise<void>;
}

export async function createTestHarness(): Promise<TestHarness> {
  const database = await createVerifiedTestDatabase();
  await assertTestDatabaseConnection(database);

  const registry = new FixtureRegistry();
  const defaultAsOfDate = "2026-09-08";
  const jwtSecret = process.env.JWT_SECRET || "default_test_secret_for_integration_tests_min_32_bytes";

  const ensureNormalSeed = async (asOfDate: string = defaultAsOfDate): Promise<void> => {
    const existingRms = await database.user.count({
      where: { id: { in: [SEED_RM_1_ID, SEED_RM_2_ID] } },
    });
    const existingClients = await database.client.count();

    if (existingRms < 2 || existingClients < 30) {
      const catalogue = buildSeedCatalogue(asOfDate);
      await runSeed(database, catalogue);
    }
  };

  const createRm1SessionCookie = (): string => {
    const token = signSessionToken(SEED_RM_1_ID, { secret: jwtSecret });
    return `${SESSION_COOKIE_NAME}=${token}`;
  };

  const createRm2SessionCookie = (): string => {
    const token = signSessionToken(SEED_RM_2_ID, { secret: jwtSecret });
    return `${SESSION_COOKIE_NAME}=${token}`;
  };

  const cleanupFixtures = async (): Promise<void> => {
    await registry.cleanup(database);
  };

  const close = async (): Promise<void> => {
    await cleanupFixtures();
    await database.$disconnect();
  };

  return {
    database,
    registry,
    defaultAsOfDate,
    jwtSecret,
    ensureNormalSeed,
    createRm1SessionCookie,
    createRm2SessionCookie,
    cleanupFixtures,
    close,
  };
}
