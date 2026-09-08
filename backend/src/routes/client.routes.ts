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

  router.get("/:id", options.clientController.getProfileSnapshot);

  return router;
}
