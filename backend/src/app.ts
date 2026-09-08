import { randomUUID } from "node:crypto";
import express, { type Express } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { NotFoundError, DependencyUnavailableError } from "./errors.js";
import { checkReadiness, type DatabaseReadiness } from "./health/readiness.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requireJsonContentType, noStoreCache } from "./middleware/request-parser.js";
import { createOriginGuard } from "./middleware/origin-guard.js";

export interface AppDependencies {
  readiness: DatabaseReadiness;
  version: string;
  appOrigin?: string;
  trustProxy?: boolean | string | string[];
  configureRoutes?: (app: Express) => void;
}

export function createApp(dependencies: AppDependencies): Express {
  const app = express();

  // 1. Trust proxy configuration (explicitly controlled, default false)
  if (dependencies.trustProxy !== undefined) {
    app.set("trust proxy", dependencies.trustProxy);
  } else {
    app.set("trust proxy", false);
  }

  // 2. Security headers & Request ID
  app.use(helmet());
  app.use((_request, response, next) => {
    response.locals.requestId = randomUUID();
    next();
  });

  // 3. Global response cache control
  app.use(noStoreCache);

  // 4. Origin Protection on state-changing methods
  if (dependencies.appOrigin) {
    app.use(createOriginGuard(dependencies.appOrigin));
  }

  // 5. Request parsing with 16 KiB limit & Content-Type validation
  app.use(requireJsonContentType);
  app.use(express.json({ limit: "16kb", type: ["application/json", "application/*+json"] }));

  // 6. Cookie parsing for session handling
  app.use(cookieParser());

  // 7. Public Health Check
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

  // 8. 404 Fallback
  app.use((_request, _response, next) => {
    next(new NotFoundError("Route not found"));
  });

  // 9. Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export { DependencyUnavailableError };
