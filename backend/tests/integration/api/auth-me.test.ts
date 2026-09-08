import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../../../src/app.js";
import { InMemoryUserRepository, type UserRecord } from "../../../src/repositories/user.repository.js";
import { AuthService } from "../../../src/services/auth.service.js";
import { AuthController } from "../../../src/controllers/auth.controller.js";
import { createAuthRouter } from "../../../src/routes/auth.routes.js";
import { createAuthGuard } from "../../../src/middleware/auth-guard.js";
import { hashPassword } from "../../../src/services/password.service.js";
import { signSessionToken } from "../../../src/services/token.service.js";
import { SESSION_COOKIE_NAME } from "../../../src/config/cookie.js";
import { DependencyUnavailableError } from "../../../src/errors.js";

describe("API: RM Session Guard & GET /api/auth/me", () => {
  const testOrigin = "http://localhost:8080";
  const testSecret = "xjY5eR1eUVtkUaXjTV4yqAFjhMpt+rDuKUEM3Ucqf/I=";
  let userRepository: InMemoryUserRepository;
  let authService: AuthService;
  let authController: AuthController;
  let app: ReturnType<typeof createApp>;

  const rmUser: UserRecord = {
    id: "22222222-2222-4222-8222-222222222222",
    email: "rm2@meridian.local",
    passwordHash: "",
    name: "RM Two",
    role: "RM",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };

  beforeEach(async () => {
    rmUser.passwordHash = await hashPassword("ValidPassword123!");
    userRepository = new InMemoryUserRepository([rmUser]);
    authService = new AuthService({
      userRepository,
      jwtSecret: testSecret,
    });
    authController = new AuthController(authService, false);

    const authGuard = createAuthGuard({
      userRepository,
      jwtSecret: testSecret,
    });

    app = createApp({
      readiness: { check: async () => undefined },
      version: "test-ver",
      appOrigin: testOrigin,
      configureRoutes: (expressApp) => {
        const authRouter = createAuthRouter({
          authController,
          authGuard,
        });
        expressApp.use("/api/auth", authRouter);
      },
    });
  });

  it("returns 200 with current RM details when valid session cookie is provided", async () => {
    const token = signSessionToken(rmUser.id, { secret: testSecret });

    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: rmUser.id,
      name: "RM Two",
      role: "RM",
    });
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("returns 401 when session cookie is missing", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({
      code: "UNAUTHORIZED",
      message: "Authentication session required",
      requestId: expect.any(String),
    });
  });

  it("returns 401 when token has invalid signature", async () => {
    const token = signSessionToken(rmUser.id, { secret: "wrong_secret_32_bytes_long_base64_encoded=" });

    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when session token is expired", async () => {
    const fixedPast = 1700000000;
    const expiredToken = signSessionToken(rmUser.id, {
      secret: testSecret,
      clock: () => fixedPast - 4000,
    });

    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${expiredToken}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when user referenced by token was deleted from database", async () => {
    // Generate token for non-existent user ID
    const deletedUserId = "99999999-9999-4999-8999-999999999999";
    const token = signSessionToken(deletedUserId, { secret: testSecret });

    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.message).toContain("user not found");
  });

  it("returns 401 when user does not have RM role", async () => {
    const nonRmUser: UserRecord = {
      id: "33333333-3333-4333-8333-333333333333",
      email: "admin@meridian.local",
      passwordHash: "hash",
      name: "Non RM",
      role: "ADMIN" as unknown as UserRecord["role"],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    userRepository.addUser(nonRmUser);

    const token = signSessionToken(nonRmUser.id, { secret: testSecret });
    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.message).toContain("Relationship Managers");
  });

  it("does not accept or trust client-provided RM identity via query or body", async () => {
    const token = signSessionToken(rmUser.id, { secret: testSecret });

    // Client attempts to pass a spoofed rmId in query string
    const response = await request(app)
      .get("/api/auth/me?rmId=spoofed-id-123")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);

    expect(response.status).toBe(200);
    // Identity strictly matches session token subject
    expect(response.body.id).toBe(rmUser.id);
  });

  it("returns 503 when database is unavailable during session verification", async () => {
    userRepository.findById = async () => {
      throw new DependencyUnavailableError();
    };

    const token = signSessionToken(rmUser.id, { secret: testSecret });
    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("DEPENDENCY_UNAVAILABLE");
  });

  it("confirms public routes (/health, /api/auth/login, /api/auth/logout) do not require session", async () => {
    const healthRes = await request(app).get("/health");
    expect(healthRes.status).toBe(200);

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Origin", testOrigin);
    expect(logoutRes.status).toBe(204);
  });

  it("executes full end-to-end flow: login -> cookie -> /auth/me -> logout -> /auth/me rejected", async () => {
    const password = "ValidPassword123!";
    const passwordHash = await hashPassword(password);
    const rmUser: UserRecord = {
      id: "44444444-4444-4444-8444-444444444444",
      email: "rm2@meridian.local",
      passwordHash,
      name: "RM Two",
      role: "RM",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    userRepository.addUser(rmUser);

    // 1. Login
    const loginRes = await request(app)
      .post("/api/auth/login")
      .set("Origin", testOrigin)
      .send({ email: "rm2@meridian.local", password });

    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers["set-cookie"] as string[] | undefined;
    expect(cookies).toBeDefined();
    const cookieHeader = cookies?.[0] ?? "";

    // 2. Access /auth/me with received cookie
    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Cookie", cookieHeader);

    expect(meRes.status).toBe(200);
    expect(meRes.body.name).toBe("RM Two");

    // 3. Logout
    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Origin", testOrigin)
      .set("Cookie", cookieHeader);

    expect(logoutRes.status).toBe(204);
    const clearedCookies = logoutRes.headers["set-cookie"] as string[] | undefined;
    const clearedCookieHeader = clearedCookies?.[0] ?? "";

    // 4. Access /auth/me with cleared cookie -> 401
    const meAfterLogout = await request(app)
      .get("/api/auth/me")
      .set("Cookie", clearedCookieHeader);

    expect(meAfterLogout.status).toBe(401);
  });
});
