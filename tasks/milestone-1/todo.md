# Meridian Milestone 1 tickets

Status values: `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`. A ticket is only `DONE` when its listed verification has evidence.

## M1-001 — Workspace and quality toolchain

**Status:** DONE

**Acceptance criteria:**
- [x] Root npm workspaces, strict TypeScript, ESLint, secret/build ignores and one lockfile exist.
- [x] Root commands run each workspace explicitly for lint, typecheck, unit tests and build.

**Verification:** `npm ci` recreated 375 packages without changing `package-lock.json`; `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build` and Prisma generation passed on 2026-09-08. A second review also verified `.env` loading for Prisma commands and test-connection fail-closed behavior.

**Dependencies:** None

## M1-002 — Testable Express application

**Status:** DONE

**Acceptance criteria:**
- [x] `createApp` is separate from the HTTP listener and usable by Supertest.
- [x] Unknown routes return a common request-ID error envelope without stack traces.

**Verification:** `backend/tests/unit/app.test.ts` passed.

**Dependencies:** M1-001

## M1-003 — Next.js shell and component harness

**Status:** DONE

**Acceptance criteria:**
- [x] The Next.js home page renders the Meridian heading.
- [x] React Testing Library and Vitest execute in a DOM environment.

**Verification:** `frontend/tests/home.test.tsx` and the production Next build passed.

**Dependencies:** M1-001

## Checkpoint A — Workspace scaffold

- [x] Lint, typecheck, backend tests, frontend test and both builds passed on 2026-09-08.

## M1-004 — Local PostgreSQL and environment contract

**Status:** DONE

**Acceptance criteria:**
- [x] Compose defines loopback-only development PostgreSQL, named volume and healthcheck.
- [x] `.env.example` and configuration validation define safe local inputs without requiring M3 JWT settings.
- [x] PostgreSQL starts and persists a sentinel row across restart.

**Verification:** Development PostgreSQL reached healthy state; a temporary sentinel table/value survived restart and was removed afterwards on 2026-09-08.

**Dependencies:** M1-002

## M1-005 — Prisma schema and initial migration

**Status:** DONE

**Acceptance criteria:**
- [x] Users, Clients, Financial Profiles and Goals have mapped names, relations, unique/index constraints and appropriate Decimal/date types.
- [x] Database checks prevent negative financial values and invalid persisted goals while nullable financial inputs remain available.
- [x] Migration applies to empty development and test PostgreSQL databases.

**Verification:** Both committed migrations applied successfully to `meridian` and `meridian_test` on 2026-09-08; Prisma schema validation and generation pass.

**Dependencies:** M1-004

## M1-006 — Family relationship schema

**Status:** DONE

**Acceptance criteria:**
- [x] Canonical pair schema, unique pair index, both foreign keys and reverse-side index exist.
- [x] Normalization tests cover directional reversal and self-relationship rejection.
- [x] Database constraints are exercised against PostgreSQL.

**Verification:** Unit normalization tests pass; integration tests confirm canonical-pair duplicate/reversed rows are rejected by PostgreSQL.

**Dependencies:** M1-005

## Checkpoint B — Schema runtime verification

- [x] Both databases became healthy, migrations applied, and valid/invalid constraint scenarios ran against PostgreSQL.

## M1-007 — Isolated integration-test database

**Status:** DONE

**Acceptance criteria:**
- [x] Compose profile `test` uses a distinct database, credentials, port and named volume.
- [x] Test guard rejects a missing, development or equal test connection before connection/cleanup.
- [x] Test profile starts, migrations apply and the integration suite passes repeatedly without changing development data.

**Verification:** Test database was isolated at `127.0.0.1:5433`; integration suite passed twice before and once after constraint coverage was added.

**Dependencies:** M1-006

## M1-008 — Public readiness endpoint

**Status:** DONE

**Acceptance criteria:**
- [x] Ready database returns `200` with `status` and configured version; no session is required.
- [x] dependency failure and timeout return generic `503` without connection details, while programming faults preserve `500 INTERNAL_ERROR`.
- [x] Live test confirms a stopped/restarted PostgreSQL transitions from `503` back to `200`.

**Verification:** Unit timeout coverage and fault classification pass (503 for timeout/dependency unavailability, 500 for programming faults). Through Caddy, `/health` returned `503 DEPENDENCY_UNAVAILABLE` while PostgreSQL was stopped and returned `200` with `caddy-runtime-check` after readiness recovered.

**Dependencies:** M1-002, M1-007

## M1-009 — Caddy local origin routing

**Status:** DONE

**Acceptance criteria:**
- [x] Optional Compose proxy routes `/api/*` and `/health` to Express and all other paths to Next.js through `localhost:8080`.
- [x] Caddy uses `host.docker.internal` with a host-gateway mapping and loopback-only published port.
- [x] Caddy returns the web page, health response and API 404 envelope live.

**Verification:** Actual Compose Caddy service was verified on `127.0.0.1:8081`: `/` returned Meridian (`200`), `/health` returned API readiness (`200`), and `/api/unknown` returned the API error envelope (`404`). Port 8080 is blocked on this host, so `CADDY_PORT` is configurable.

**Dependencies:** M1-003, M1-008

## Checkpoint C — Runtime path

- [x] Integration database isolation, health readiness recovery and Caddy route checks have passing recorded output.

## M1-010 — Clean-checkout evidence and handoff

**Status:** DONE

**Acceptance criteria:**
- [x] README documents installation, database, migration, native applications, proxy and checks.
- [x] Task plan separates requirements from runtime evidence.
- [x] Integration tests and proxy checks pass against live services with a commit SHA recorded.

**Verification:** Committed under `662e15d` (based on `2933d9e`); Node `v25.2.1`, npm `11.6.2`; `npm ci`, Prisma generation, lint, typecheck, 14 unit tests, 2 integration tests and both builds passed on 2026-09-08. Development/test migrations, volume persistence, health recovery and Caddy routing have live evidence. `npm run test:integration` loads `.env` automatically via `--env-file-if-exists=../.env`. `npm audit --omit=dev` reports three high-severity records through Prisma CLI's `deepmerge-ts` dependency; no forced upgrade was applied.

**Dependencies:** M1-001–M1-009

---

## Milestone 2

- Milestone 2 plan: [tasks/milestone-2/plan.md](../milestone-2/plan.md)
- Milestone 2 tickets: [tasks/milestone-2/todo.md](../milestone-2/todo.md)

