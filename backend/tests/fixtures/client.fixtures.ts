import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { canonicalizeRelationship } from "../../src/family/relationships.js";

export class FixtureRegistry {
  private clientIds = new Set<string>();
  private userIds = new Set<string>();
  private relationshipIds = new Set<string>();

  registerClient(id: string): void {
    this.clientIds.add(id);
  }

  registerUser(id: string): void {
    this.userIds.add(id);
  }

  registerRelationship(id: string): void {
    this.relationshipIds.add(id);
  }

  getClientIds(): string[] {
    return Array.from(this.clientIds);
  }

  getUserIds(): string[] {
    return Array.from(this.userIds);
  }

  getRelationshipIds(): string[] {
    return Array.from(this.relationshipIds);
  }

  clear(): void {
    this.clientIds.clear();
    this.userIds.clear();
    this.relationshipIds.clear();
  }

  async cleanup(prisma: PrismaClient): Promise<void> {
    const cIds = this.getClientIds();
    const uIds = this.getUserIds();
    const rIds = this.getRelationshipIds();

    if (rIds.length > 0) {
      await prisma.familyRelationship.deleteMany({
        where: { id: { in: rIds } },
      });
    }

    if (cIds.length > 0) {
      // Family relationships involving these clients
      await prisma.familyRelationship.deleteMany({
        where: {
          OR: [
            { clientId: { in: cIds } },
            { relatedClientId: { in: cIds } },
          ],
        },
      });

      // Goals & profiles cascade on client deletion, but delete explicitly for safety
      await prisma.goal.deleteMany({
        where: { clientId: { in: cIds } },
      });
      await prisma.financialProfile.deleteMany({
        where: { clientId: { in: cIds } },
      });
      await prisma.client.deleteMany({
        where: { id: { in: cIds } },
      });
    }

    if (uIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: uIds } },
      });
    }

    this.clear();
  }
}

export const globalFixtureRegistry = new FixtureRegistry();

export async function createTestClient(
  prisma: PrismaClient,
  data: Partial<Prisma.ClientUncheckedCreateInput> & { rmId: string },
  registry: FixtureRegistry = globalFixtureRegistry
) {
  const id = data.id ?? randomUUID();
  const customerCode = data.customerCode ?? `FIX-${randomUUID().slice(0, 8).toUpperCase()}`;

  const client = await prisma.client.create({
    data: {
      id,
      customerCode,
      firstName: data.firstName ?? "Fixture",
      lastName: data.lastName ?? "Client",
      age: data.age ?? 35,
      occupation: data.occupation ?? "Tester",
      riskLevel: data.riskLevel ?? "MEDIUM",
      rmId: data.rmId,
    },
  });

  registry.registerClient(client.id);
  return client;
}

export async function createTestFinancialProfile(
  prisma: PrismaClient,
  data: Partial<Prisma.FinancialProfileUncheckedCreateInput> & { clientId: string }
) {
  const profile = await prisma.financialProfile.create({
    data: {
      id: data.id ?? randomUUID(),
      clientId: data.clientId,
      monthlyIncome: "monthlyIncome" in data ? data.monthlyIncome : "50000.00",
      monthlyExpense: "monthlyExpense" in data ? data.monthlyExpense : "30000.00",
      liquidAssets: "liquidAssets" in data ? data.liquidAssets : "150000.00",
      totalAssets: "totalAssets" in data ? data.totalAssets : "1000000.00",
      totalDebt: "totalDebt" in data ? data.totalDebt : "200000.00",
      savings: "savings" in data ? data.savings : "30000.00",
      investments: "investments" in data ? data.investments : "200000.00",
    },
  });

  return profile;
}

export async function createTestGoal(
  prisma: PrismaClient,
  data: Partial<Prisma.GoalUncheckedCreateInput> & { clientId: string }
) {
  const goal = await prisma.goal.create({
    data: {
      id: data.id ?? randomUUID(),
      clientId: data.clientId,
      goalType: data.goalType ?? "EMERGENCY_FUND",
      targetAmount: data.targetAmount ?? "200000.00",
      currentAmount: data.currentAmount ?? "50000.00",
      startDate: data.startDate ?? new Date("2026-01-01"),
      targetDate: data.targetDate ?? new Date("2027-01-01"),
    },
  });

  return goal;
}

export async function createTestRelationship(
  prisma: PrismaClient,
  data: {
    id?: string;
    clientId: string;
    relatedClientId: string;
    relationshipType: "PARENT" | "CHILD" | "SPOUSE" | "SIBLING";
  },
  registry: FixtureRegistry = globalFixtureRegistry
) {
  const canonical = canonicalizeRelationship(
    data.clientId,
    data.relatedClientId,
    data.relationshipType
  );

  const rel = await prisma.familyRelationship.create({
    data: {
      id: data.id ?? randomUUID(),
      clientId: canonical.clientId,
      relatedClientId: canonical.relatedClientId,
      relationshipType: canonical.relationshipType,
    },
  });

  registry.registerRelationship(rel.id);
  return rel;
}

