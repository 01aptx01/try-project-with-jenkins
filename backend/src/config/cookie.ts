import type { CookieOptions } from "express";

export const SESSION_COOKIE_NAME = "meridian_session";
export const SESSION_COOKIE_MAX_AGE_MS = 3600 * 1000; // 1 hour

/**
 * Returns options for issuing the meridian_session cookie.
 * In production, Secure flag is enforced; in local development, it is false.
 */
export function getSessionCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_MS,
    secure: isProduction,
  };
}

/**
 * Returns options for clearing the meridian_session cookie upon logout.
 * Must match the exact path, sameSite, and secure attributes of the issuing cookie.
 */
export function getClearSessionCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    secure: isProduction,
  };
}
