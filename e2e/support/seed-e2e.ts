import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { buildSeedCatalogue } from "../../backend/src/seed/catalogue.js";
import { runSeed, type SeedResult } from "../../backend/src/seed/runner.js";
import {
  createVerifiedE2EDatabase,
  getE2EDatabaseUrl,
  redactUrl,
  waitForE2EDatabase,
} from "./db-guard.js";

export const E2E_FIXED_AS_OF_DATE = "2026-09-08";
const rootDir = process.cwd();

export function applyE2EMigrations(): void {
  const e2eUrl = getE2EDatabaseUrl();
  console.log(`[E2E Migrations] Deploying migrations to ${redactUrl(e2eUrl)}...`);
  const prismaCli = resolve(rootDir, "node_modules/prisma/build/index.js");
  const schemaPath = resolve(rootDir, "backend/prisma/schema.prisma");

  execSync(`node "${prismaCli}" migrate deploy --schema="${schemaPath}"`, {
    cwd: resolve(rootDir, "backend"),
    env: {
      ...process.env,
      DATABASE_URL: e2eUrl,
    },
    stdio: "inherit",
  });
}

export async function ensureE2EDatabaseReady(asOfDate: string = E2E_FIXED_AS_OF_DATE): Promise<SeedResult> {
  // 1. Wait for database readiness and verify identity
  const prisma = await waitForE2EDatabase(30000);
  await prisma.$disconnect();

  // 2. Deploy committed migrations
  applyE2EMigrations();

  // 3. Reset and seed
  return await resetE2EDatabase(asOfDate);
}

export async function seedE2ENormal(asOfDate: string = E2E_FIXED_AS_OF_DATE): Promise<SeedResult> {
  const prisma = await createVerifiedE2EDatabase();
  try {
    const catalogue = buildSeedCatalogue(asOfDate);
    const result = await runSeed(prisma, catalogue);
    return result;
  } finally {
    await prisma.$disconnect();
  }
}

export async function resetE2EDatabase(asOfDate: string = E2E_FIXED_AS_OF_DATE): Promise<SeedResult> {
  const prisma = await createVerifiedE2EDatabase();
  try {
    // Delete data in reverse dependency order
    await prisma.familyRelationship.deleteMany({});
    await prisma.goal.deleteMany({});
    await prisma.financialProfile.deleteMany({});
    await prisma.client.deleteMany({});
    await prisma.user.deleteMany({});

    // Seed normal catalogue
    const catalogue = buildSeedCatalogue(asOfDate);
    const result = await runSeed(prisma, catalogue);
    return result;
  } finally {
    await prisma.$disconnect();
  }
}

// Standalone execution if called directly
if (process.argv[1]?.endsWith("seed-e2e.ts") || process.argv[1]?.endsWith("seed-e2e.js")) {
  ensureE2EDatabaseReady()
    .then((res) => {
      console.log(`[E2E Seed] Successfully prepared and seeded E2E database on ${res.asOfDate}:`, res.counts);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[E2E Seed Error]", err);
      process.exit(1);
    });
}
