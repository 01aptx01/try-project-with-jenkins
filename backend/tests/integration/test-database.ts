import { PrismaClient } from "@prisma/client";

const expectedDatabaseName = "meridian_test";
const expectedPort = "5433";
const expectedUser = "meridian_test";
const allowedHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function getTestDatabaseUrl(environment: NodeJS.ProcessEnv = process.env): string {
  const url = environment.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is required for integration tests");
  if (url === environment.DATABASE_URL) throw new Error("TEST_DATABASE_URL must not equal DATABASE_URL");

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid URL");
  }

  if (parsed.protocol !== "postgresql:" || !allowedHosts.has(parsed.hostname) || parsed.port !== expectedPort || parsed.pathname !== `/${expectedDatabaseName}` || parsed.username !== expectedUser) {
    throw new Error(`TEST_DATABASE_URL must use ${expectedUser}@localhost:${expectedPort}/${expectedDatabaseName}`);
  }

  return url;
}

export async function createVerifiedTestDatabase(environment: NodeJS.ProcessEnv = process.env): Promise<PrismaClient> {
  const client = new PrismaClient({ datasources: { db: { url: getTestDatabaseUrl(environment) } } });
  const rows = await client.$queryRaw`SELECT current_database() AS "databaseName"` as Array<{ databaseName: string }>;
  if (rows[0]?.databaseName !== expectedDatabaseName) {
    await client.$disconnect();
    throw new Error("Connected database does not match the approved integration-test database");
  }
  return client;
}
