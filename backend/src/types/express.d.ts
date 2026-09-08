import type { AuthUserSummary } from "../contracts/api.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserSummary;
    }
    interface Locals {
      requestId?: string;
      user?: AuthUserSummary;
    }
  }
}

export {};
