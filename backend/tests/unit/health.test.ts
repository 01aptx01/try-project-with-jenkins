import request from "supertest";
import { createApp } from "../../src/app.js";

describe("GET /health", () => {
  it("returns readiness and the configured version", async () => {
    const response = await request(createApp({ readiness: { check: async () => undefined }, version: "abc123" })).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", version: "abc123" });
  });

  it("returns 503 without details when database dependency is unavailable", async () => {
    const { DependencyUnavailableError } = await import("../../src/errors.js");
    const response = await request(
      createApp({
        readiness: {
          check: async () => {
            throw new DependencyUnavailableError();
          },
        },
        version: "abc123",
      })
    ).get("/health");
    expect(response.status).toBe(503);
    expect(response.body.error).toMatchObject({ code: "DEPENDENCY_UNAVAILABLE" });
  });

  it("returns 503 when readiness exceeds the timeout", async () => {
    const app = createApp({ readiness: { check: () => new Promise(() => undefined) }, version: "abc123" });
    const response = await request(app).get("/health");
    expect(response.status).toBe(503);
    expect(response.body.error).toMatchObject({ code: "DEPENDENCY_UNAVAILABLE" });
  }, 3_000);

  it("returns 500 when an unexpected programming fault occurs in readiness check", async () => {
    const response = await request(
      createApp({
        readiness: {
          check: async () => {
            throw new TypeError("Cannot read property 'query' of undefined");
          },
        },
        version: "abc123",
      })
    ).get("/health");
    expect(response.status).toBe(500);
    expect(response.body.error).toMatchObject({ code: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    expect(JSON.stringify(response.body)).not.toContain("property");
  });
});
