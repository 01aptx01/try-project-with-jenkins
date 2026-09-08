import type { PrismaClient } from "@prisma/client";

const expectedDatabaseName = "meridian_test";
const expectedPort = "5433";
const expectedUser = "meridian_test";
const allowedHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function redactDatabaseUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.password) {
      parsed.password = "******";
    }
    return parsed.toString();
  } catch {
    return "[invalid-url]";
  }
}

export function assertTestDatabaseUrl(
  url: string | undefined,
  primaryDbUrl: string | undefined = process.env.DATABASE_URL
): void {
  if (!url) {
    throw new Error("TEST_DATABASE_URL is required for integration tests");
  }
  if (primaryDbUrl && url === primaryDbUrl) {
    throw new Error("TEST_DATABASE_URL must not equal DATABASE_URL");
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid URL");
  }

  if (
    parsed.protocol !== "postgresql:" ||
    !allowedHosts.has(parsed.hostname) ||
    parsed.port !== expectedPort ||
    parsed.pathname !== `/${expectedDatabaseName}` ||
    parsed.username !== expectedUser
  ) {
    throw new Error(
      `TEST_DATABASE_URL must use ${expectedUser}@localhost:${expectedPort}/${expectedDatabaseName}, received: ${redactDatabaseUrl(url)}`
    );
  }
}

export async function assertTestDatabaseConnection(client: PrismaClient): Promise<void> {
  const rows = (await client.$queryRaw`SELECT current_database() AS "databaseName"`) as Array<{
    databaseName: string;
  }>;
  if (rows[0]?.databaseName !== expectedDatabaseName) {
    throw new Error(
      `Connected database "${rows[0]?.databaseName}" does not match the approved test database "${expectedDatabaseName}"`
    );
  }
}
