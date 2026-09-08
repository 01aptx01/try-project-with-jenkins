import { z } from "zod";

const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export function isValidBase64Secret(secret: string, minBytes = 32): boolean {
  const trimmed = secret.trim();
  if (!trimmed || !base64Regex.test(trimmed)) return false;
  try {
    const buf = Buffer.from(trimmed, "base64");
    return buf.length >= minBytes;
  } catch {
    return false;
  }
}

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  TEST_DATABASE_URL: z.string().url().optional(),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_VERSION: z.string().min(1).max(128).default("local"),
  APP_ORIGIN: z.string().url().default("http://localhost:8080"),
  JWT_SECRET: z.string().default("xjY5eR1eUVtkUaXjTV4yqAFjhMpt+rDuKUEM3Ucqf/I="),
  TRUSTED_PROXIES: z.string().default("loopback"),
});

export type AppConfig = z.infer<typeof environmentSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.safeParse(environment);
  if (!parsed.success) {
    const invalidFields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid application configuration: ${invalidFields}`);
  }

  const config = parsed.data;

  // Validate JWT_SECRET format and min 32 bytes
  if (!isValidBase64Secret(config.JWT_SECRET, 32)) {
    throw new Error("Invalid application configuration: JWT_SECRET must be a valid base64-encoded string of at least 32 bytes");
  }

  // Production security constraints:
  // 1. Must use HTTPS origin
  // 2. Must not use development/default secret
  if (config.NODE_ENV === "production") {
    if (!config.APP_ORIGIN.startsWith("https://")) {
      throw new Error("Invalid application configuration: APP_ORIGIN must use HTTPS in production");
    }
    const defaultDevSecret = "xjY5eR1eUVtkUaXjTV4yqAFjhMpt+rDuKUEM3Ucqf/I=";
    if (config.JWT_SECRET === defaultDevSecret || !environment.JWT_SECRET) {
      throw new Error("Invalid application configuration: JWT_SECRET must be explicitly set without defaults in production");
    }
  }

  return config;
}
