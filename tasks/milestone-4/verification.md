# Meridian Milestone 4 — Verification Records

**วันที่เริ่มต้น:** 2026-09-08  
**Repository:** `try-project-with-jenkins`  
**Git Baseline Commit:** `3fb7124` (`main`)  
**สภาพแวดล้อม (Environment):**
- OS: Windows 11 (PowerShell 5.1)
- Node.js: `v25.2.1`
- npm: `11.6.2`
- Docker Desktop:
  - PostgreSQL 17 Dev (Port `127.0.0.1:5432`) — Healthy
  - PostgreSQL 17 Test (Port `127.0.0.1:5433`) — Healthy
  - Caddy 2.10 Reverse Proxy (Port `127.0.0.1:8081`) — Up

---

## 1. M4-001 Verification Record: Handoff Baseline & UI Contracts Check

### 1.1 Docker Services Preconditions
- `caddy`: Up on `127.0.0.1:8081 -> 8080/tcp`
- `postgres`: Up on `127.0.0.1:5432 -> 5432/tcp` (Healthy)
- `postgres-test`: Up on `127.0.0.1:5433 -> 5432/tcp` (Healthy)

### 1.2 Root Quality Gates Execution (Verified Live)
1. **`npm audit`:**
   - Command: `npm audit`
   - Exit code: 0
   - Output: `found 0 vulnerabilities` (0 High, 0 Critical)
2. **`npm run lint`:**
   - Command: `npm run lint`
   - Exit code: 0
   - Output: 0 errors across `@meridian/api` and `@meridian/web`
3. **`npm run typecheck`:**
   - Command: `npm run typecheck`
   - Exit code: 0
   - Output: TypeScript compilation passed cleanly for both workspaces
4. **`npm run test:unit`:**
   - Command: `npm run test:unit`
   - Exit code: 0
   - Results: **172 tests passed** (Backend 171 tests across 22 suites, Frontend 1 test)
5. **`npm run test:integration`:**
   - Command: `npm run test:integration`
   - Exit code: 0
   - Results: **78 tests passed** across 13 test files (Isolated PostgreSQL test DB and live Caddy reverse proxy)
6. **`npm run build`:**
   - Command: `npm run build`
   - Exit code: 0
   - Results: Backend `tsc` compilation to `dist/` and Frontend Next.js 16 (Turbopack) build passed cleanly (0 EPERM errors)

### 1.3 Contract Locking Artifact
- Locked Wire Contracts: [tasks/milestone-4/contract-baseline.md](contract-baseline.md)
- Contracts verified against `backend/src/contracts/api.ts` and runtime response models.

**M4-001 Verdict:** **DONE / PASS**

---

## 2. M4-002 Verification Record: Browser API Client & Typed Contracts

### 2.1 Artifacts Delivered
- Type-only facade: `frontend/lib/api-contracts.ts` (0 runtime dependencies on backend code, Prisma, Express, or Zod)
- Browser fetch client: `frontend/lib/api-client.ts`
  - Relative routing (`/api/*`), credentials `same-origin`, cache `no-store`
  - Caller abort signal + default 10s timeout handling
  - Safe 204 No Content handling without JSON parsing
  - Structured `ApiClientError` with `code`, `status`, `requestId`, `retryAfter`, `details`, `isNetworkError`, `isTimeout`, `isAbort`
  - Zero sensitive log leakage, zero auto-retries for POST
- Typed synthetic fixtures: `frontend/tests/fixtures/api.ts`
- Unit tests: `frontend/tests/api-client.test.ts` (15 test cases)

### 2.2 Test Results
- **Command:** `npm run test:unit -w @meridian/web`
- **Output:** 16 tests passed across 2 test files (`tests/api-client.test.ts` 15 passed, `tests/home.test.tsx` 1 passed)
- **Lint & Typecheck:** 0 errors across `@meridian/api` and `@meridian/web`
- **Production Build:** `npm run build` cleanly succeeded with Next.js Turbopack and zero bundle bleed.

**M4-002 Verdict:** **DONE / PASS**

---

## 3. M4-003 Verification Record: Login Form with Session Cookie

### 3.1 Artifacts Delivered
- Design system base styles: `frontend/app/globals.css` (WCAG AA compliant color tokens, focus rings, accessibility utilities)
- Login component: `frontend/components/login-form.tsx`
  - Required fields, semantic autocomplete, untrimmed password submission
  - Double-submit prevention while pending
  - Error announcements: 401 Credential error, 429 countdown timer with `Retry-After`, 403, 503, Network error
  - Zero storage of credentials in `localStorage` or `sessionStorage`
- Login page: `frontend/app/login/page.tsx`
- Component tests: `frontend/tests/login.test.tsx` (6 test cases)

### 3.2 Test Results
- **Command:** `npm run test:unit -w @meridian/web`
- **Output:** 22 tests passed across 3 test files (15 api-client, 6 login, 1 home)
- **Lint & Typecheck:** 0 errors across workspace
- **Production Build:** `npm run build` cleanly compiled `/login` as a static page with zero errors.

**M4-003 Verdict:** **DONE / PASS**

---

## 4. Checkpoint A Verification Sign-off

- [x] Contract baseline locked in `contract-baseline.md`
- [x] ApiClient tested across all status codes, error handling, cancellation, and timeouts
- [x] LoginForm tested and operational, handling success redirect, 401, 429 retry countdown, and accessibility
- [x] Frontend unit tests (22/22 passed), lint (0 errors), typecheck (0 errors), build (clean)
- [x] Ready to proceed to Checkpoint B (`M4-004` through `M4-006`)
