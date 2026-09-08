import request from "supertest";
import { createApp } from "../../src/app.js";

describe("GET /health", () => {
  it("returns readiness and the configured version", async () => {
    const response = await request(createApp({ readiness: { check: async () => undefined }, version: "abc123" })).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", version: "abc123" });
  });

  it("returns 503 without database details when readiness fails", async () => {
    const response = await request(createApp({ readiness: { check: async () => { throw new Error("postgresql://secret@host"); } }, version: "abc123" })).get("/health");
    expect(response.status).toBe(503);
    expect(response.body.error).toMatchObject({ code: "DEPENDENCY_UNAVAILABLE" });
    expect(JSON.stringify(response.body)).not.toContain("secret");
  });

  it("returns 503 when readiness exceeds the timeout", async () => {
    const app = createApp({ readiness: { check: () => new Promise(() => undefined) }, version: "abc123" });
    const response = await request(app).get("/health");
    expect(response.status).toBe(503);
  }, 3_000);
});
