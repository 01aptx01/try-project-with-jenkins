import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  buildSeedCatalogue,
  SEED_RM_1_ID,
  SEED_RM_2_ID,
} from "../../../src/seed/catalogue.js";
import { runSeed } from "../../../src/seed/runner.js";
import type { SeedCatalogue } from "../../../src/seed/types.js";
import { hashPassword, verifyPassword } from "../../../src/services/password.service.js";
import { createVerifiedTestDatabase } from "../test-database.js";

describe("Idempotent Seed Runner (M3-008)", () => {
  let database: PrismaClient;
  const asOfDate = "2026-09-08";
  const rm1Password = "Rm1Password123!";
  const rm2Password = "Rm2Password123!";
  let rm1PasswordHash: string;
  let rm2PasswordHash: string;
  let catalogue: SeedCatalogue;

  beforeAll(async () => {
    database = await createVerifiedTestDatabase();
    // Clean up to guarantee pristine baseline
    await database.familyRelationship.deleteMany();
    await database.goal.deleteMany();
    await database.financialProfile.deleteMany();
    await database.client.deleteMany();
    await database.user.deleteMany();

    rm1PasswordHash = await hashPassword(rm1Password);
    rm2PasswordHash = await hashPassword(rm2Password);
    catalogue = buildSeedCatalogue(asOfDate, {
      rm1PasswordHash,
      rm2PasswordHash,
    });
  });

  afterAll(async () => {
    if (database) {
      // Clean up seeded clients & RMs
      const clientIds = catalogue.clients.map((c) => c.id);
      await database.familyRelationship.deleteMany({
        where: {
          OR: [
            { clientId: { in: clientIds } },
            { relatedClientId: { in: clientIds } },
          ],
        },
      });
      await database.goal.deleteMany({
        where: { clientId: { in: clientIds } },
      });
      await database.financialProfile.deleteMany({
        where: { clientId: { in: clientIds } },
      });
      await database.client.deleteMany({
        where: { id: { in: clientIds } },
      });
      await database.user.deleteMany({
        where: { id: { in: [SEED_RM_1_ID, SEED_RM_2_ID] } },
      });
      await database.$disconnect();
    }
  });

  it("persists normal seed catalogue on fresh run and creates all expected records", async () => {
    const result = await runSeed(database, catalogue);

    expect(result.asOfDate).toBe(asOfDate);
    expect(result.counts.rms).toBe(2);
    expect(result.counts.clients).toBe(30);
    expect(result.counts.profiles).toBe(30);
    expect(result.counts.goals).toBeGreaterThanOrEqual(30);
    expect(result.counts.relationships).toBe(8);

    // Verify in database
    const users = await database.user.findMany({
      where: { id: { in: [SEED_RM_1_ID, SEED_RM_2_ID] } },
    });
    expect(users).toHaveLength(2);

    const rm1Clients = await database.client.findMany({
      where: { rmId: SEED_RM_1_ID },
    });
    const rm2Clients = await database.client.findMany({
      where: { rmId: SEED_RM_2_ID },
    });
    expect(rm1Clients).toHaveLength(15);
    expect(rm2Clients).toHaveLength(15);

    const clientIds = catalogue.clients.map((c) => c.id);
    const profiles = await database.financialProfile.findMany({
      where: { clientId: { in: clientIds } },
    });
    expect(profiles).toHaveLength(30);

    const goals = await database.goal.findMany({
      where: { clientId: { in: clientIds } },
    });
    expect(goals.length).toBeGreaterThanOrEqual(30);

    const relationships = await database.familyRelationship.findMany({
      where: { clientId: { in: clientIds } },
    });
    expect(relationships).toHaveLength(8);
  });

  it("is strictly idempotent: running seed a second time causes zero duplicate records or changes", async () => {
    const countsBefore = {
      users: await database.user.count(),
      clients: await database.client.count(),
      profiles: await database.financialProfile.count(),
      goals: await database.goal.count(),
      relationships: await database.familyRelationship.count(),
    };

    // Run seed again
    const result = await runSeed(database, catalogue);
    expect(result.counts.rms).toBe(2);
    expect(result.counts.clients).toBe(30);

    const countsAfter = {
      users: await database.user.count(),
      clients: await database.client.count(),
      profiles: await database.financialProfile.count(),
      goals: await database.goal.count(),
      relationships: await database.familyRelationship.count(),
    };

    expect(countsAfter).toEqual(countsBefore);
  });

  it("verifies RM passwords work with password service for authentication", async () => {
    const rm1 = await database.user.findUnique({
      where: { id: SEED_RM_1_ID },
    });
    const rm2 = await database.user.findUnique({
      where: { id: SEED_RM_2_ID },
    });

    expect(rm1).not.toBeNull();
    expect(rm2).not.toBeNull();

    expect(await verifyPassword(rm1Password, rm1!.passwordHash)).toBe(true);
    expect(await verifyPassword("WrongPassword123!", rm1!.passwordHash)).toBe(false);

    expect(await verifyPassword(rm2Password, rm2!.passwordHash)).toBe(true);
    expect(await verifyPassword("WrongPassword123!", rm2!.passwordHash)).toBe(false);
  });

  it("aborts and rolls back transaction when a collision error occurs", async () => {
    // Attempt to seed a catalogue where RM1 has a different UUID
    // but the same email, colliding with the existing RM1 in the database
    const oldRmId = SEED_RM_1_ID;
    const newRmId = "11111111-1111-4111-8111-999999999999";
    const corruptedCatalogue: SeedCatalogue = {
      ...catalogue,
      rms: catalogue.rms.map((r) => (r.id === oldRmId ? { ...r, id: newRmId } : r)),
      clients: catalogue.clients.map((c) => (c.rmId === oldRmId ? { ...c, rmId: newRmId } : c)),
    };

    await expect(runSeed(database, corruptedCatalogue)).rejects.toThrow(
      /RM email collision/
    );

    // Verify non-existent user with that fake UUID was NOT created (transaction rolled back)
    const fakeUser = await database.user.findUnique({
      where: { id: newRmId },
    });
    expect(fakeUser).toBeNull();
  });
});
