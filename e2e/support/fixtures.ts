import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { BrowserContext } from "@playwright/test";
import { canonicalizeRelationship } from "../../backend/src/family/relationships.js";
import { SEED_RM_1_ID, SEED_RM_2_ID } from "../../backend/src/seed/catalogue.js";
import { signSessionToken } from "../../backend/src/services/token.service.js";

export { SEED_RM_1_ID, SEED_RM_2_ID };

export const DEFAULT_DEV_JWT_SECRET = "xjY5eR1eUVtkUaXjTV4yqAFjhMpt+rDuKUEM3Ucqf/I=";

export const E2E_SEEDED_USERS = {
  rm1: {
    id: SEED_RM_1_ID,
    email: "rm1@meridian.local",
    name: "Somchai Jaidee",
    role: "RM",
  },
  rm2: {
    id: SEED_RM_2_ID,
    email: "rm2@meridian.local",
    name: "Wichai Wong",
    role: "RM",
  },
};

export function createSessionCookie(
  userId: string = SEED_RM_1_ID,
  secret: string = process.env.JWT_SECRET || DEFAULT_DEV_JWT_SECRET
) {
  const token = signSessionToken(userId, { secret });
  return {
    name: "meridian_session",
    value: token,
    domain: "127.0.0.1",
    path: "/",
    httpOnly: true,
    sameSite: "Lax" as const,
  };
}

export function createAuthHeaders(
  userId: string = SEED_RM_1_ID,
  secret: string = process.env.JWT_SECRET || DEFAULT_DEV_JWT_SECRET
) {
  const token = signSessionToken(userId, { secret });
  return {
    Cookie: `meridian_session=${token}`,
  };
}

export async function authenticateContext(
  context: BrowserContext,
  userId: string = SEED_RM_1_ID,
  secret: string = process.env.JWT_SECRET || DEFAULT_DEV_JWT_SECRET
): Promise<void> {
  const cookie = createSessionCookie(userId, secret);
  await context.addCookies([cookie]);
}

export class E2EFixtureRegistry {
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
    const rIds = this.getRelationshipIds();
    const cIds = this.getClientIds();
    const uIds = this.getUserIds();

    if (rIds.length > 0) {
      await prisma.familyRelationship.deleteMany({
        where: { id: { in: rIds } },
      });
    }

