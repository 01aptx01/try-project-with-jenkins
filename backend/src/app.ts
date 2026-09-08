import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { ApiError, DependencyUnavailableError } from "./errors.js";
import { checkReadiness, type DatabaseReadiness } from "./health/readiness.js";

export interface AppDependencies {
  readiness: DatabaseReadiness;
  version: string;
}

export function createApp(dependencies: AppDependencies) {
  const app = express();
  app.disable("x-powered-by");
  app.use((_request, response, next) => {
    response.locals.requestId = randomUUID();
    next();
  });

  app.get("/health", async (_request, response, next) => {
    try {
      await checkReadiness(dependencies.readiness);
      response.status(200).json({ status: "ok", version: dependencies.version });
    } catch (error) {
      next(error);
    }
  });

  app.use((_request, _response, next) => next(new ApiError(404, "NOT_FOUND", "Route not found")));
  app.use(errorHandler);
  return app;
}

function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction) {
  void _next;
  const requestId = response.locals.requestId as string;
  if (error instanceof ApiError) {
    return response.status(error.status).json({ error: { code: error.code, message: error.message, requestId } });
  }

  const internalError = new ApiError(500, "INTERNAL_ERROR", "An unexpected error occurred");
  return response.status(internalError.status).json({ error: { code: internalError.code, message: internalError.message, requestId } });
}

export { DependencyUnavailableError };
