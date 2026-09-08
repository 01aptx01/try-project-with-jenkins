import type { Request, Response, NextFunction } from "express";
import type { AuthService } from "../services/auth.service.js";
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  getClearSessionCookieOptions,
} from "../config/cookie.js";

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly isProduction: boolean
  ) {}

  login = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const result = await this.authService.login(request.body);

      // Set HttpOnly session cookie
      response.cookie(
        SESSION_COOKIE_NAME,
        result.token,
        getSessionCookieOptions(this.isProduction)
      );

      // Return user summary only (no raw tokens, hashes, or internal database metadata)
      response.status(200).json({
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (_request: Request, response: Response, next: NextFunction) => {
    try {
      // Clear cookie with exact attributes and scope
      response.clearCookie(
        SESSION_COOKIE_NAME,
        getClearSessionCookieOptions(this.isProduction)
      );
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  };
}
