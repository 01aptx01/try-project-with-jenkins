import { PrismaClient } from "@prisma/client";

export const EXPECTED_E2E_DB_NAME = "meridian_e2e";
export const EXPECTED_E2E_PORT = "5544";
export const EXPECTED_E2E_USER = "meridian_e2e";
export const ALLOWED_E2E_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function redactUrl(rawUrl: string): string {
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

export function assertE2EDatabaseUrl(
  url: string | undefined,
  forbiddenUrls: Array<string | undefined> = [process.env.DATABASE_URL, process.env.TEST_DATABASE_URL]
): string {
  if (!url) {
    throw new Error("E2E_DATABASE_URL is required for E2E tests");
  }

  for (const forbidden of forbiddenUrls) {
    if (forbidden && url === forbidden) {
      throw new Error("E2E_DATABASE_URL must not equal DATABASE_URL or TEST_DATABASE_URL");
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("E2E_DATABASE_URL must be a valid PostgreSQL connection URL");
  }

  if (
    parsed.protocol !== "postgresql:" ||
    !ALLOWED_E2E_HOSTS.has(parsed.hostname) ||
    parsed.port !== EXPECTED_E2E_PORT ||
    parsed.pathname !== `/${EXPECTED_E2E_DB_NAME}` ||
    parsed.username !== EXPECTED_E2E_USER
  ) {
    throw new Error(
      `E2E_DATABASE_URL must strictly use ${EXPECTED_E2E_USER}@127.0.0.1:${EXPECTED_E2E_PORT}/${EXPECTED_E2E_DB_NAME}. Received: ${redactUrl(url)}`
    );
  }

  return url;
}

export function getE2EDatabaseUrl(environment: NodeJS.ProcessEnv = process.env): string {
  const url = environment.E2E_DATABASE_URL || "postgresql://meridian_e2e:meridian_e2e_password@127.0.0.1:5544/meridian_e2e?schema=public";
  return assertE2EDatabaseUrl(url, [environment.DATABASE_URL, environment.TEST_DATABASE_URL]);
}

export async function assertE2EDatabaseConnection(client: PrismaClient): Promise<void> {
  const rows = (await client.$queryRaw`SELECT current_database() AS "databaseName"`) as Array<{
    databaseName: string;
  }>;
  if (rows[0]?.databaseName !== EXPECTED_E2E_DB_NAME) {
    throw new Error(
      `Connected database "${rows[0]?.databaseName}" does not match the approved E2E database "${EXPECTED_E2E_DB_NAME}"`
    );
  }
}

export async function waitForE2EDatabase(timeoutMs = 30000): Promise<PrismaClient> {
  const url = getE2EDatabaseUrl();
  const startTime = Date.now();
  let lastError: unknown;

  while (Date.now() - startTime < timeoutMs) {
    let client: PrismaClient | undefined;
    try {
      client = new PrismaClient({
        datasources: { db: { url } },
      });
      await assertE2EDatabaseConnection(client);
      return client;
    } catch (err) {
      lastError = err;
      if (client) {
        await client.$disconnect().catch(() => {});
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  throw new Error(
    `[E2E DB Guard] Timed out waiting for E2E database at ${redactUrl(url)} after ${timeoutMs}ms. Last error: ${lastError}`
  );
}

export async function createVerifiedE2EDatabase(environment: NodeJS.ProcessEnv = process.env): Promise<PrismaClient> {
  const url = getE2EDatabaseUrl(environment);
  const client = new PrismaClient({
    datasources: {
      db: { url },
    },
  });
  await assertE2EDatabaseConnection(client);
  return client;
}
