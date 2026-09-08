import { randomUUID } from "node:crypto";
import express, { type Express } from "express";
import helmet from "helmet";
import { NotFoundError, DependencyUnavailableError } from "./errors.js";
import { checkReadiness, type DatabaseReadiness } from "./health/readiness.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requireJsonContentType, noStoreCache } from "./middleware/request-parser.js";

export interface AppDependencies {
  readiness: DatabaseReadiness;
  version: string;
  configureRoutes?: (app: Express) => void;
}

export function createApp(dependencies: AppDependencies): Express {
  const app = express();

  // 1. Security headers & Request ID
  app.use(helmet());
  app.use((_request, response, next) => {
    response.locals.requestId = randomUUID();
    next();
  });

  // 2. Global response cache control
  app.use(noStoreCache);

  // 3. Request parsing with 16 KiB limit & Content-Type validation
  app.use(requireJsonContentType);
  app.use(express.json({ limit: "16kb" }));

  // 4. Public Health Check
  app.get("/health", async (_request, response, next) => {
    try {
      await checkReadiness(dependencies.readiness);
      response.status(200).json({ status: "ok", version: dependencies.version });
    } catch (error) {
      next(error);
    }
  });

  // Additional application routes hook
  dependencies.configureRoutes?.(app);

  // 5. 404 Fallback
  app.use((_request, _response, next) => {
    next(new NotFoundError("Route not found"));
  });

  // 6. Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export { DependencyUnavailableError };
