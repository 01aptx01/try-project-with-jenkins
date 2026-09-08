# Meridian — Milestone 3 Handover Document
**Milestone:** Milestone 3 (Seed, Authentication, and Client APIs)  
**Handover Target:** Milestone 4 (Frontend Application & Dashboard UI)  
**Date:** 2026-09-08  
**Author:** Pair Programming Agent & Development Team  

---

## 1. Milestone 3 Executive Summary

Milestone 3 successfully establishes the foundational backend services, authentication mechanisms, idempotent dataset seeding, and RESTful API endpoints for the Meridian Relationship Manager (RM) platform.

All 18 tickets (`M3-001` through `M3-018`) and all 6 Checkpoints (`Checkpoint A` through `Checkpoint F`) have been executed, verified, and audited with 100% test pass rate (0 failures), 0 vulnerabilities in `npm audit`, and 0 linting/typecheck errors.

### Test Verification Summary:
- **Unit Tests:** 172 passed (171 backend unit tests across 22 test files, 1 frontend unit test) with 0 failures
- **Integration Tests:** 78 passed (across 13 test files against real PostgreSQL `meridian_test` on port 5433 and fail-closed live Caddy proxy container on port 8081) with 0 failures
- **Dependency Audit:** `npm audit` reports 0 vulnerabilities (High-severity `deepmerge-ts` supply-chain vulnerability GHSA-ggr8-5vv4-36mx resolved via `deepmerge-ts@8.0.2` override)
- **Lint & Typecheck:** 0 errors across workspace (`@meridian/api`, `@meridian/web`)
- **Production Build:** Clean (`next build` & `tsc -p tsconfig.build.json`) with safe output cleaning
- **Live Caddy Proxy Routing:** Fail-closed live network integration through Caddy container on `127.0.0.1:8081` (`caddy-live-smoke.test.ts`)
- **Zero N+1 Query Proof:** Empirically verified at repository and route levels (`GET /api/clients` and `GET /api/dashboard/morning-action-plan`) via Prisma query event monitoring comparing 15 clients vs 20 clients ($O(1)$ constant query count)

---

## 2. Completed Scope & Delivered Endpoints

### 2.1 API Contracts & Wire Formats (`backend/src/contracts/api.ts`)
| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/health` | GET | Public | Database readiness & application version |
| `/api/auth/login` | POST | Public (Origin-checked) | Authenticates RM, returns user summary, sets `meridian_session` HttpOnly cookie |
| `/api/auth/logout` | POST | Public (Origin-checked) | Clears session cookie (204 No Content), stateless logout |
| `/api/auth/me` | GET | Authenticated | Returns current RM session info |
| `/api/clients` | GET | Authenticated | Paginated Client Cards with text search, priority & health filters |
| `/api/clients/:id` | GET | Authenticated | Full Client Profile Snapshot (Client, Profile, Goals, Health, NBA, Summary) |
| `/api/clients/:id/health` | GET | Authenticated | Client Health evaluation projection (`HealthResult`) |
| `/api/clients/:id/recommendations` | GET | Authenticated | Client NBA recommendation projection (`RecommendationResult`) |
| `/api/clients/:id/summary` | GET | Authenticated | Client executive summary projection (`ClientSummaryResponse`) |
| `/api/clients/:id/family` | GET | Authenticated | 1-hop bidirectional Family Graph (nodes & edges) with strict cross-RM isolation |
| `/api/dashboard/morning-action-plan` | GET | Authenticated | Morning Action Plan cards matching Client List cards with `asOfDate` |

---

## 3. Architecture & Security Implementations

1. **Authentication & Session Management:**
   - Stateless JWT tokens (HS256) signed with a minimum 32-byte base64 secret.
   - Delivered exclusively via `meridian_session` cookie (`HttpOnly: true`, `SameSite: Lax`, `Secure` in production).
   - Strict Origin matching (`createOriginGuard`) on state-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`).
   - Brute-force rate limiting on `/api/auth/login` (5 requests / 60 seconds per client IP).
   - Trusted proxy configuration (`resolveTrustProxySetting`): strictly rejects global `trust proxy: true` and string `"true"`; accepts explicit trusted proxy IP/CIDR/`loopback` or `false` to prevent `X-Forwarded-For` spoofing. Tested for both trusted Caddy hops and untrusted direct clients.

2. **Strict RM Ownership Isolation & Anti-Enumeration:**
   - RMs can strictly access and query only clients assigned to their `rmId`.
   - Any access attempt by an RM to another RM's client returns a uniform `404 Not Found` with message `"Client not found"`, preventing client ID enumeration.
   - Family graph queries strictly drop any edges or nodes belonging to other RMs.

3. **Batch Query & Zero N+1 Performance:**
   - Client List and Morning Action Plan endpoints fetch all clients, profiles, and goals for the RM in a single database batch query (`findAllClientsByRmId`).
   - In-memory text search uses Unicode NFC normalization to support Thai and English characters seamlessly.
   - Domain scoring (`evaluateClient`) runs deterministically in-memory using UTC date clock.
   - Verified via Prisma SQL query event monitoring (`$on('query')`) that query count remains strictly constant ($O(1)$, exactly 3 batched SQL queries: 1 client query, 1 profiles IN query, 1 goals IN query) when client count increases from 15 to 20 clients.

