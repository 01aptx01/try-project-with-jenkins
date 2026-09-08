import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { AuthController } from "./controllers/auth.controller.js";
import { ClientController } from "./controllers/client.controller.js";
import { DashboardController } from "./controllers/dashboard.controller.js";
import { prisma } from "./db/prisma.js";
import { createPrismaReadiness } from "./health/prisma-readiness.js";
import { createAuthGuard } from "./middleware/auth-guard.js";
import { PrismaClientRepository } from "./repositories/client.repository.js";
import { PrismaUserRepository } from "./repositories/user.repository.js";
import { createAuthRouter } from "./routes/auth.routes.js";
import { createClientRouter } from "./routes/client.routes.js";
import { createDashboardRouter } from "./routes/dashboard.routes.js";
import { AuthService } from "./services/auth.service.js";

const config = loadConfig();

const userRepository = new PrismaUserRepository(prisma);
const clientRepository = new PrismaClientRepository(prisma);

const isProduction = process.env.NODE_ENV === "production";

const authService = new AuthService({
  userRepository,
  jwtSecret: config.JWT_SECRET,
});
const authController = new AuthController(authService, isProduction);
const authGuard = createAuthGuard({
  userRepository,
  jwtSecret: config.JWT_SECRET,
});
const clientController = new ClientController({
  clientRepository,
});
const dashboardController = new DashboardController({
  clientRepository,
});

const app = createApp({
  readiness: createPrismaReadiness(prisma),
  version: config.APP_VERSION,
  appOrigin: config.APP_ORIGIN,
  trustProxy: false,
  configureRoutes: (expressApp) => {
    const authRouter = createAuthRouter({
      authController,
      authGuard,
    });
    const clientRouter = createClientRouter({
      clientController,
      authGuard,
    });
    const dashboardRouter = createDashboardRouter({
      dashboardController,
      authGuard,
    });

    expressApp.use("/api/auth", authRouter);
    expressApp.use("/api/clients", clientRouter);
    expressApp.use("/api/dashboard", dashboardRouter);
  },
});

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
