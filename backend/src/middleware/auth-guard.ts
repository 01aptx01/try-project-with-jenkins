import type { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "../errors.js";
import { verifySessionToken } from "../services/token.service.js";
import { SESSION_COOKIE_NAME } from "../config/cookie.js";
import type { UserRepository } from "../repositories/user.repository.js";

export interface AuthGuardOptions {
  userRepository: UserRepository;
  jwtSecret: string;
  clock?: () => number;
}

/**
 * Middleware ensuring the request has a valid, active RM session cookie.
 * 1. Reads meridian_session cookie
 * 2. Verifies JWT signature, issuer, audience, and expiration
 * 3. Verifies user exists in database and has role 'RM'
 * 4. Injects safe user summary ({ id, name, role }) into request context
 */
export function createAuthGuard(options: AuthGuardOptions) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const token = request.cookies?.[SESSION_COOKIE_NAME];
      if (!token || typeof token !== "string") {
        throw new UnauthorizedError("Authentication session required");
      }

      // Verify JWT token
      const session = verifySessionToken(token, {
        secret: options.jwtSecret,
        clock: options.clock,
      });

      // Confirm user still exists in database
      const user = await options.userRepository.findById(session.userId);
      if (!user) {
        throw new UnauthorizedError("Session is no longer valid; user not found");
      }

      // Confirm role is RM
      if (user.role !== "RM") {
        throw new UnauthorizedError("Access restricted to Relationship Managers");
      }

      // Populate safe user identity in context (no password hashes or raw secrets)
      const authUser = {
        id: user.id,
        name: user.name,
        role: "RM" as const,
      };

      request.user = authUser;
      response.locals.user = authUser;

      next();
    } catch (error) {
      next(error);
    }
  };
}
