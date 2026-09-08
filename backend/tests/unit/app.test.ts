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

  it("parses structured JSON body with application/*+json content-type (AUD-M4-004)", async () => {
    const app = createApp({
      readiness: { check: async () => undefined },
      version: "test-sha",
      configureRoutes: (a) => {
        a.post("/api/test-json", (req, res) => {
          res.status(200).json({ received: req.body });
        });
      },
    });

    const response = await request(app)
      .post("/api/test-json")
      .set("Content-Type", "application/vnd.meridian+json")
      .send(JSON.stringify({ hello: "world" }));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: { hello: "world" } });
  });

  it("rejects lookalike MIME types with 415 (AUD-M4-004)", async () => {
    const app = createApp({
      readiness: { check: async () => undefined },
      version: "test-sha",
      configureRoutes: (a) => {
        a.post("/api/test-json", (_req, res) => {
          res.status(200).json({ ok: true });
        });
      },
    });

    const response = await request(app)
      .post("/api/test-json")
      .set("Content-Type", "text/application/json")
      .send(JSON.stringify({ hello: "world" }));

    expect(response.status).toBe(415);
  });
});