    if (cIds.length > 0) {
      await prisma.familyRelationship.deleteMany({
        where: {
          OR: [
            { clientId: { in: cIds } },
            { relatedClientId: { in: cIds } },
          ],
        },
      });
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

export const globalE2ERegistry = new E2EFixtureRegistry();

/**
 * Creates a test client tracked in E2EFixtureRegistry
 */
export async function createE2ETestClient(
  prisma: PrismaClient,
  data: Partial<Prisma.ClientUncheckedCreateInput> & { rmId: string },
  registry: E2EFixtureRegistry = globalE2ERegistry
) {
  const id = data.id ?? randomUUID();
  const customerCode = data.customerCode ?? `E2E-${randomUUID().slice(0, 8).toUpperCase()}`;

  const client = await prisma.client.create({
    data: {
      id,
      customerCode,
      firstName: data.firstName ?? "E2E",
      lastName: data.lastName ?? "Client",
      age: data.age ?? 38,
      occupation: data.occupation ?? "Professional",
      riskLevel: data.riskLevel ?? "MEDIUM",
      rmId: data.rmId,
    },
  });

  registry.registerClient(client.id);
  return client;
}

/**
 * Pagination Fixture:
 * Creates extra clients for RM 1 so RM 1 has >20 clients (normal seed has 15, adding 10 brings total to 25).
 * The last client is given Priority HIGH and a distinctive name/code to test pagination order & boundary.
 */
export async function createPaginationFixtures(
  prisma: PrismaClient,
  rmId: string = SEED_RM_1_ID,
  registry: E2EFixtureRegistry = globalE2ERegistry
) {
  const createdClients = [];
  for (let i = 1; i <= 9; i++) {
    const client = await createE2ETestClient(
      prisma,
      {
        rmId,
        customerCode: `PAG-EXTRA-${String(i).padStart(2, "0")}`,
        firstName: `PagExtra${i}`,
        lastName: `Client`,
        riskLevel: "LOW",
      },
      registry
    );
    await prisma.financialProfile.create({
      data: {
        id: randomUUID(),
        clientId: client.id,
        monthlyIncome: "60000.00",
        monthlyExpense: "30000.00",
        liquidAssets: "200000.00",
        totalAssets: "1500000.00",
        totalDebt: "100000.00",
        savings: "50000.00",
        investments: "300000.00",
      },
    });
    createdClients.push(client);
  }

  // 10th extra client: HIGH priority boundary client placed at the end
  const boundaryHighClient = await createE2ETestClient(
    prisma,
    {
      rmId,
      customerCode: `PAG-HIGH-LAST`,
      firstName: `ZetaLastHigh`,
      lastName: `BoundaryClient`,
      riskLevel: "HIGH",
    },
    registry
  );

  // Financial profile with high debt ratio -> triggers high priority
  await prisma.financialProfile.create({
    data: {
      id: randomUUID(),
      clientId: boundaryHighClient.id,
      monthlyIncome: "40000.00",
      monthlyExpense: "38000.00",
      liquidAssets: "10000.00",
      totalAssets: "500000.00",
      totalDebt: "450000.00",
      savings: "5000.00",
      investments: "10000.00",
    },
  });
  createdClients.push(boundaryHighClient);

  // Complete Goals: HIGH must come from financial rules, not missing data.
  for (const client of createdClients) {
    await prisma.goal.create({ data: {
      clientId: client.id, goalType: "OTHER", targetAmount: "10000.00",
      currentAmount: "10000.00", startDate: new Date("2025-01-01T00:00:00Z"),
      targetDate: new Date("2027-01-01T00:00:00Z"),
    } });
  }
  return {
    extraClients: createdClients,
    boundaryHighClient,
  };
}

/**
 * Anomaly Fixture:
 * Incomplete profile with null fields (returns INSUFFICIENT_DATA)
 */
export async function createIncompleteProfileFixture(
  prisma: PrismaClient,
  rmId: string = SEED_RM_1_ID,
  registry: E2EFixtureRegistry = globalE2ERegistry
) {
  const client = await createE2ETestClient(
    prisma,
    {
      rmId,
      customerCode: `E2E-INCOMP-${Date.now().toString().slice(-6)}`,
      firstName: "Incomplete",
      lastName: "ProfileClient",
    },
    registry
  );

  const profile = await prisma.financialProfile.create({
    data: {
      id: randomUUID(),
      clientId: client.id,
      monthlyIncome: null,
      monthlyExpense: "25000.00",
      liquidAssets: null,
      totalAssets: null,
      totalDebt: "100000.00",
      savings: "10000.00",
      investments: null,
    },
  });

  return { client, profile };
}

/**
 * Cross-RM Family Relationship Fixture:
 * Creates a client assigned to RM 2, and creates a family relationship to a client of RM 1.
 * When RM 1 views family graph, this relative must be filtered out and never visible.
 */
export async function createCrossRmFamilyFixture(
  prisma: PrismaClient,
  rm1ClientId: string,
  rm2Id: string = SEED_RM_2_ID,
  registry: E2EFixtureRegistry = globalE2ERegistry
) {
  const rm2Client = await createE2ETestClient(
    prisma,
    {
      rmId: rm2Id,
      customerCode: `CROSS-RM2-${Date.now().toString().slice(-6)}`,
      firstName: "SecretRelative",
      lastName: "OfRM2",
    },
    registry
  );

  const canonical = canonicalizeRelationship(rm1ClientId, rm2Client.id, "SIBLING");
  const rel = await prisma.familyRelationship.create({
    data: {
      id: randomUUID(),
      clientId: canonical.clientId,
      relatedClientId: canonical.relatedClientId,
      relationshipType: canonical.relationshipType,
    },
  });

  registry.registerRelationship(rel.id);
  return { rm2Client, relationship: rel };
}
