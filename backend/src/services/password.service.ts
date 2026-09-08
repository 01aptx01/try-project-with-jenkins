import bcrypt from "bcrypt";
import { BadRequestError } from "../errors.js";

export const BCRYPT_COST = 12;
export const MAX_PASSWORD_BYTES = 72;

// Precomputed dummy hash with cost 12 for constant-time comparison when user is not found
const DUMMY_HASH = "$2b$12$e8Yh7rG9mKq3u5l2w8n0YeD3mN4b5v6c7x8z9a0b1c2d3e4f5g6h7";

export async function hashPassword(password: string): Promise<string> {
  const byteLength = Buffer.byteLength(password, "utf8");
  if (byteLength > MAX_PASSWORD_BYTES) {
    throw new BadRequestError("Password exceeds maximum allowed length of 72 UTF-8 bytes");
  }
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const byteLength = Buffer.byteLength(password, "utf8");
  if (byteLength > MAX_PASSWORD_BYTES) {
    return false;
  }
  return bcrypt.compare(password, hash);
}

/**
 * Runs a dummy bcrypt comparison against a dummy hash to prevent user enumeration
 * through timing analysis when an email is not found in the database.
 */
export async function dummyVerifyPassword(): Promise<void> {
  await bcrypt.compare("dummy-timing-password", DUMMY_HASH);
}
