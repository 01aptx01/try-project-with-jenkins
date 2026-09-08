import { z } from "zod";

const environmentSchema = z.object({ DATABASE_URL: z.string().url(), API_PORT: z.coerce.number().int().min(1).max(65535).default(3001), APP_VERSION: z.string().min(1).max(128).default("local") });
export type AppConfig = z.infer<typeof environmentSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.safeParse(environment);
  if (!parsed.success) throw new Error(`Invalid application configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  return parsed.data;
}
