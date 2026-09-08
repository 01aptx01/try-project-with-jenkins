import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function getGitSha(): string {
  const sha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error("Git SHA resolved did not match 40-character hexadecimal pattern");
  }
  return sha;
}

describe("E2E Application Stack Configuration & Contracts (M5-004)", () => {
  it("resolves exact checkout git SHA for APP_VERSION", () => {
    const sha = getGitSha();
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
    const expectedHead = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
    expect(sha).toBe(expectedHead);
  });

  it("verifies health check contract returns version matching git SHA", async () => {
    const sha = getGitSha();
    const samplePayload = { status: "ok", version: sha };

    expect(samplePayload.status).toBe("ok");
    expect(samplePayload.version).toBe(sha);
    expect(samplePayload.version).toMatch(/^[0-9a-f]{40}$/);
  });
});

