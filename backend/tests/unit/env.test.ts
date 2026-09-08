import { loadConfig } from "../../src/config/env.js";

describe("loadConfig", () => {
  const validDbUrl = "postgresql://user:password@127.0.0.1:5432/meridian";
  const validSecret = "xjY5eR1eUVtkUaXjTV4yqAFjhMpt+rDuKUEM3Ucqf/I="; // 32 bytes base64

  it("accepts the minimum API environment", () => {
    const config = loadConfig({ DATABASE_URL: validDbUrl });
    expect(config).toMatchObject({
      API_PORT: 3001,
      APP_VERSION: "local",
      NODE_ENV: "development",
      APP_ORIGIN: "http://localhost:8080",
    });
    expect(config.JWT_SECRET).toBeDefined();
  });

  it("rejects an invalid database URL without echoing it", () => {
    expect(() => loadConfig({ DATABASE_URL: "not a url" })).toThrow("DATABASE_URL");
    try {
      loadConfig({ DATABASE_URL: "not a url with sensitive-pass" });
    } catch (err: unknown) {
      expect((err as Error).message).not.toContain("sensitive-pass");
    }
  });

  it("rejects invalid base64 JWT_SECRET", () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: validDbUrl,
        JWT_SECRET: "not-valid-base64-!@#$%",
      })
    ).toThrow("JWT_SECRET");
  });

  it("rejects JWT_SECRET with less than 32 decoded bytes", () => {
    // "c2hvcnQ=" is "short" (5 bytes)
    expect(() =>
      loadConfig({
        DATABASE_URL: validDbUrl,
        JWT_SECRET: "c2hvcnQ=",
      })
    ).toThrow("JWT_SECRET");
  });

  it("rejects non-HTTPS APP_ORIGIN in production mode", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        DATABASE_URL: validDbUrl,
        APP_ORIGIN: "http://example.com",
        JWT_SECRET: validSecret,
      })
    ).toThrow("APP_ORIGIN must use HTTPS in production");
  });

  it("rejects default dev secret in production mode", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        DATABASE_URL: validDbUrl,
        APP_ORIGIN: "https://meridian.example.com",
        // Omitting explicit production JWT_SECRET
      })
    ).toThrow("JWT_SECRET must be explicitly set without defaults in production");
  });

  it("accepts valid production configuration with HTTPS origin and custom secret", () => {
    const customProdSecret = Buffer.from("custom_production_secret_at_least_32_bytes_long!").toString("base64");
    const config = loadConfig({
      NODE_ENV: "production",
      DATABASE_URL: validDbUrl,
      APP_ORIGIN: "https://meridian.example.com",
      JWT_SECRET: customProdSecret,
    });
    expect(config.NODE_ENV).toBe("production");
    expect(config.APP_ORIGIN).toBe("https://meridian.example.com");
  });
});
