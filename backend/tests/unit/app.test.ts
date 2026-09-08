import request from "supertest";
import { createApp } from "../../src/app.js";

describe("API scaffold", () => {
  it("returns the common error envelope for an unknown route", async () => {
    const app = createApp({ readiness: { check: async () => undefined }, version: "test-sha" });
    const response = await request(app).get("/api/unknown");

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({ code: "NOT_FOUND", message: "Route not found" });
    expect(response.body.error.requestId).toEqual(expect.any(String));
  });

  it("includes security headers from helmet and hides x-powered-by", async () => {
    const app = createApp({ readiness: { check: async () => undefined }, version: "test-sha" });
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });
});
