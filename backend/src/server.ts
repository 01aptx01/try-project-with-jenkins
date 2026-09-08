import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { createPrismaReadiness } from "./health/prisma-readiness.js";

const config = loadConfig();
const app = createApp({ readiness: createPrismaReadiness(prisma), version: config.APP_VERSION });
const server = app.listen(config.API_PORT, "0.0.0.0", () => {
  console.info(`Meridian API listening on port ${config.API_PORT}`);
});

let isShuttingDown = false;
async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.info(`Received ${signal}. Shutting down Meridian API gracefully...`);

  const forceTimeout = setTimeout(() => {
    console.error("Forced shutdown due to timeout.");
    process.exit(1);
  }, 5000);
  forceTimeout.unref();

  server.closeIdleConnections?.();
  server.close(async (error) => {
    clearTimeout(forceTimeout);
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("Error disconnecting Prisma:", disconnectError);
    }
    process.exit(error ? 1 : 0);
  });
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
