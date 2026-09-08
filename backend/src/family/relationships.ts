export type RelationshipType = "PARENT" | "CHILD" | "SPOUSE" | "SIBLING";
export interface CanonicalRelationship { clientId: string; relatedClientId: string; relationshipType: RelationshipType; }
const inverseType: Record<RelationshipType, RelationshipType> = { PARENT: "CHILD", CHILD: "PARENT", SPOUSE: "SPOUSE", SIBLING: "SIBLING" };

export function canonicalizeRelationship(clientId: string, relatedClientId: string, relationshipType: RelationshipType): CanonicalRelationship {
  if (clientId === relatedClientId) throw new Error("A family relationship cannot reference the same client twice");
  if (clientId < relatedClientId) return { clientId, relatedClientId, relationshipType };
  return { clientId: relatedClientId, relatedClientId: clientId, relationshipType: inverseType[relationshipType] };
}
