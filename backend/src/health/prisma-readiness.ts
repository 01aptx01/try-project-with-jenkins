import type { PrismaClient } from "@prisma/client";
import type { DatabaseReadiness } from "./readiness.js";

export function createPrismaReadiness(prisma: PrismaClient): DatabaseReadiness {
  return { check: async () => { await prisma.$queryRawUnsafe("SELECT 1"); } };
}
