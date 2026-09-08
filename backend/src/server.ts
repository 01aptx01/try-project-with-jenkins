import { createApp } from "./app.js";
import { loadConfig, type AppConfig } from "./config/env.js";
import { resolveTrustProxySetting } from "./config/proxy.js";
import { AuthController } from "./controllers/auth.controller.js";
import { ClientController } from "./controllers/client.controller.js";
import { DashboardController } from "./controllers/dashboard.controller.js";
import { FamilyController } from "./controllers/family.controller.js";
import { prisma } from "./db/prisma.js";
import { createPrismaReadiness } from "./health/prisma-readiness.js";
import { createAuthGuard } from "./middleware/auth-guard.js";
import { PrismaClientRepository } from "./repositories/client.repository.js";
import { PrismaFamilyRepository } from "./repositories/family.repository.js";
import { PrismaUserRepository } from "./repositories/user.repository.js";
import { createAuthRouter } from "./routes/auth.routes.js";
import { createClientRouter } from "./routes/client.routes.js";
import { createDashboardRouter } from "./routes/dashboard.routes.js";
import { createFamilyRouter } from "./routes/family.routes.js";
import { AuthService } from "./services/auth.service.js";
import type { PrismaClient } from "@prisma/client";

import type { RateLimiterOptions } from "./middleware/rate-limiter.js";

export interface ServerInstanceOptions {
  prismaClient?: PrismaClient;
  clock?: () => string;
  configOverrides?: Partial<AppConfig>;
  rateLimiterOptions?: RateLimiterOptions;
}

export function buildServerApp(options?: ServerInstanceOptions) {
  const envToParse: NodeJS.ProcessEnv = {
    ...process.env,
    ...(options?.configOverrides
      ? Object.fromEntries(
          Object.entries(options.configOverrides).map(([k, v]) => [k, String(v)])
        )
      : {}),
  };
  const config = loadConfig(envToParse);

  const db = options?.prismaClient ?? prisma;
  const userRepository = new PrismaUserRepository(db);
  const clientRepository = new PrismaClientRepository(db);
  const familyRepository = new PrismaFamilyRepository(db);

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
    clock: options?.clock,
  });
  const dashboardController = new DashboardController({
    clientRepository,
    clock: options?.clock,
  });
  const familyController = new FamilyController({
    clientRepository,
    familyRepository,
  });

  const app = createApp({
    readiness: createPrismaReadiness(db),
    version: config.APP_VERSION,
    appOrigin: config.APP_ORIGIN,
    trustProxy: resolveTrustProxySetting(config.TRUSTED_PROXIES),
    configureRoutes: (expressApp) => {
      const authRouter = createAuthRouter({
        authController,
        authGuard,
        rateLimiterOptions: options?.rateLimiterOptions,
      });
      const clientRouter = createClientRouter({
        clientController,
        authGuard,
      });
      const dashboardRouter = createDashboardRouter({
        dashboardController,
        authGuard,
      });
      const familyRouter = createFamilyRouter({
        familyController,
        authGuard,
      });

      expressApp.use("/api/auth", authRouter);
      expressApp.use("/api/clients", clientRouter);
      expressApp.use("/api/clients", familyRouter);
      expressApp.use("/api/dashboard", dashboardRouter);
    },
  });

  return { app, config, db };
}

const scriptPath = (process.argv[1] || "").replace(/\\/g, "/");
const isMainScript =
  !scriptPath.includes("e2e-server") &&
  (scriptPath.endsWith("/backend/src/server.ts") ||
    scriptPath.endsWith("/backend/src/server.js") ||
    scriptPath.endsWith("/dist/server.js") ||
    scriptPath.endsWith("/src/server.ts"));

if (isMainScript) {
  const { app, config, db } = buildServerApp();

  const server = app.listen(config.API_PORT, "0.0.0.0", () => {
    console.info(`Meridian API listening on port ${config.API_PORT}`);
  });

  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
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
      try {
        await db.$disconnect();
      } catch (disconnectError) {
        const errName = (disconnectError as Error)?.name || "Error";
        const errMessage = (disconnectError as Error)?.message || "Unknown error";
        const sanitized = errMessage.replace(/:\/\/([^:]+):([^@]+)@/g, "://$1:******@");
        console.error(`Error disconnecting Prisma [${errName}]: ${sanitized}`);
      } finally {
        clearTimeout(forceTimeout);
      }
      process.exit(error ? 1 : 0);
    });
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}
