import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import { createApp } from "../../../src/app.js";
import { FamilyController } from "../../../src/controllers/family.controller.js";
import { createAuthGuard } from "../../../src/middleware/auth-guard.js";
import { PrismaClientRepository } from "../../../src/repositories/client.repository.js";
import { PrismaFamilyRepository } from "../../../src/repositories/family.repository.js";
import { PrismaUserRepository } from "../../../src/repositories/user.repository.js";
import { createFamilyRouter } from "../../../src/routes/family.routes.js";
import {
  createTestClient,
  createTestRelationship,
} from "../../fixtures/client.fixtures.js";
import { createTestHarness, type TestHarness } from "../../support/test-harness.js";
import { SEED_RM_1_ID, SEED_RM_2_ID } from "../../../src/seed/catalogue.js";

describe("API: Family Graph (GET /api/clients/:id/family) (M3-015)", () => {
  let harness: TestHarness;
  let app: Express;
  let rm1Cookie: string;
  let rm2Cookie: string;
  const testAsOfDate = "2026-09-08";

  // Test client IDs
  let isolatedClientId: string;
  let primaryClientId: string;
  let childClientId: string;
  let spouseClientId: string;
  let siblingClientId: string;
  let parentClientId: string;
  let twoHopRelativeId: string;
  let crossRmRelativeId: string;
  let rm2ClientId: string;

  beforeAll(async () => {
    harness = await createTestHarness();
    await harness.ensureNormalSeed(testAsOfDate);

    rm1Cookie = harness.createRm1SessionCookie();
    rm2Cookie = harness.createRm2SessionCookie();

    const clientRepository = new PrismaClientRepository(harness.database);
    const familyRepository = new PrismaFamilyRepository(harness.database);
    const userRepository = new PrismaUserRepository(harness.database);

    const authGuard = createAuthGuard({
      userRepository,
      jwtSecret: harness.jwtSecret,
    });

    const familyController = new FamilyController({
      clientRepository,
      familyRepository,
    });

    app = createApp({
      readiness: { check: async () => {} },
      version: "test",
      configureRoutes: (expressApp) => {
        const familyRouter = createFamilyRouter({
          familyController,
          authGuard,
        });
        expressApp.use("/api/clients", familyRouter);
      },
    });

    // 1. Create Isolated Client (RM1)
    const isolated = await createTestClient(
      harness.database,
      { rmId: SEED_RM_1_ID, customerCode: `ISO-${Date.now()}` },
      harness.registry
    );
    isolatedClientId = isolated.id;

    // 2. Create Primary Client (RM1)
    const primary = await createTestClient(
      harness.database,
      {
        rmId: SEED_RM_1_ID,
        customerCode: `PRIM-${Date.now()}`,
        firstName: "Somchai",
        lastName: "Prasert",
      },
      harness.registry
    );
    primaryClientId = primary.id;

    // 3. Create Child (RM1)
    const child = await createTestClient(
      harness.database,
      {
        rmId: SEED_RM_1_ID,
        customerCode: `CHLD-${Date.now()}`,
        firstName: "Somying",
        lastName: "Prasert",
      },
      harness.registry
    );
    childClientId = child.id;

    // 4. Create Spouse (RM1)
    const spouse = await createTestClient(
      harness.database,
      {
        rmId: SEED_RM_1_ID,
        customerCode: `SPOU-${Date.now()}`,
        firstName: "Malee",
        lastName: "Prasert",
      },
      harness.registry
    );
    spouseClientId = spouse.id;

    // 5. Create Sibling (RM1)
    const sibling = await createTestClient(
      harness.database,
      {
        rmId: SEED_RM_1_ID,
        customerCode: `SIBL-${Date.now()}`,
        firstName: "Somsak",
        lastName: "Prasert",
      },
      harness.registry
    );
    siblingClientId = sibling.id;

    // 6. Create Parent (RM1)
    const parent = await createTestClient(
      harness.database,
      {
        rmId: SEED_RM_1_ID,
        customerCode: `PAR-${Date.now()}`,
        firstName: "Boonmee",
        lastName: "Prasert",
      },
      harness.registry
    );
    parentClientId = parent.id;

    // 7. Create 2-hop Relative (connected to Child, NOT to Primary) (RM1)
    const grandchild = await createTestClient(
      harness.database,
      {
        rmId: SEED_RM_1_ID,
        customerCode: `GRND-${Date.now()}`,
        firstName: "Little",
        lastName: "Prasert",
      },
      harness.registry
    );
    twoHopRelativeId = grandchild.id;

    // 8. Create Cross-RM Relative (connected to Primary, but owned by RM2)
    const crossRmClient = await createTestClient(
      harness.database,
      {
        rmId: SEED_RM_2_ID,
        customerCode: `CROSS-${Date.now()}`,
        firstName: "Secret",
        lastName: "Relative",
      },
      harness.registry
    );
    crossRmRelativeId = crossRmClient.id;

    // 9. Create Client owned by RM2
    const rm2Client = await createTestClient(
      harness.database,
      { rmId: SEED_RM_2_ID, customerCode: `RM2CL-${Date.now()}` },
      harness.registry
    );
    rm2ClientId = rm2Client.id;

    // Wire relationships:
    // Primary -> Child (PARENT)
    await createTestRelationship(
      harness.database,
      {
        clientId: primaryClientId,
        relatedClientId: childClientId,
        relationshipType: "PARENT",
      },
      harness.registry
    );

    // Primary -> Spouse (SPOUSE)
    await createTestRelationship(
      harness.database,
      {
        clientId: primaryClientId,
        relatedClientId: spouseClientId,
        relationshipType: "SPOUSE",
      },
      harness.registry
    );

    // Primary -> Sibling (SIBLING)
    await createTestRelationship(
      harness.database,
      {
        clientId: primaryClientId,
        relatedClientId: siblingClientId,
        relationshipType: "SIBLING",
      },
      harness.registry
    );

    // Primary <- Parent (Primary is CHILD, Parent is PARENT)
    await createTestRelationship(
      harness.database,
      {
        clientId: parentClientId,
        relatedClientId: primaryClientId,
        relationshipType: "PARENT",
      },
      harness.registry
    );

    // 2-hop: Child -> Grandchild (PARENT)
    await createTestRelationship(
      harness.database,
      {
        clientId: childClientId,
        relatedClientId: twoHopRelativeId,
        relationshipType: "PARENT",
      },
      harness.registry
    );

    // Cross-RM: Primary <-> Cross-RM Relative (SIBLING)
    await createTestRelationship(
      harness.database,
      {
        clientId: primaryClientId,
        relatedClientId: crossRmRelativeId,
        relationshipType: "SIBLING",
      },
      harness.registry
    );
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    }
  });

  it("returns 401 when no session cookie is present", async () => {
    const res = await request(app).get(`/api/clients/${primaryClientId}/family`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 when client ID is not a valid UUID", async () => {
    const res = await request(app)
      .get("/api/clients/not-a-uuid/family")
      .set("Cookie", rm1Cookie);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(res.body.error.message).toBe("Invalid client ID format");
  });

  it("returns 404 when client does not exist", async () => {
    const nonExistent = "b0000000-0000-0000-0000-000000000099";
    const res = await request(app)
      .get(`/api/clients/${nonExistent}/family`)
      .set("Cookie", rm1Cookie);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.message).toBe("Client not found");
  });

  it("enforces cross-RM ownership on primary client (returns 404 uniform message)", async () => {
    // RM1 tries to access RM2's client
    const res = await request(app)
      .get(`/api/clients/${rm2ClientId}/family`)
      .set("Cookie", rm1Cookie);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.message).toBe("Client not found");

    // Whereas RM2 can access its own client
    const rm2Res = await request(app)
      .get(`/api/clients/${rm2ClientId}/family`)
      .set("Cookie", rm2Cookie);
    expect(rm2Res.status).toBe(200);
  });

  it("returns 1 PRIMARY node and empty edges for isolated client", async () => {
    const res = await request(app)
      .get(`/api/clients/${isolatedClientId}/family`)
      .set("Cookie", rm1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.nodes).toHaveLength(1);
    expect(res.body.nodes[0]).toEqual({
      id: isolatedClientId,
      label: expect.any(String),
      type: "PRIMARY",
    });
    expect(res.body.edges).toEqual([]);
  });

  it("returns 1-hop family graph covering all relationship types without 2-hop or cross-RM leak", async () => {
    const res = await request(app)
      .get(`/api/clients/${primaryClientId}/family`)
      .set("Cookie", rm1Cookie);

    expect(res.status).toBe(200);

    const { nodes, edges } = res.body;

    // 1. Verify Primary Node is first
    expect(nodes[0]).toEqual({
      id: primaryClientId,
      label: "Somchai Prasert",
      type: "PRIMARY",
    });

    // 2. Total nodes: 1 primary + 4 valid 1-hop relatives (child, spouse, sibling, parent) = 5 nodes
    expect(nodes).toHaveLength(5);

    const nodeIds = nodes.map((n: { id: string }) => n.id);
    expect(nodeIds).toContain(primaryClientId);
    expect(nodeIds).toContain(childClientId);
    expect(nodeIds).toContain(spouseClientId);
    expect(nodeIds).toContain(siblingClientId);
    expect(nodeIds).toContain(parentClientId);

    // 3. Verify cross-RM relative is NOT present in nodes
    expect(nodeIds).not.toContain(crossRmRelativeId);

    // 4. Verify 2-hop relative (grandchild) is NOT present in nodes
    expect(nodeIds).not.toContain(twoHopRelativeId);

    // 5. Check all related nodes have type RELATED
    for (let i = 1; i < nodes.length; i++) {
      expect(nodes[i].type).toBe("RELATED");
    }

    // 6. Total edges: 4 edges (to child, spouse, sibling, parent)
    expect(edges).toHaveLength(4);

    const edgeTypes = edges.map((e: { relationshipType: string }) => e.relationshipType);
    // Across the 4 canonicalized edges, PARENT/CHILD, SPOUSE, SIBLING are present
    expect(edgeTypes).toContain("SPOUSE");
    expect(edgeTypes).toContain("SIBLING");

    // 7. Verify NO edge references cross-RM relative or 2-hop relative
    for (const edge of edges) {
      expect(edge.source).not.toBe(crossRmRelativeId);
      expect(edge.target).not.toBe(crossRmRelativeId);
      expect(edge.source).not.toBe(twoHopRelativeId);
      expect(edge.target).not.toBe(twoHopRelativeId);
    }
  });
});
