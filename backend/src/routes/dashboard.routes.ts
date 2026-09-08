import { Router } from "express";
import type { RequestHandler } from "express";
import type { DashboardController } from "../controllers/dashboard.controller.js";

export interface DashboardRouterOptions {
  dashboardController: DashboardController;
  authGuard: RequestHandler;
}

export function createDashboardRouter(options: DashboardRouterOptions): Router {
  const router = Router();

  router.use(options.authGuard);

  router.get("/morning-action-plan", options.dashboardController.getMorningActionPlan);

  return router;
}
