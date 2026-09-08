import { canonicalizeRelationship } from "../../src/family/relationships.js";

describe("canonicalizeRelationship", () => {
  it("keeps a canonical pair and its direction", () => {
    expect(canonicalizeRelationship("a", "b", "PARENT")).toEqual({ clientId: "a", relatedClientId: "b", relationshipType: "PARENT" });
  });

  it("reverses a directional relationship when normalizing", () => {
    expect(canonicalizeRelationship("b", "a", "PARENT")).toEqual({ clientId: "a", relatedClientId: "b", relationshipType: "CHILD" });
  });

  it("rejects a self relationship", () => {
    expect(() => canonicalizeRelationship("a", "a", "SIBLING")).toThrow("same client");
  });
});
