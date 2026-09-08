import { execSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import { resolve } from "node:path";
import { ensureE2EDatabaseReady } from "./seed-e2e.js";

export interface StackProcesses {
  apiProcess?: ChildProcess;
  webProcess?: ChildProcess;
  appVersion: string;
}

const rootDir = process.cwd();
const activeProcesses: StackProcesses = {
  appVersion: "",
};

const startedContainers = new Set<string>();

export function getGitSha(): string {
  if (process.env.APP_VERSION && process.env.APP_VERSION !== "local") {
    return process.env.APP_VERSION.trim();
  }
  try {
    const sha = execSync("git rev-parse HEAD", { cwd: rootDir, encoding: "utf8" }).trim();
    if (!sha || sha.length < 7) {
      throw new Error(`Invalid git commit SHA: "${sha}"`);
    }
    return sha;
  } catch (err) {
    throw new Error(
      `[E2E Launcher] Failed to determine Git commit SHA. Ensure this is run within a Git repository: ${(err as Error).message}`
    );
  }
}

export async function isPortInUse(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(400);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

function isContainerRunning(containerNameFragment: string): boolean {
  try {
    const out = execSync(`docker ps --filter "name=${containerNameFragment}" --filter "status=running" --format "{{.Names}}"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out.includes(containerNameFragment);
  } catch {
    return false;
  }
}

function validateProductionWebBuild(): void {
  const buildIdPath = resolve(rootDir, "frontend/.next/BUILD_ID");
  if (!existsSync(buildIdPath)) {
    console.log("[E2E Launcher] No Next.js production build found. Running 'npm run build -w @meridian/web'...");
    execSync("npm run build -w @meridian/web", { cwd: rootDir, stdio: "inherit" });
  }
}

async function terminateProcess(proc?: ChildProcess, name?: string): Promise<void> {
  if (!proc || proc.killed || proc.exitCode !== null) return;
  console.log(`[E2E Launcher] Stopping ${name || "child process"} (PID: ${proc.pid})...`);
  try {
    proc.kill("SIGTERM");
    const exited = await Promise.race([
      new Promise<boolean>((res) => proc.once("exit", () => res(true))),
      new Promise<boolean>((res) => setTimeout(() => res(false), 4000)),
    ]);
    if (!exited && proc.exitCode === null) {
      console.warn(`[E2E Launcher] ${name || "Child process"} did not exit after 4s; sending SIGKILL...`);
      proc.kill("SIGKILL");
      await new Promise<void>((res) => proc.once("exit", () => res()));
    }
  } catch {
    // Ignore
  }
}

async function waitForHttp(
  url: string,
  timeoutMs = 30000,
  validator?: (res: Response, body: any) => boolean,
  childProcessesToCheck: Array<{ proc?: ChildProcess; name: string }> = []
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    // Fail-fast if child process died
    for (const { proc, name } of childProcessesToCheck) {
      if (proc && proc.exitCode !== null) {
        throw new Error(
          `[E2E Launcher] Child process "${name}" exited prematurely with code ${proc.exitCode} (signal: ${proc.signalCode}) while waiting for ${url}`
        );
      }
    }

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!validator) {
        if (res.ok) return true;
      } else {
        const body = await res.json().catch(() => null);
        if (validator(res, body)) return true;
      }
    } catch {
      // Retry after delay
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

export async function startE2EStack(): Promise<StackProcesses> {
  try {
    const sha = getGitSha();
    activeProcesses.appVersion = sha;

    console.log(`[E2E Launcher] Starting E2E Infrastructure (Git SHA: ${sha})...`);

    // 1. Preflight port checks
    const [port3101Used, port3100Used, port8180Used] = await Promise.all([
      isPortInUse(3101),
      isPortInUse(3100),
      isPortInUse(8180),
    ]);

    if (port3101Used) {
      throw new Error("[E2E Launcher Preflight] Port 3101 is already in use by another process. Please terminate it first.");
    }
    if (port3100Used) {
      throw new Error("[E2E Launcher Preflight] Port 3100 is already in use by another process. Please terminate it first.");
    }
    if (port8180Used && !isContainerRunning("caddy-e2e")) {
      throw new Error("[E2E Launcher Preflight] Port 8180 is already occupied by a non-caddy-e2e process.");
    }

    // 2. Validate production Next.js build
    validateProductionWebBuild();

    // 3. Ensure postgres-e2e container is up
    const wasPostgresRunning = isContainerRunning("postgres-e2e");
    if (!wasPostgresRunning) {
      console.log("[E2E Launcher] Starting postgres-e2e container on port 5544...");
      execSync("docker compose --profile e2e up -d postgres-e2e", {
        cwd: rootDir,
        stdio: "inherit",
      });
      startedContainers.add("postgres-e2e");
    }

    // 4. Ensure E2E database is ready (readiness check + prisma migrate deploy + seed)
    console.log("[E2E Launcher] Waiting for database readiness, applying migrations, and seeding port 5544...");
    await ensureE2EDatabaseReady();

    // 5. Start Backend E2E API on port 3101
    console.log("[E2E Launcher] Spawning Backend E2E API on port 3101...");
    const tsxCli = resolve(rootDir, "node_modules/tsx/dist/cli.mjs");
    const e2eServerScript = resolve(rootDir, "backend/src/e2e-server.ts");

    const apiProc = spawn(process.execPath, [tsxCli, e2eServerScript], {
      cwd: resolve(rootDir, "backend"),
      env: {
        ...process.env,
        NODE_ENV: "development",
        API_PORT: "3101",
        APP_ORIGIN: "http://127.0.0.1:8180",
        APP_VERSION: sha,
        E2E_DATABASE_URL:
          "postgresql://meridian_e2e:meridian_e2e_password@127.0.0.1:5544/meridian_e2e?schema=public",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    apiProc.stdout?.on("data", (data) => {
      const line = data.toString().trim();
      if (line) console.log(`[API 3101] ${line}`);
    });
    apiProc.stderr?.on("data", (data) => {
      const line = data.toString().trim();
      if (line) console.error(`[API 3101 ERR] ${line}`);
    });

    activeProcesses.apiProcess = apiProc;

    // 6. Start Next.js Frontend on port 3100
    console.log("[E2E Launcher] Spawning Next.js Production Frontend on port 3100...");
    const nextCli = resolve(rootDir, "node_modules/next/dist/bin/next");
    const webProc = spawn(process.execPath, [nextCli, "start", "-H", "0.0.0.0", "-p", "3100"], {
      cwd: resolve(rootDir, "frontend"),
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: "3100",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    webProc.stdout?.on("data", (data) => {
      const line = data.toString().trim();
      if (line) console.log(`[Web 3100] ${line}`);
    });
    webProc.stderr?.on("data", (data) => {
      const line = data.toString().trim();
      if (line) console.error(`[Web 3100 ERR] ${line}`);
    });

    activeProcesses.webProcess = webProc;

    // 7. Start Caddy E2E container on port 8180
    const wasCaddyRunning = isContainerRunning("caddy-e2e");
    if (!wasCaddyRunning) {
      console.log("[E2E Launcher] Starting Caddy E2E reverse proxy on port 8180...");
      execSync("docker compose --profile e2e up -d caddy-e2e", {
        cwd: rootDir,
        stdio: "inherit",
      });
      startedContainers.add("caddy-e2e");
    }

    const trackedChildren = [
      { proc: apiProc, name: "Backend API (3101)" },
      { proc: webProc, name: "Next.js Web (3100)" },
    ];

    // 8. Readiness Verification: wait for Caddy proxy and /health
    console.log("[E2E Launcher] Polling readiness at http://127.0.0.1:8180/health...");
    const isHealthy = await waitForHttp(
      "http://127.0.0.1:8180/health",
      30000,
      (res, body) => res.status === 200 && body?.status === "ok" && body?.version === sha,
      trackedChildren
    );

    if (!isHealthy) {
      throw new Error(
        `[E2E Launcher] Stack failed readiness check at http://127.0.0.1:8180/health within 30s or version did not match expected SHA "${sha}"`
      );
    }

    // 9. Verify Web route is accessible via proxy
    const isWebReady = await waitForHttp("http://127.0.0.1:8180/login", 15000, undefined, trackedChildren);
    if (!isWebReady) {
      throw new Error("[E2E Launcher] Next.js frontend is not accessible through Caddy at http://127.0.0.1:8180/login");
    }

    console.log(`[E2E Launcher] Stack is UP and healthy on single origin http://127.0.0.1:8180 (Version: ${sha})`);
    return activeProcesses;
  } catch (err) {
    console.error("[E2E Launcher Startup Error]", err);
    await stopE2EStack();
    throw err;
  }
}

export async function stopE2EStack(): Promise<void> {
  console.log("[E2E Launcher] Shutting down E2E processes and containers...");

  await Promise.all([
    terminateProcess(activeProcesses.apiProcess, "Backend API (3101)"),
    terminateProcess(activeProcesses.webProcess, "Next.js Web (3100)"),
  ]);

  if (startedContainers.has("caddy-e2e") || isContainerRunning("caddy-e2e")) {
    try {
      execSync("docker compose --profile e2e stop caddy-e2e", {
        cwd: rootDir,
        stdio: "ignore",
      });
    } catch {
      // Ignore
    }
  }

  console.log("[E2E Launcher] Teardown complete.");
}

// Standalone test/cli trigger
if (process.argv[1]?.endsWith("stack-launcher.ts") || process.argv[1]?.endsWith("stack-launcher.js")) {
  startE2EStack()
    .then(() => {
      console.log("[E2E Launcher] Stack running. Press Ctrl+C to stop.");
      process.on("SIGINT", async () => {
        await stopE2EStack();
        process.exit(0);
      });
    })
    .catch(async (err) => {
      console.error("[E2E Launcher Fatal]", err);
      await stopE2EStack();
      process.exit(1);
    });
}
