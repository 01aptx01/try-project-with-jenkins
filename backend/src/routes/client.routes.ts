import { Router, type RequestHandler } from "express";
import type { ClientController } from "../controllers/client.controller.js";

export interface ClientRouterOptions {
  clientController: ClientController;
  authGuard: RequestHandler;
}

export function createClientRouter(options: ClientRouterOptions): Router {
  const router = Router();

  // All client routes require authenticated RM session
  router.use(options.authGuard);

  router.get("/", options.clientController.getClientList);
  router.get("/:id", options.clientController.getProfileSnapshot);
  router.get("/:id/health", options.clientController.getClientHealth);
  router.get(
    "/:id/recommendations",
    options.clientController.getClientRecommendation
  );
  router.get("/:id/summary", options.clientController.getClientSummary);

  return router;
}

