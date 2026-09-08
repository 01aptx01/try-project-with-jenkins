import { Router } from "express";
import type { AuthController } from "../controllers/auth.controller.js";
import { createLoginRateLimiter, type RateLimiterOptions } from "../middleware/rate-limiter.js";

export interface AuthRouterOptions {
  authController: AuthController;
  rateLimiterOptions?: RateLimiterOptions;
}

export function createAuthRouter(options: AuthRouterOptions): Router {
  const router = Router();
  const loginLimiter = createLoginRateLimiter(options.rateLimiterOptions);

  router.post("/login", loginLimiter, options.authController.login);
  router.post("/logout", options.authController.logout);

  return router;
}
