import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../../../src/app.js";
import { InMemoryUserRepository, type UserRecord } from "../../../src/repositories/user.repository.js";
import { AuthService } from "../../../src/services/auth.service.js";
import { AuthController } from "../../../src/controllers/auth.controller.js";
import { createAuthRouter } from "../../../src/routes/auth.routes.js";
import { hashPassword } from "../../../src/services/password.service.js";
import { SESSION_COOKIE_NAME } from "../../../src/config/cookie.js";
import { DependencyUnavailableError } from "../../../src/errors.js";

describe("API: Login & Logout Flow (POST /api/auth/login & POST /api/auth/logout)", () => {
  const testOrigin = "http://localhost:8080";
  const testSecret = "xjY5eR1eUVtkUaXjTV4yqAFjhMpt+rDuKUEM3Ucqf/I=";
  let userRepository: InMemoryUserRepository;
  let authService: AuthService;
  let authController: AuthController;
  let app: ReturnType<typeof createApp>;

  const rmUser: UserRecord = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "rm1@meridian.local",
    passwordHash: "", // filled in beforeEach
    name: "RM One",
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

    app = createApp({
      readiness: { check: async () => undefined },
      version: "test-ver",
      appOrigin: testOrigin,
      configureRoutes: (expressApp) => {
        const authRouter = createAuthRouter({
          authController,
          rateLimiterOptions: { windowMs: 60000, max: 10 },
        });
        expressApp.use("/api/auth", authRouter);
      },
    });
  });

  describe("POST /api/auth/login", () => {
    it("successfully logs in with valid credentials, setting cookie and returning user summary", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .set("Origin", testOrigin)
        .set("Content-Type", "application/json")
        .send({
          email: "rm1@meridian.local",
          password: "ValidPassword123!",
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        user: {
          id: rmUser.id,
          name: "RM One",
          role: "RM",
        },
      });

      // Assert no sensitive tokens or hashes exist in body
      expect(JSON.stringify(response.body)).not.toContain("token");
      expect(JSON.stringify(response.body)).not.toContain("passwordHash");

      // Verify Set-Cookie header
      const cookies = response.headers["set-cookie"] as unknown as string[];
      expect(cookies).toBeDefined();
      const sessionCookie = cookies?.find((c: string) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain("HttpOnly");
      expect(sessionCookie).toContain("Path=/");
      expect(sessionCookie).toContain("SameSite=Lax");
    });

    it("normalizes email address by trimming and lowercasing", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .set("Origin", testOrigin)
        .set("Content-Type", "application/json")
        .send({
          email: "   RM1@MERIDIAN.LOCAL   ",
          password: "ValidPassword123!",
        });

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBeUndefined(); // Email is not in response contract
      expect(response.body.user.id).toBe(rmUser.id);
    });

    it("returns 401 for wrong password with uniform message", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .set("Origin", testOrigin)
        .set("Content-Type", "application/json")
        .send({
          email: "rm1@meridian.local",
          password: "WrongPassword456!",
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toMatchObject({
        code: "UNAUTHORIZED",
        message: "Invalid email or password",
      });
    });

    it("returns 401 for non-existent email with uniform message (with dummy hash comparison)", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .set("Origin", testOrigin)
        .set("Content-Type", "application/json")
        .send({
          email: "non-existent@meridian.local",
          password: "SomePassword123!",
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toMatchObject({
        code: "UNAUTHORIZED",
        message: "Invalid email or password",
      });
    });

    it("returns 400 for malformed payload or extra fields", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .set("Origin", testOrigin)
        .set("Content-Type", "application/json")
        .send({
          email: "rm1@meridian.local",
          password: "ValidPassword123!",
          extraField: "malicious",
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("BAD_REQUEST");
    });

    it("returns 503 when user repository encounters dependency failure", async () => {
      // Mock findByEmail to simulate database outage
      userRepository.findByEmail = async () => {
        throw new DependencyUnavailableError();
      };

      const response = await request(app)
        .post("/api/auth/login")
        .set("Origin", testOrigin)
        .set("Content-Type", "application/json")
        .send({
          email: "rm1@meridian.local",
          password: "ValidPassword123!",
        });

      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe("DEPENDENCY_UNAVAILABLE");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("returns 204 and clears session cookie with matching attributes", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Origin", testOrigin);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});

      const cookies = response.headers["set-cookie"] as unknown as string[];
      expect(cookies).toBeDefined();
      const clearCookie = cookies?.find((c: string) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
      expect(clearCookie).toBeDefined();
      expect(clearCookie).toContain("Path=/");
      expect(clearCookie).toContain("SameSite=Lax");
      expect(clearCookie).toContain("HttpOnly");
      // Expired date or Max-Age=0
      expect(clearCookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
    });

    it("handles idempotent multiple logouts successfully", async () => {
      const res1 = await request(app).post("/api/auth/logout").set("Origin", testOrigin);
      expect(res1.status).toBe(204);

      const res2 = await request(app).post("/api/auth/logout").set("Origin", testOrigin);
      expect(res2.status).toBe(204);
    });

    it("rejects logout request when Origin header does not match", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Origin", "http://unauthorized-origin.com");

      expect(response.status).toBe(403);
    });
  });
});
