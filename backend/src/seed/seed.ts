import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../services/password.service.js";
import { buildSeedCatalogue } from "./catalogue.js";
import { runSeed } from "./runner.js";

function parseArgs(args: string[]): { asOfDate: string } {
  let asOfDate: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--as-of" && i + 1 < args.length) {
      asOfDate = args[i + 1];
      i++;
    } else if (arg?.startsWith("--as-of=")) {
      asOfDate = arg.split("=")[1];
    }
  }

  if (!asOfDate && process.env.SEED_AS_OF) {
    asOfDate = process.env.SEED_AS_OF;
  }

  if (!asOfDate) {
    console.error("Error: --as-of YYYY-MM-DD is a mandatory parameter for seeding.");
    console.error("Usage: npm run db:seed -- --as-of YYYY-MM-DD");
    process.exit(1);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate) || Number.isNaN(Date.parse(asOfDate))) {
    console.error(`Error: Invalid as-of date format "${asOfDate}". Must be YYYY-MM-DD.`);
    process.exit(1);
  }

  return { asOfDate };
}

async function main(): Promise<void> {
  const { asOfDate } = parseArgs(process.argv.slice(2));

  let rm1PasswordHash: string | undefined;
  let rm2PasswordHash: string | undefined;

  if (process.env.SEED_RM1_PASSWORD) {
    rm1PasswordHash = await hashPassword(process.env.SEED_RM1_PASSWORD);
  }
  if (process.env.SEED_RM2_PASSWORD) {
    rm2PasswordHash = await hashPassword(process.env.SEED_RM2_PASSWORD);
  }

  const catalogue = buildSeedCatalogue(asOfDate, {
    rm1PasswordHash,
    rm2PasswordHash,
  });

  const prisma = new PrismaClient();
  try {
    const result = await runSeed(prisma, catalogue);
    console.log(
      `\n[Seed Success] Idempotent seed completed successfully for as-of date: ${result.asOfDate}`
    );
    console.log("Record summary:");
    console.log(`  - Relationship Managers: ${result.counts.rms}`);
    console.log(`  - Clients:               ${result.counts.clients}`);
    console.log(`  - Financial Profiles:    ${result.counts.profiles}`);
    console.log(`  - Financial Goals:       ${result.counts.goals}`);
    console.log(`  - Family Relationships:  ${result.counts.relationships}\n`);
  } catch (err) {
    console.error("[Seed Error] Failed to persist seed catalogue:", err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Only execute when invoked directly as CLI script
if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  void main();
}