4. **Error Classification & Safe Logging:**
   - Database availability failures mapped to `503 DEPENDENCY_UNAVAILABLE`: Prisma initialization errors, panic errors, `P1xxx` network/connection failures, and `P2024` connection pool timeouts.
   - Strict MIME parsing: mutation requests with body require valid JSON media types (`application/json`, charset parameters, structured `application/*+json`), while strictly rejecting lookalikes (`text/application/json`, `application/jsonp`).
   - Sensitive credential redaction in database guard error messages and sanitized Prisma disconnect logs.

5. **Idempotent Seed Runner:**
   - Seed script: `npm run db:seed -- --as-of YYYY-MM-DD`.
   - Seeds 2 Relationship Managers (`rm1@meridian.local`, `rm2@meridian.local`), 30 clients (15 per RM), 30 financial profiles, 30 financial goals, and 8 canonical family relationships.
   - Re-running the seed causes zero duplicate records and zero database resets.
   - Aborts and rolls back on unexpected data collision.

---

## 4. Requirement & Rule Traceability Matrix

### 4.1 Functional Requirements (`docs/context/03-requirements.md`)
| ID | Requirement Focus | Implementation & Test Evidence |
|---|---|---|
| **FR-01** | Login sets secure cookie, logout clears it, expired/invalid session gets 401 | `AuthService`, `auth-login-logout.test.ts`, `auth-me.test.ts`, `acceptance-matrix.test.ts` |
| **FR-02** | Client List returns only owned Client fields and total after filters | `ClientListService`, `client-list-search.test.ts`, `acceptance-matrix.test.ts` |
| **FR-03** | Partial, case-insensitive name/customerCode search works with filters | `ClientListService.searchAndFilterClients`, Unicode NFC normalization, `client-list-search.test.ts` |
| **FR-04** | Priority/Health filter validates enum and reset restores all owned Client | `clientQuerySchema`, `client-list-search.test.ts`, `acceptance-matrix.test.ts` |
| **FR-05** | Morning Action Plan uses derived-result flow and deterministic order | `DashboardController.getMorningActionPlan`, `dashboard-action-plan.test.ts`, `acceptance-matrix.test.ts` |
| **FR-06** | Profile snapshot contains data and one consistent evaluation | `ClientController.getProfileSnapshot`, `client-profile.test.ts`, `acceptance-matrix.test.ts` |
| **FR-07** | Health is deterministic, 0–100 when complete, null when incomplete | `evaluateHealth`, `client-sub-endpoints.test.ts`, `health.test.ts` |
| **FR-08** | Breakdown sums to score and exposes missing component data | `evaluateHealth`, `HealthResult.breakdown`, `components.test.ts`, `client-sub-endpoints.test.ts` |
| **FR-09** | NBA returns one action, reason, priority and rule | `evaluateRecommendation`, `client-sub-endpoints.test.ts`, `recommendation.test.ts` |
| **FR-10** | No NBA is returned without the rule reason that selected it | `evaluateRecommendation`, `acceptance-matrix.test.ts`, `recommendation.test.ts` |
| **FR-11** | One-hop Family graph filters both nodes and edges by RM ownership | `FamilyController.getFamilyGraph`, `family-graph.test.ts`, `acceptance-matrix.test.ts` |
| **FR-12** | Summary is template output from the same evaluation and source data | `generateClientSummary`, `client-sub-endpoints.test.ts`, `acceptance-matrix.test.ts` |
| *FR-13–25* | CI/CD, Jenkins, Docker build, Trivy scan, compose deploy, verify gates | *Milestone 6 Scope* (`docs/context/08-delivery-roadmap.md:51-53`) |

### 4.2 Business Rules (`docs/context/04-business-rules.md`)
| ID | Rule Focus | Implementation & Test Evidence |
|---|---|---|
| **BR-01** | Health score range 0–100 for complete evaluation | `evaluateHealth`, `health.test.ts`, `acceptance-matrix.test.ts` |
| **BR-02** | Health classification (`GOOD` >= 80, `MODERATE` 60–79.99, `AT_RISK` < 60) | `classifyHealth`, `matrix.test.ts`, `acceptance-matrix.test.ts` |
| **BR-03** | Priority classification (`HIGH`, `MEDIUM`, `LOW` with at least 1 reason) | `evaluateRecommendation`, `recommendation.test.ts` |
| **BR-04** | Priority and emergency liquidity precedence rules (`BR-04.1`–`BR-04.6`) | `evaluateRecommendation`, `recommendation.test.ts`, `acceptance-matrix.test.ts` |
| **BR-05** | Recommendation explainability (`action`, `reason`, `priority`, `rule`) | `evaluateRecommendation`, `client-sub-endpoints.test.ts` |
| **BR-06** | Client Summary generated from deterministic template only | `generateClientSummary`, `summary.test.ts`, `client-sub-endpoints.test.ts` |
| **BR-07** | Deployment gate (lint, tests, Docker build, Trivy scan block deploy) | *Milestone 6 Scope* (`docs/context/08-delivery-roadmap.md:51-53`) |
| **BR-08** | Insufficient data handling (`status == INSUFFICIENT_DATA`, `score: null`) | `evaluateClient`, `harness.test.ts`, `acceptance-matrix.test.ts` |
| **BR-09** | Derived Client Results (batch load owned clients -> in-memory evaluate/filter/sort) | `ClientListService`, `DashboardController`, `acceptance-matrix.test.ts` (Empirical $O(1)$ query count) |
| **BR-10** | Primary Goal selection rule & 1-hop Family Network RM isolation | `selectPrimaryGoal`, `PrismaFamilyRepository`, `primary-goal.test.ts`, `family-graph.test.ts` |

