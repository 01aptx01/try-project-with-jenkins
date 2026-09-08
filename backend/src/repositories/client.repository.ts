import type { Client, FinancialProfile, Goal, PrismaClient } from "@prisma/client";

export type ClientWithFinancialData = Client & {
  financialProfile: FinancialProfile | null;
  goals: Goal[];
};

export interface ClientRepository {
  findClientById(clientId: string, rmId: string): Promise<ClientWithFinancialData | null>;
  findAllClientsByRmId(rmId: string): Promise<ClientWithFinancialData[]>;
}

export class PrismaClientRepository implements ClientRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findClientById(clientId: string, rmId: string): Promise<ClientWithFinancialData | null> {
    return this.prisma.client.findFirst({
      where: {
        id: clientId,
        rmId,
      },
      include: {
        financialProfile: true,
        goals: {
          orderBy: [{ targetDate: "asc" }, { id: "asc" }],
        },
      },
    });
  }

  async findAllClientsByRmId(rmId: string): Promise<ClientWithFinancialData[]> {
    return this.prisma.client.findMany({
      where: { rmId },
      include: {
        financialProfile: true,
        goals: {
          orderBy: [{ targetDate: "asc" }, { id: "asc" }],
        },
      },
      orderBy: { customerCode: "asc" },
    });
  }
}
