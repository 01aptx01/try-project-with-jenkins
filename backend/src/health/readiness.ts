import { DependencyUnavailableError } from "../errors.js";

export interface DatabaseReadiness {
  check(): Promise<void>;
}

export async function checkReadiness(readiness: DatabaseReadiness, timeoutMs = 2_000): Promise<void> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      readiness.check(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new DependencyUnavailableError()), timeoutMs);
      })
    ]);
  } catch (error) {
    if (error instanceof DependencyUnavailableError) throw error;
    throw new DependencyUnavailableError();
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
