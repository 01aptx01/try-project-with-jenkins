import { describe, expect, it } from "vitest";
import { canonicalizeRelationship } from "../../../src/family/relationships.js";
import {
  buildSeedCatalogue,
  SEED_RM_1_ID,
  SEED_RM_2_ID,
} from "../../../src/seed/catalogue.js";
import type { SeedCatalogue } from "../../../src/seed/types.js";
import { validateSeedCatalogue } from "../../../src/seed/validator.js";

describe("Seed Catalogue & Validator (M3-007)", () => {
  const testAsOfDate = "2026-09-08";

  it("builds a valid normal seed catalogue passing all validation checks", () => {
    const catalogue = buildSeedCatalogue(testAsOfDate);
    const report = validateSeedCatalogue(catalogue);

    expect(report.errors).toEqual([]);
    expect(report.isValid).toBe(true);
    expect(report.rmCount).toBe(2);
    expect(report.clientCount).toBe(30);
    expect(report.profileCount).toBe(30);
    expect(report.goalCount).toBeGreaterThanOrEqual(30);
    expect(report.relationshipCount).toBe(8);
  });

  it("ensures each RM owns exactly 15 clients with sequential customer codes", () => {
    const catalogue = buildSeedCatalogue(testAsOfDate);
    const rm1Clients = catalogue.clients.filter((c) => c.rmId === SEED_RM_1_ID);
    const rm2Clients = catalogue.clients.filter((c) => c.rmId === SEED_RM_2_ID);

    expect(rm1Clients).toHaveLength(15);
    expect(rm2Clients).toHaveLength(15);

    expect(rm1Clients.map((c) => c.customerCode)).toEqual([
      "C-001",
      "C-002",
      "C-003",
      "C-004",
      "C-005",
      "C-006",
      "C-007",
      "C-008",
      "C-009",
      "C-010",
      "C-011",
      "C-012",
      "C-013",
      "C-014",
      "C-015",
    ]);

    expect(rm2Clients.map((c) => c.customerCode)).toEqual([
      "C-016",
      "C-017",
      "C-018",
      "C-019",
      "C-020",
      "C-021",
      "C-022",
      "C-023",
      "C-024",
      "C-025",
      "C-026",
      "C-027",
      "C-028",
      "C-029",
      "C-030",
    ]);
  });

  it("covers all 5 NBA recommendation rules and all 3 Priority levels", () => {
    const catalogue = buildSeedCatalogue(testAsOfDate);
    const report = validateSeedCatalogue(catalogue);

    expect(report.nbaCoverage["Review Emergency Fund"]).toBeGreaterThanOrEqual(1);
    expect(report.nbaCoverage["Review Debt Position"]).toBeGreaterThanOrEqual(1);
    expect(report.nbaCoverage["Review Goal Funding"]).toBeGreaterThanOrEqual(1);
    expect(report.nbaCoverage["Schedule Financial Health Review"]).toBeGreaterThanOrEqual(1);
    expect(report.nbaCoverage["Routine Financial Review"]).toBeGreaterThanOrEqual(1);

    expect(report.priorityCoverage["HIGH"]).toBeGreaterThanOrEqual(1);
    expect(report.priorityCoverage["MEDIUM"]).toBeGreaterThanOrEqual(1);
    expect(report.priorityCoverage["LOW"]).toBeGreaterThanOrEqual(1);
  });

  it("produces identical deterministic financial evaluation results across different asOfDate dates", () => {
    const cat2026 = buildSeedCatalogue("2026-09-08");
    const cat2024 = buildSeedCatalogue("2024-01-15");

    const report2026 = validateSeedCatalogue(cat2026);
    const report2024 = validateSeedCatalogue(cat2024);

    expect(report2026.nbaCoverage).toEqual(report2024.nbaCoverage);
    expect(report2026.priorityCoverage).toEqual(report2024.priorityCoverage);
  });

  it("strictly enforces intra-RM family relationships across all 4 relationship types", () => {
    const catalogue = buildSeedCatalogue(testAsOfDate);
    const clientMap = new Map(catalogue.clients.map((c) => [c.id, c]));

    const types = new Set<string>();
    for (const rel of catalogue.relationships) {
      const clientA = clientMap.get(rel.clientId)!;
      const clientB = clientMap.get(rel.relatedClientId)!;

      expect(clientA.rmId).toBe(clientB.rmId);
      types.add(rel.relationshipType);

      // Verify canonical relationship works without throwing
      const canonical = canonicalizeRelationship(
        rel.clientId,
        rel.relatedClientId,
        rel.relationshipType
      );
      expect(canonical).toBeDefined();
    }

    expect(types).toContain("PARENT");
    expect(types).toContain("CHILD");
    expect(types).toContain("SPOUSE");
    expect(types).toContain("SIBLING");
  });

  it("fails validation if a cross-RM relationship is introduced", () => {
    const catalogue = buildSeedCatalogue(testAsOfDate);
    // Introduce an illegal relationship between RM1 client (C-001) and RM2 client (C-016)
    const corrupted: SeedCatalogue = {
      ...catalogue,
      relationships: [
        ...catalogue.relationships,
        {
          id: "99999999-9999-4999-8999-999999999999",
          clientId: catalogue.clients[0]!.id,
          relatedClientId: catalogue.clients[15]!.id,
          relationshipType: "SIBLING",
        },
      ],
    };

    const report = validateSeedCatalogue(corrupted);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.includes("Cross-RM relationship violation"))).toBe(true);
  });

  it("fails validation if an RM has fewer than 15 clients", () => {
    const catalogue = buildSeedCatalogue(testAsOfDate);
    const corrupted: SeedCatalogue = {
      ...catalogue,
      clients: catalogue.clients.slice(1), // 29 clients
    };

    const report = validateSeedCatalogue(corrupted);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.includes("Expected exactly 30 clients"))).toBe(true);
  });

  it("fails validation if a client has no goal", () => {
    const catalogue = buildSeedCatalogue(testAsOfDate);
    const firstClientId = catalogue.clients[0]!.id;
    const corrupted: SeedCatalogue = {
      ...catalogue,
      goals: catalogue.goals.filter((g) => g.clientId !== firstClientId),
    };

    const report = validateSeedCatalogue(corrupted);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.includes("has no goals; minimum 1 required"))).toBe(true);
  });
});
