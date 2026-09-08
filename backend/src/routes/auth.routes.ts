import { Router, type RequestHandler } from "express";
import type { AuthController } from "../controllers/auth.controller.js";
import { createLoginRateLimiter, type RateLimiterOptions } from "../middleware/rate-limiter.js";

export interface AuthRouterOptions {
  authController: AuthController;
  authGuard?: RequestHandler | undefined;
  rateLimiterOptions?: RateLimiterOptions | undefined;
}

export function createAuthRouter(options: AuthRouterOptions): Router {
  const router = Router();
  const loginLimiter = createLoginRateLimiter(options.rateLimiterOptions);
  const guard = options.authGuard ?? ((_req, _res, next) => next());

  router.post("/login", loginLimiter, options.authController.login);
  router.post("/logout", options.authController.logout);
  router.get("/me", guard, options.authController.me);

  return router;
}
