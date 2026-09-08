import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  dummyVerifyPassword,
  BCRYPT_COST,
} from "../../../src/services/password.service.js";

describe("Password Service", () => {
  it("hashes password with cost 12 and bcrypt $2b$ prefix", async () => {
    const password = "ValidPassword123!";
    const hash = await hashPassword(password);

    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    expect(BCRYPT_COST).toBe(12);

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it("fails verification for wrong password", async () => {
    const hash = await hashPassword("RightPassword123");
    const isValid = await verifyPassword("WrongPassword123", hash);
    expect(isValid).toBe(false);
  });

  it("does not trim password during hashing or verification", async () => {
    const untrimmed = "  passwordWithSpaces  ";
    const trimmed = "passwordWithSpaces";

    const hash = await hashPassword(untrimmed);

    // Trimmed version must NOT match the hash of untrimmed password
    const isTrimmedValid = await verifyPassword(trimmed, hash);
    expect(isTrimmedValid).toBe(false);

    const isUntrimmedValid = await verifyPassword(untrimmed, hash);
    expect(isUntrimmedValid).toBe(true);
  });

  it("handles Unicode characters correctly up to 72 UTF-8 bytes", async () => {
    // "รหัสผ่านภาษาไทย" is 45 UTF-8 bytes
    const thaiPassword = "รหัสผ่านภาษาไทย";
    const byteLen = Buffer.byteLength(thaiPassword, "utf8");
    expect(byteLen).toBeLessThanOrEqual(72);

    const hash = await hashPassword(thaiPassword);
    const isValid = await verifyPassword(thaiPassword, hash);
    expect(isValid).toBe(true);
  });

  it("rejects passwords exceeding 72 UTF-8 bytes to prevent silent bcrypt truncation", async () => {
    // 73 ASCII characters = 73 bytes
    const longPassword = "a".repeat(73);
    await expect(hashPassword(longPassword)).rejects.toThrow(
      "Password exceeds maximum allowed length of 72 UTF-8 bytes"
    );

    // verifyPassword returns false if password is > 72 bytes
    const dummyHash = "$2b$12$e8Yh7rG9mKq3u5l2w8n0YeD3mN4b5v6c7x8z9a0b1c2d3e4f5g6h7";
    const result = await verifyPassword(longPassword, dummyHash);
    expect(result).toBe(false);
  });

  it("dummyVerifyPassword completes without throwing errors", async () => {
    await expect(dummyVerifyPassword()).resolves.toBeUndefined();
  });
});
