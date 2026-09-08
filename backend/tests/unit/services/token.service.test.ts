import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import {
  signSessionToken,
  verifySessionToken,
  JWT_ISSUER,
  JWT_AUDIENCE,
  JWT_TTL_SECONDS,
} from "../../../src/services/token.service.js";
import {
  getSessionCookieOptions,
  getClearSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "../../../src/config/cookie.js";

describe("Token Service & Cookie Configuration", () => {
  const testSecret = "xjY5eR1eUVtkUaXjTV4yqAFjhMpt+rDuKUEM3Ucqf/I=";
  const userId = "11111111-2222-3333-4444-555555555555";

  it("signs token with sub, iss, aud, and 1 hour expiration", () => {
    const fixedNow = 1700000000;
    const token = signSessionToken(userId, {
      secret: testSecret,
      clock: () => fixedNow,
    });

    const decoded = jwt.decode(token) as jwt.JwtPayload;
    expect(decoded.sub).toBe(userId);
    expect(decoded.iss).toBe(JWT_ISSUER);
    expect(decoded.aud).toBe(JWT_AUDIENCE);
    expect(decoded.iat).toBe(fixedNow);
    expect(decoded.exp).toBe(fixedNow + JWT_TTL_SECONDS);
  });

  it("verifies valid token successfully", () => {
    const fixedNow = 1700000000;
    const token = signSessionToken(userId, {
      secret: testSecret,
      clock: () => fixedNow,
    });

    const verified = verifySessionToken(token, {
      secret: testSecret,
      clock: () => fixedNow + 60, // 1 minute later
    });

    expect(verified.userId).toBe(userId);
    expect(verified.iat).toBe(fixedNow);
    expect(verified.exp).toBe(fixedNow + JWT_TTL_SECONDS);
  });

  it("enforces expiration boundary at exactly 3600 seconds", () => {
    const fixedNow = 1700000000;
    const token = signSessionToken(userId, {
      secret: testSecret,
      clock: () => fixedNow,
    });

    // 1 second before expiration: valid
    const validAtEdge = verifySessionToken(token, {
      secret: testSecret,
      clock: () => fixedNow + 3599,
    });
    expect(validAtEdge.userId).toBe(userId);

    // 1 second after expiration: expired -> throws UnauthorizedError
    expect(() =>
      verifySessionToken(token, {
        secret: testSecret,
        clock: () => fixedNow + 3601,
      })
    ).toThrow("Session verification failed");
  });

  it("rejects token signed with wrong secret", () => {
    const token = signSessionToken(userId, { secret: testSecret });
    const wrongSecret = "YW5vdGhlcl9zZWNyZXRfdmFsdWVfdGhhdF9pczMyYnl0ZXM=";

    expect(() =>
      verifySessionToken(token, { secret: wrongSecret })
    ).toThrow("Session verification failed");
  });

  it("rejects tampered token signature", () => {
    const token = signSessionToken(userId, { secret: testSecret });
    const tampered = token.slice(0, -5) + "abcde";

    expect(() =>
      verifySessionToken(tampered, { secret: testSecret })
    ).toThrow("Session verification failed");
  });

  it("rejects token with algorithm other than HS256", () => {
    // Generate an unsigned 'none' algorithm token
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: userId,
        iss: JWT_ISSUER,
        aud: JWT_AUDIENCE,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString("base64url");
    const unsignedToken = `${header}.${payload}.`;

    expect(() =>
      verifySessionToken(unsignedToken, { secret: testSecret })
    ).toThrow("Session verification failed");
  });

  it("rejects token with missing required claims (iss / aud)", () => {
    const invalidPayload = { sub: userId }; // missing iss and aud
    const malformedToken = jwt.sign(invalidPayload, testSecret, { algorithm: "HS256" });

    expect(() =>
      verifySessionToken(malformedToken, { secret: testSecret })
    ).toThrow("Session verification failed");
  });

  describe("Cookie Options Single Source of Truth", () => {
    it("provides session cookie options matching contract", () => {
      expect(SESSION_COOKIE_NAME).toBe("meridian_session");

      const devOptions = getSessionCookieOptions(false);
      expect(devOptions).toEqual({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 3600 * 1000,
        secure: false,
      });

      const prodOptions = getSessionCookieOptions(true);
      expect(prodOptions.secure).toBe(true);
      expect(prodOptions.httpOnly).toBe(true);
      expect(prodOptions.sameSite).toBe("lax");
    });

    it("clears session cookie with identical scope/attributes", () => {
      const devClear = getClearSessionCookieOptions(false);
      expect(devClear.httpOnly).toBe(true);
      expect(devClear.sameSite).toBe("lax");
      expect(devClear.path).toBe("/");
      expect(devClear.maxAge).toBe(0);
      expect(devClear.secure).toBe(false);

      const prodClear = getClearSessionCookieOptions(true);
      expect(prodClear.secure).toBe(true);
      expect(prodClear.path).toBe("/");
      expect(prodClear.maxAge).toBe(0);
    });
  });
});
