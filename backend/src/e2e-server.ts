import { execSync } from "node:child_process";
import { createVerifiedE2EDatabase } from "../../e2e/support/db-guard.js";
import { buildServerApp } from "./server.js";

function resolveCommitSha(): string {
  if (process.env.APP_VERSION && process.env.APP_VERSION !== "local") {
    return process.env.APP_VERSION;
  }
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    throw new Error("Cannot determine E2E checkout SHA");
  }
}

const e2eSha = resolveCommitSha();
const e2eDbUrl =
  process.env.E2E_DATABASE_URL ||
  "postgresql://meridian_e2e:meridian_e2e_password@127.0.0.1:5544/meridian_e2e?schema=public";

process.env.APP_VERSION = e2eSha;
process.env.APP_ORIGIN = "http://127.0.0.1:8180";
process.env.API_PORT = "3101";

const e2ePrisma = await createVerifiedE2EDatabase();

const { app, config, db } = buildServerApp({
  prismaClient: e2ePrisma,
  clock: () => "2026-09-08",
  configOverrides: {
    API_PORT: 3101,
    APP_ORIGIN: "http://127.0.0.1:8180",
    APP_VERSION: e2eSha,
    DATABASE_URL: e2eDbUrl,
    TRUSTED_PROXIES: "loopback",
  },
});

const server = app.listen(config.API_PORT, "127.0.0.1", () => {
  console.info(
    `[Meridian E2E API] Listening on port ${config.API_PORT} (Version: ${config.APP_VERSION}, Clock: 2026-09-08)`
  );
});

let isShuttingDown = false;
const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.info(`[Meridian E2E API] Received ${signal}. Shutting down gracefully...`);

  const forceTimeout = setTimeout(() => {
    console.error("[Meridian E2E API] Forced shutdown due to timeout.");
    process.exit(1);
  }, 5000);
  forceTimeout.unref();

  server.closeIdleConnections?.();
  server.close(async (error) => {
    try {
      await db.$disconnect();
    } catch (disconnectError) {
      console.error("[Meridian E2E API] Error disconnecting Prisma:", disconnectError);
    } finally {
      clearTimeout(forceTimeout);
    }
    process.exit(error ? 1 : 0);
  });
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
