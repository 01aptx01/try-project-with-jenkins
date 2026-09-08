import { loadConfig } from "../../src/config/env.js";

describe("loadConfig", () => {
  it("accepts the minimum API environment", () => {
    expect(loadConfig({ DATABASE_URL: "postgresql://user:password@127.0.0.1:5432/meridian" })).toMatchObject({ API_PORT: 3001, APP_VERSION: "local" });
  });

  it("rejects an invalid database URL without echoing it", () => {
    expect(() => loadConfig({ DATABASE_URL: "not a url" })).toThrow("DATABASE_URL");
  });
});
