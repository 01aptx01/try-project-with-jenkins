import { resolveTrustProxySetting } from "../../src/config/proxy.js";

describe("resolveTrustProxySetting", () => {
  it("defaults to false when undefined or false", () => {
    expect(resolveTrustProxySetting(undefined)).toBe(false);
    expect(resolveTrustProxySetting(false)).toBe(false);
    expect(resolveTrustProxySetting("false")).toBe(false);
  });

  it("strictly rejects global true (boolean and string)", () => {
    expect(() => resolveTrustProxySetting(true)).toThrow(
      "Global 'trust proxy: true' is insecure and strictly disallowed"
    );
    expect(() => resolveTrustProxySetting("true")).toThrow(
      "Global 'trust proxy: true' is insecure and strictly disallowed"
    );
    expect(() => resolveTrustProxySetting("TRUE")).toThrow(
      "Global 'trust proxy: true' is insecure and strictly disallowed"
    );
    expect(() => resolveTrustProxySetting(" true ")).toThrow(
      "Global 'trust proxy: true' is insecure and strictly disallowed"
    );
    expect(() => resolveTrustProxySetting("127.0.0.1, true")).toThrow(
      "Global 'trust proxy: true' is insecure and strictly disallowed"
    );
  });

  it("accepts loopback", () => {
    expect(resolveTrustProxySetting("loopback")).toBe("loopback");
  });

  it("accepts single IP or subnet", () => {
    expect(resolveTrustProxySetting("127.0.0.1")).toBe("127.0.0.1");
    expect(resolveTrustProxySetting("172.18.0.0/16")).toBe("172.18.0.0/16");
  });

  it("parses comma-separated trusted proxy list", () => {
    expect(resolveTrustProxySetting("127.0.0.1, 10.0.0.1")).toEqual([
      "127.0.0.1",
      "10.0.0.1",
    ]);
  });
});
