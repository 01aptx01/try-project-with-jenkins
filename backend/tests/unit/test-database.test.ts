import { getTestDatabaseUrl } from "../integration/test-database.js";

describe("getTestDatabaseUrl", () => {
  const valid = "postgresql://meridian_test:password@127.0.0.1:5433/meridian_test?schema=public";

  it("accepts the dedicated test database", () => {
    expect(getTestDatabaseUrl({ TEST_DATABASE_URL: valid, DATABASE_URL: "postgresql://dev@127.0.0.1:5432/meridian" })).toBe(valid);
  });

  it("rejects a development database target", () => {
    expect(() => getTestDatabaseUrl({ TEST_DATABASE_URL: "postgresql://dev@127.0.0.1:5432/meridian" })).toThrow("meridian_test@localhost:5433/meridian_test");
  });

  it("rejects a remote host or non-test user", () => {
    expect(() => getTestDatabaseUrl({ TEST_DATABASE_URL: "postgresql://meridian_test:password@database.example:5433/meridian_test" })).toThrow("meridian_test@localhost:5433/meridian_test");
    expect(() => getTestDatabaseUrl({ TEST_DATABASE_URL: "postgresql://other:password@127.0.0.1:5433/meridian_test" })).toThrow("meridian_test@localhost:5433/meridian_test");
  });

  it("rejects a test URL that equals the development URL", () => {
    expect(() => getTestDatabaseUrl({ TEST_DATABASE_URL: valid, DATABASE_URL: valid })).toThrow("must not equal");
  });

  it("redacts credentials from invalid test database URL in error message (AUD-M3-008)", () => {
    const invalidWithSecret = "postgresql://meridian_test:SuperSecretPassword123@database.example:5433/meridian_test";
    try {
      getTestDatabaseUrl({ TEST_DATABASE_URL: invalidWithSecret });
      expect.unreachable("should have thrown");
    } catch (err: unknown) {
      const message = (err as Error).message;
      expect(message).not.toContain("SuperSecretPassword123");
    }
  });
});
