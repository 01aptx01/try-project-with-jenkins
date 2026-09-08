import { Router, type RequestHandler } from "express";
import type { FamilyController } from "../controllers/family.controller.js";

export interface FamilyRouterOptions {
  familyController: FamilyController;
  authGuard: RequestHandler;
}

export function createFamilyRouter(options: FamilyRouterOptions): Router {
  const router = Router({ mergeParams: true });

  router.use(options.authGuard);
  router.get("/:id/family", options.familyController.getFamilyGraph);

  return router;
}
