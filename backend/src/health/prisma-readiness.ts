import { Prisma, type PrismaClient } from "@prisma/client";
import { DependencyUnavailableError } from "../errors.js";
import type { DatabaseReadiness } from "./readiness.js";

export function createPrismaReadiness(prisma: PrismaClient): DatabaseReadiness {
  return {
    check: async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientInitializationError ||
          error instanceof Prisma.PrismaClientKnownRequestError ||
          error instanceof Prisma.PrismaClientUnknownRequestError ||
          error instanceof Prisma.PrismaClientRustPanicError ||
          (error instanceof Error && (
            error.name === 'PrismaClientInitializationError' ||
            error.name === 'PrismaClientKnownRequestError' ||
            error.name === 'PrismaClientUnknownRequestError' ||
            error.name === 'PrismaClientRustPanicError'
          ))
        ) {
          throw new DependencyUnavailableError();
        }
        if (error instanceof DependencyUnavailableError) {
          throw error;
        }
        // Let unexpected programming / application errors propagate so they become 500
        throw error;
      }
    },
  };
}
