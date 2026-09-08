import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { createPrismaReadiness } from "./health/prisma-readiness.js";

const config = loadConfig();
const app = createApp({ readiness: createPrismaReadiness(prisma), version: config.APP_VERSION });
const server = app.listen(config.API_PORT, "0.0.0.0", () => {
  console.info(`Meridian API listening on port ${config.API_PORT}`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
