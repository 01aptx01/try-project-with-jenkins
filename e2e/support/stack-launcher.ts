import { execFileSync, execSync, spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import { resolve } from "node:path";
import { ensureE2EDatabaseReady } from "./seed-e2e.js";
import { getE2EDatabaseUrl } from "./db-guard.js";

const rootDir = process.cwd();
const processes: ChildProcess[] = [];
let ownedDatabaseId: string | undefined;
const compose = (...args: string[]) => execFileSync("docker", ["compose", "--profile", "e2e", ...args], { cwd: rootDir, encoding: "utf8" }).trim();

export function getGitSha(): string {
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: rootDir, encoding: "utf8" }).trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("Invalid checkout SHA");
  if (process.env.APP_VERSION && process.env.APP_VERSION !== "local" && process.env.APP_VERSION !== sha) {
    throw new Error("APP_VERSION must match the full checkout SHA");
  }
  return sha;
}

export function sourceFingerprint(): string {
  const files = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "frontend", "backend", "e2e", "package.json", "package-lock.json", "tsconfig.base.json", "Caddyfile.e2e"], { cwd: rootDir, encoding: "utf8" });
  const hash = createHash("sha256");
  for (const file of [...new Set(files.split("\0").filter(Boolean))].sort()) {
    hash.update(file).update("\0");
    hash.update(existsSync(resolve(rootDir, file)) ? readFileSync(resolve(rootDir, file)) : "DELETED");
  }
  return hash.digest("hex");
}

export async function isPortInUse(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((done) => {
    const socket = net.createConnection({ port, host });
    const finish = (used: boolean) => { socket.destroy(); done(used); };
    socket.setTimeout(400);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}

function start(command: string, args: string[], env: NodeJS.ProcessEnv): void {
  const child = spawn(command, args, { cwd: rootDir, env, stdio: "inherit", windowsHide: true });
  child.on("error", (error) => console.error("E2E child failed:", error.message));
  processes.push(child);
}

async function stopProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exit = new Promise<void>((done) => child.once("exit", () => done()));
  child.kill("SIGTERM");
  let timer: NodeJS.Timeout | undefined;
  await Promise.race([exit, new Promise<void>((done) => { timer = setTimeout(done, 4000); })]);
  if (timer) clearTimeout(timer);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await Promise.race([exit, new Promise<void>((_, reject) => {
      timer = setTimeout(() => reject(new Error("E2E child did not terminate")), 4000);
    })]).finally(() => { if (timer) clearTimeout(timer); });
  }
}

async function waitForHttp(url: string, sha?: string): Promise<void> {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (processes.some((p) => p.exitCode !== null || p.signalCode !== null)) throw new Error("E2E child exited during readiness");
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        if (!sha) { await response.arrayBuffer(); return; }
        const body = await response.json() as { status?: string; version?: string };
        if (body.status === "ok" && body.version === sha) return;
      } else { await response.arrayBuffer(); }
    } catch { /* retry bounded probe */ }
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error(`Readiness/version check failed: ${url}`);
}

export async function startE2EStack(): Promise<void> {
  try {
    const sha = getGitSha();
    const databaseUrl = getE2EDatabaseUrl();
    const caddy = resolve(process.env.CADDY_BIN || ".tools/caddy.exe");
    if (!existsSync(caddy)) throw new Error("Install native Caddy with e2e/install-caddy.ps1 or set CADDY_BIN");
    for (const port of [3100, 3101, 8180]) {
      if (await isPortInUse(port)) throw new Error(`E2E port ${port} is occupied; existing processes will not be reused or stopped`);
    }
    const fingerprint = sourceFingerprint();
    // Never reuse .next: every acceptance run builds the current working tree.
    execSync("npm run build -w @meridian/web", { cwd: rootDir, stdio: "inherit" });
    execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", "e2e/tsconfig.build-api.json"], { cwd: rootDir, stdio: "inherit" });
    mkdirSync(".tools/e2e-api/backend", { recursive: true });
    writeFileSync(".tools/e2e-api/backend/package.json", '{"type":"module"}\n');
    if (sourceFingerprint() !== fingerprint) throw new Error("Source changed during build; rerun acceptance");
    writeFileSync(".tools/e2e-provenance.json", JSON.stringify({ sha, fingerprint, builtAt: new Date().toISOString(), dirty: Boolean(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()), nextBuildId: readFileSync("frontend/.next/BUILD_ID", "utf8").trim() }, null, 2));
    const existingId = compose("ps", "--status", "running", "-q", "postgres-e2e");
    if (!existingId) {
      try { compose("up", "-d", "postgres-e2e"); }
      finally { ownedDatabaseId = compose("ps", "-a", "-q", "postgres-e2e") || undefined; }
    }
    await ensureE2EDatabaseReady();
    const env = { ...process.env, NODE_ENV: "development", APP_VERSION: sha, E2E_DATABASE_URL: databaseUrl };
    start(process.execPath, [".tools/e2e-api/backend/src/e2e-server.js"], env);
    start(process.execPath, ["node_modules/next/dist/bin/next", "start", "frontend", "-H", "127.0.0.1", "-p", "3100"], { ...process.env, NODE_ENV: "production" });
    execFileSync(caddy, ["validate", "--config", "Caddyfile.e2e", "--adapter", "caddyfile"], { stdio: "inherit" });
    start(caddy, ["run", "--config", "Caddyfile.e2e", "--adapter", "caddyfile"], process.env);
    await waitForHttp("http://127.0.0.1:8180/health", sha);
    await waitForHttp("http://127.0.0.1:8180/login");
    console.log(`[E2E provenance] SHA=${sha} source=${fingerprint}; compiled API/local HTTP + Next production build`);
  } catch (error) {
    await stopE2EStack();
    throw error;
  }
}

export async function stopE2EStack(): Promise<void> {
  const results = await Promise.allSettled(processes.splice(0).map(stopProcess));
  if (ownedDatabaseId) {
    const id = ownedDatabaseId;
    ownedDatabaseId = undefined;
    execFileSync("docker", ["stop", id], { stdio: "inherit", timeout: 30000 });
  }
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
}
