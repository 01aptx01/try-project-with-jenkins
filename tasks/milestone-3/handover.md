# Meridian — Milestone 3 Handover Document
**Milestone:** Milestone 3 (Seed, Authentication, and Client APIs)  
**Handover Target:** Milestone 4 (Frontend Application & Dashboard UI)  
**Date:** 2026-09-08  
**Author:** Pair Programming Agent & Development Team  

---

## 1. Milestone 3 Executive Summary

Milestone 3 successfully establishes the foundational backend services, authentication mechanisms, idempotent dataset seeding, and RESTful API endpoints for the Meridian Relationship Manager (RM) platform.

All 18 tickets (`M3-001` through `M3-018`) and all 6 Checkpoints (`Checkpoint A` through `Checkpoint F`) have been executed, verified, and closed with 100% test coverage and zero linting/typecheck errors.

### Test Verification Summary:
- **Unit Tests:** 164 passed (163 backend, 1 frontend)
- **Integration Tests:** 71 passed (12 test suites against real PostgreSQL `meridian_test`)
- **Lint & Typecheck:** 0 errors across workspace (`@meridian/api`, `@meridian/web`)
- **Production Build:** Clean (`next build` & `tsc -p tsconfig.build.json`)

---

## 2. Completed Scope & Delivered Endpoints

### 2.1 API Contracts & Wire Formats (`backend/src/contracts/api.ts`)
| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/health` | GET | Public | Database readiness & application version |
| `/api/auth/login` | POST | Public | Authenticates RM, returns user summary, sets `meridian_session` HttpOnly cookie |
| `/api/auth/logout` | POST | Authenticated | Clears session cookie (204 No Content) |
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
   - Stateless JWT tokens (HS256) signed with a minimum 32-byte secret.
   - Delivered exclusively via `meridian_session` cookie (`HttpOnly: true`, `SameSite: Lax`, `Secure` in production).
   - Strict Origin matching (`createOriginGuard`) on state-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`).
   - Brute-force rate limiting on `/api/auth/login` (5 requests / 60 seconds per client IP).
   - Trusted proxy configuration (`TRUSTED_PROXIES`) preventing `X-Forwarded-For` spoofing.

2. **Strict RM Ownership Isolation & Anti-Enumeration:**
   - RMs can strictly access and query only clients assigned to their `rmId`.
   - Any access attempt by an RM to another RM's client returns a uniform `404 Not Found` with message `"Client not found"`, preventing client ID enumeration.
   - Family graph queries strictly drop any edges or nodes belonging to other RMs.

3. **Batch Query & Zero N+1 Performance:**
   - Client List and Morning Action Plan endpoints fetch all clients, profiles, and goals for the RM in a single database batch query (`findAllClientsByRmId`).
   - In-memory text search uses Unicode NFC normalization to support Thai and English characters seamlessly.
   - Domain scoring (`evaluateClient`) runs deterministically in-memory using UTC date clock.
   - Verified via integration tests that database queries do not increase with client count.

4. **Idempotent Seed Runner:**
   - Seed script: `npm run db:seed -- --as-of YYYY-MM-DD`.
   - Seeds 2 Relationship Managers (`rm1@meridian.local`, `rm2@meridian.local`), 30 clients (15 per RM), 30 financial profiles, 30 financial goals, and 8 canonical family relationships.
   - Re-running the seed causes zero duplicate records and zero database resets.
   - Aborts and rolls back on unexpected data collision.

---

## 4. Requirement & Rule Traceability Matrix

| Requirement / Rule | Description | Implementation / Test Evidence |
|---|---|---|
| **FR-01** | RM Login & Session | `AuthService`, `auth-login-logout.test.ts`, `auth-me.test.ts` |
| **FR-02** | Client Profile Snapshot | `ClientController.getProfileSnapshot`, `client-profile.test.ts` |
| **FR-03** | Client Sub-endpoints | `ClientController` (`health`, `recommendations`, `summary`), `client-sub-endpoints.test.ts` |
| **FR-04** | Client List Search & Filter | `ClientListService`, `client-list-search.test.ts` |
| **FR-05** | Morning Action Plan | `DashboardController`, `dashboard-action-plan.test.ts` |
| **FR-06** | 1-hop Family Graph | `FamilyController`, `family-graph.test.ts` |
| **BR-01–BR-07** | Financial Matrix & NBA | Pure domain functions from Milestone 2 integrated into all endpoints |
| **BR-08** | Incomplete Data Handling | Returns `INSUFFICIENT_DATA` without crashing, tested via anomaly fixtures |
| **NFR-Sec** | Origin check, Rate limit, No-Store | `origin-guard.ts`, `rate-limiter.ts`, `acceptance-matrix.test.ts` |
| **NFR-Perf** | Batch query, Zero N+1 | `acceptance-matrix.test.ts` (monitored batch query) |

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
- Access application through Caddy at `http://localhost:8080/` (or configured `CADDY_PORT`).
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
- [x] **Checkpoint F:** Caddy proxy integration, full Acceptance Matrix, and M4 handover.
