import type { PrismaClient } from "@prisma/client";
import type { SeedCatalogue } from "./types.js";
import { validateSeedCatalogue } from "./validator.js";

export interface SeedResult {
  asOfDate: string;
  counts: {
    rms: number;
    clients: number;
    profiles: number;
    goals: number;
    relationships: number;
  };
}

export async function runSeed(
  prisma: PrismaClient,
  catalogue: SeedCatalogue
): Promise<SeedResult> {
  const report = validateSeedCatalogue(catalogue);
  if (!report.isValid) {
    throw new Error(
      `Seed catalogue validation failed:\n${report.errors.map((e) => `  - ${e}`).join("\n")}`
    );
  }

  await prisma.$transaction(
    async (tx) => {
      // 1. Upsert RMs
      for (const rm of catalogue.rms) {
        // Check for potential collision with an existing non-matching record
        const existingByEmail = await tx.user.findUnique({
          where: { email: rm.email },
        });
        if (existingByEmail && existingByEmail.id !== rm.id) {
          throw new Error(
            `RM email collision: ${rm.email} belongs to user ${existingByEmail.id}, expected ${rm.id}`
          );
        }

        await tx.user.upsert({
          where: { id: rm.id },
          update: {
            email: rm.email,
            name: rm.name,
            role: rm.role,
            passwordHash: rm.passwordHash,
          },
          create: {
            id: rm.id,
            email: rm.email,
            name: rm.name,
            role: rm.role,
            passwordHash: rm.passwordHash,
          },
        });
      }

      // 2. Upsert Clients
      for (const client of catalogue.clients) {
        const existingByCode = await tx.client.findUnique({
          where: { customerCode: client.customerCode },
        });
        if (existingByCode && existingByCode.id !== client.id) {
          throw new Error(
            `Customer code collision: ${client.customerCode} belongs to client ${existingByCode.id}, expected ${client.id}`
          );
        }

        await tx.client.upsert({
          where: { id: client.id },
          update: {
            customerCode: client.customerCode,
            firstName: client.firstName,
            lastName: client.lastName,
            age: client.age,
            occupation: client.occupation,
            riskLevel: client.riskLevel,
            rmId: client.rmId,
          },
          create: {
            id: client.id,
            customerCode: client.customerCode,
            firstName: client.firstName,
            lastName: client.lastName,
            age: client.age,
            occupation: client.occupation,
            riskLevel: client.riskLevel,
            rmId: client.rmId,
          },
        });
      }

      // 3. Upsert Financial Profiles
      for (const profile of catalogue.profiles) {
        await tx.financialProfile.upsert({
          where: { clientId: profile.clientId },
          update: {
            monthlyIncome: profile.monthlyIncome,
            monthlyExpense: profile.monthlyExpense,
            liquidAssets: profile.liquidAssets,
            totalAssets: profile.totalAssets,
            totalDebt: profile.totalDebt,
            savings: profile.savings,
            investments: profile.investments,
          },
          create: {
            id: profile.id,
            clientId: profile.clientId,
            monthlyIncome: profile.monthlyIncome,
            monthlyExpense: profile.monthlyExpense,
            liquidAssets: profile.liquidAssets,
            totalAssets: profile.totalAssets,
            totalDebt: profile.totalDebt,
            savings: profile.savings,
            investments: profile.investments,
          },
        });
      }

      // 4. Upsert Goals
      for (const goal of catalogue.goals) {
        await tx.goal.upsert({
          where: { id: goal.id },
          update: {
            clientId: goal.clientId,
            goalType: goal.goalType,
            targetAmount: goal.targetAmount,
            currentAmount: goal.currentAmount,
            startDate: new Date(goal.startDate),
            targetDate: new Date(goal.targetDate),
          },
          create: {
            id: goal.id,
            clientId: goal.clientId,
            goalType: goal.goalType,
            targetAmount: goal.targetAmount,
            currentAmount: goal.currentAmount,
            startDate: new Date(goal.startDate),
            targetDate: new Date(goal.targetDate),
          },
        });
      }

      // 5. Upsert Family Relationships
      for (const rel of catalogue.relationships) {
        await tx.familyRelationship.upsert({
          where: {
            clientId_relatedClientId: {
              clientId: rel.clientId,
              relatedClientId: rel.relatedClientId,
            },
          },
          update: {
            relationshipType: rel.relationshipType,
          },
          create: {
            id: rel.id,
            clientId: rel.clientId,
            relatedClientId: rel.relatedClientId,
            relationshipType: rel.relationshipType,
          },
        });
      }
    },
    {
      timeout: 30000,
    }
  );

  return {
    asOfDate: catalogue.asOfDate,
    counts: {
      rms: catalogue.rms.length,
      clients: catalogue.clients.length,
      profiles: catalogue.profiles.length,
      goals: catalogue.goals.length,
      relationships: catalogue.relationships.length,
    },
  };
}
