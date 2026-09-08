/**
 * Proxy and Network Configuration for Meridian API.
 *
 * Docker Desktop / Windows NAT Considerations:
 * On Windows with Docker Desktop (WSL2 or Hyper-V backend), Docker creates a virtual network
 * bridge and uses NAT to translate traffic between the host and containers.
 * When Caddy runs inside Docker and forwards requests to `host.docker.internal:3001`:
 * - The socket connection seen by Express originates from Docker's virtual gateway or bridge IP (e.g., 172.x.x.x or 192.168.65.x).
 * - Caddy appends the true client IP to the `X-Forwarded-For` header.
 * - If Express is configured with `trust proxy: false`, Express inspects only the immediate TCP socket IP.
 * - If Express is configured with specific trusted proxies (e.g., "loopback" or specific IP/CIDR), Express trusts only hops added by those proxies.
 * - Untrusted client-sent spoofed `X-Forwarded-For` headers are discarded when calculating `req.ip`,
 *   preventing malicious clients from evading the rate limiter.
 */

export function resolveTrustProxySetting(
  rawSetting: string | boolean | undefined
): boolean | string | string[] {
  if (rawSetting === undefined || rawSetting === false) {
    return false;
  }
  if (rawSetting === true) {
    return true;
  }

  const trimmed = rawSetting.trim();
  if (trimmed === "false") return false;
  if (trimmed === "true") return true;
  if (trimmed === "loopback") return "loopback";

  if (trimmed.includes(",")) {
    return trimmed
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return trimmed;
}
