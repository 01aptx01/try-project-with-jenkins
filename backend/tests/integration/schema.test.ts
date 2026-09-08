import { createVerifiedTestDatabase } from "./test-database.js";
import { randomUUID } from "node:crypto";

describe("integration test database", () => {
  it("is the isolated database and has the committed schema", async () => {
    const database = await createVerifiedTestDatabase();
    try {
      const rows = await database.$queryRawUnsafe("SELECT to_regclass('public.users')::text AS relation") as Array<{ relation: string | null }>;
      expect(rows[0]?.relation).toBe("users");
    } finally {
      await database.$disconnect();
    }
  });

  it("enforces financial, goal and canonical family constraints", async () => {
    const database = await createVerifiedTestDatabase();
    const suffix = randomUUID();
    let rmId: string | undefined;
    let firstClientId: string | undefined;
    let secondClientId: string | undefined;

    try {
      const rm = await database.user.create({ data: { email: `integration-${suffix}@example.test`, passwordHash: "not-a-password", name: "Integration RM" } });
      rmId = rm.id;
      const firstClient = await database.client.create({ data: { customerCode: `TEST-${suffix}-A`, firstName: "First", lastName: "Client", riskLevel: "LOW", rmId } });
      const secondClient = await database.client.create({ data: { customerCode: `TEST-${suffix}-B`, firstName: "Second", lastName: "Client", riskLevel: "MEDIUM", rmId } });
      firstClientId = firstClient.id;
      secondClientId = secondClient.id;
      if (!firstClientId || !secondClientId) throw new Error("Test clients were not created");

      await expect(database.financialProfile.create({ data: { clientId: firstClientId, monthlyIncome: -1 } })).rejects.toThrow();
      await expect(database.goal.create({ data: { clientId: firstClientId, goalType: "OTHER", targetAmount: 0, currentAmount: 0, startDate: new Date("2026-01-02"), targetDate: new Date("2026-01-01") } })).rejects.toThrow();

      const sortedClientIds = [firstClientId, secondClientId].sort();
      const clientId = sortedClientIds[0]!;
      const relatedClientId = sortedClientIds[1]!;
      await database.familyRelationship.create({ data: { clientId, relatedClientId, relationshipType: "SIBLING" } });
      await expect(database.familyRelationship.create({ data: { clientId, relatedClientId, relationshipType: "SIBLING" } })).rejects.toThrow();
      await expect(database.familyRelationship.create({ data: { clientId: relatedClientId, relatedClientId: clientId, relationshipType: "SIBLING" } })).rejects.toThrow();
    } finally {
      if (firstClientId) await database.client.delete({ where: { id: firstClientId } });
      if (secondClientId) await database.client.delete({ where: { id: secondClientId } });
      if (rmId) await database.user.delete({ where: { id: rmId } });
      await database.$disconnect();
    }
  });
});