### 4.3 Non-Functional Requirements (`docs/context/03-requirements.md` & `05-architecture-and-data.md`)
| ID | Requirement Focus | Implementation & Test Evidence |
|---|---|---|
| **NFR-01** | Cookie/session security, JWT secret min 32 bytes, Origin guard, Rate limiter, Trusted proxy spoofing defense | `origin-guard.ts`, `rate-limiter.ts`, `proxy.ts`, `caddy-flow.test.ts`, `proxy.test.ts` |
| **NFR-02** | API response baseline target (<500 ms) | Target: common API response <500 ms; in-memory evaluation and batch queries ensure fast execution on prototype dataset |
| **NFR-04** | TypeScript strictness, modular architecture, ESLint, config validation | `npm run lint`, `npm run typecheck`, Zod schema validation in `env.ts` |
| **NFR-05** | Testable domain services without controller/database coupling | Pure domain calculation services in `backend/src/financial/`, verified by financial unit tests (`health.test.ts`, `goals.test.ts`, `recommendation.test.ts`, etc.) |
| **NFR-10** | Relational foreign keys and financial constraints in Prisma & seed | `schema.prisma`, `seed.test.ts`, `schema.test.ts` |

---

## 5. Development Guide for Milestone 4 (Frontend UI)

### 5.1 Local Full-Stack Setup
```powershell
# 1. Start Docker services (Postgres & Caddy)
npm run db:up
npm run proxy:up

# 2. Apply database migrations & seed data
npm run db:migrate
npm run db:seed -- --as-of 2026-09-08

# 3. Start Backend API (Port 3001)
npm run dev:api

# 4. In a separate terminal, start Frontend (Port 3000)
npm run dev:web
```

### 5.2 Access via Reverse Proxy
- Access application through Caddy at `http://localhost:8081/` (or configured `CADDY_PORT`).
- All requests to `/api/*` and `/health` are automatically reverse-proxied to `localhost:3001`.
- All other routes are served by Next.js at `localhost:3000`.

### 5.3 Test Credentials
- **RM 1:** `rm1@meridian.local` / `Password123!` (owns clients `C-001` through `C-015`)
- **RM 2:** `rm2@meridian.local` / `Password123!` (owns clients `C-016` through `C-030`)

---

## 6. Checkpoint Verification Sign-off
- [x] **Checkpoint A:** Wire contracts, Bcrypt password hashing, and JWT token signing.
- [x] **Checkpoint B:** RM Login/Logout flow, `meridian_session` cookie, and `GET /api/auth/me`.
- [x] **Checkpoint C:** Idempotent seed runner & isolated test harness on `meridian_test`.
- [x] **Checkpoint D:** Client Profile Snapshot and Client List with Search, Filter & Pagination.
- [x] **Checkpoint E:** Morning Action Plan, Sub-endpoints (`/health`, `/recommendations`, `/summary`), and 1-hop Family Graph.
- [x] **Checkpoint F:** Fail-closed Caddy proxy integration, full Acceptance Matrix with N+1 instrumentation, and M4 handover.

---

## 7. Clean Checkout Verification & Environment Record (M3-018 Evidence)

- **Date:** 2026-09-08
- **Base Commit:** `b632b03`
- **Milestone 3 Commits:** `b8605a3..08500d9` and audit repair commits
- **Environment:**
  - OS: Windows 11 (PowerShell 5.1)
  - Node.js: `v25.2.1`
  - npm: `11.6.2`
  - Docker Desktop: PostgreSQL 17 (Dev: `5432`, Test: `5433`), Caddy 2.10 (Proxy: `8081`)
- **Reproducible Verification Steps & Actual Results:**
  1. `npm ci` -> Clean lockfile install with 0 errors
  2. `npm audit` -> 0 vulnerabilities (0 High, 0 Critical)
  3. `npm run lint` -> 0 errors across `@meridian/api` and `@meridian/web`
  4. `npm run typecheck` -> 0 errors across all workspaces
  5. `npm run test:unit` -> 172 passed (171 backend unit tests, 1 frontend unit test)
  6. `npm run build` -> Next.js static build & backend `tsc` compilation succeeded cleanly
  7. `npm run test:integration` -> 78 passed across 13 test files (real PostgreSQL test DB & fail-closed live Caddy proxy)
  8. `npm run db:seed -- --as-of 2026-09-08` -> Seed completed with 0 errors; re-run confirmed strict idempotency
