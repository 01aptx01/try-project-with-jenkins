import { describe, expect, it, vi } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";
import { DependencyUnavailableError } from "../../src/errors.js";
import { createPrismaReadiness } from "../../src/health/prisma-readiness.js";

describe("createPrismaReadiness", () => {
  it("resolves when database query succeeds", async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    };
    const readiness = createPrismaReadiness(mockPrisma as unknown as PrismaClient);
    await expect(readiness.check()).resolves.toBeUndefined();
  });

  it("translates PrismaClientInitializationError to DependencyUnavailableError", async () => {
    const error = new Prisma.PrismaClientInitializationError(
      "Can't reach database server",
      "6.19.3",
      "P1001"
    );
    const mockPrisma = {
      $queryRaw: vi.fn().mockRejectedValue(error),
    };
    const readiness = createPrismaReadiness(mockPrisma as unknown as PrismaClient);
    await expect(readiness.check()).rejects.toThrow(DependencyUnavailableError);
  });

  it("translates PrismaClientKnownRequestError to DependencyUnavailableError", async () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "Connection timed out",
      { code: "P1008", clientVersion: "6.19.3" }
    );
    const mockPrisma = {
      $queryRaw: vi.fn().mockRejectedValue(error),
    };
    const readiness = createPrismaReadiness(mockPrisma as unknown as PrismaClient);
    await expect(readiness.check()).rejects.toThrow(DependencyUnavailableError);
  });

  it("preserves and rethrows unexpected programming errors (e.g. TypeError)", async () => {
    const typeError = new TypeError("Cannot read property 'execute' of undefined");
    const mockPrisma = {
      $queryRaw: vi.fn().mockRejectedValue(typeError),
    };
    const readiness = createPrismaReadiness(mockPrisma as unknown as PrismaClient);
    await expect(readiness.check()).rejects.toThrow(TypeError);
    await expect(readiness.check()).rejects.not.toThrow(DependencyUnavailableError);
  });
});
