import jwt, { type JwtPayload } from "jsonwebtoken";
import { UnauthorizedError } from "../errors.js";

export const JWT_ISSUER = "meridian-api";
export const JWT_AUDIENCE = "meridian-web";
export const JWT_TTL_SECONDS = 3600; // 1 hour

export interface SessionPayload {
  userId: string;
  iat?: number | undefined;
  exp?: number | undefined;
}

export interface SignTokenOptions {
  secret: string;
  clock?: (() => number) | undefined;
}

export interface VerifyTokenOptions {
  secret: string;
  clock?: (() => number) | undefined;
}

export function signSessionToken(userId: string, options: SignTokenOptions): string {
  const currentEpochSeconds = options.clock ? options.clock() : Math.floor(Date.now() / 1000);

  const payload: JwtPayload = {
    sub: userId,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: currentEpochSeconds,
    exp: currentEpochSeconds + JWT_TTL_SECONDS,
  };

  return jwt.sign(payload, options.secret, {
    algorithm: "HS256",
  });
}

export function verifySessionToken(token: string, options: VerifyTokenOptions): SessionPayload {
  try {
    const currentEpochSeconds = options.clock ? options.clock() : Math.floor(Date.now() / 1000);

    const decoded = jwt.verify(token, options.secret, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      clockTimestamp: currentEpochSeconds,
      complete: false,
    }) as JwtPayload;

    if (!decoded.sub || typeof decoded.sub !== "string") {
      throw new UnauthorizedError("Session token missing subject claim");
    }

    return {
      userId: decoded.sub,
      iat: decoded.iat,
      exp: decoded.exp,
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    const message = (error as Error).message || "Invalid session token";
    throw new UnauthorizedError(`Session verification failed: ${message}`);
  }
}
