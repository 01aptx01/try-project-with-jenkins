import type { Client, FamilyRelationship, PrismaClient } from "@prisma/client";

export type FamilyRelationshipWithClients = FamilyRelationship & {
  client: Client;
  relatedClient: Client;
};

export interface FamilyRepository {
  find1HopRelationships(
    clientId: string
  ): Promise<FamilyRelationshipWithClients[]>;
}

export class PrismaFamilyRepository implements FamilyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async find1HopRelationships(
    clientId: string
  ): Promise<FamilyRelationshipWithClients[]> {
    return this.prisma.familyRelationship.findMany({
      where: {
        OR: [{ clientId }, { relatedClientId: clientId }],
      },
      include: {
        client: true,
        relatedClient: true,
      },
      orderBy: { id: "asc" },
    });
  }
}
