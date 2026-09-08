# Meridian Comprehensive Codebase Audit Report

**Audit date:** 2026-09-08  
**Audited revision:** `f3df07e` (`main`)  
**Implementation range:** `2933d9e...f3df07e`  
**Scope:** Milestone 1 Foundation, Milestone 2 Financial Domain Implementation, and Post-Fix Verification  
**Overall verdict:** **PASS (ALL HIGH AND MEDIUM FINDINGS RESOLVED)**

---

## Executive Summary

This comprehensive audit evaluates the Meridian codebase following the resolution of findings AUD-001 through AUD-009 identified in the preliminary Milestone 2 review. The evaluation encompasses five core audit dimensions:
1. **Specification & Acceptance Criteria Alignment** (Milestone 1 foundation and Milestone 2 pure financial domain rules).
2. **Standards & Code Smells Axis** (Fowler refactoring smell baseline and architectural conventions).
3. **Security Posture & Defensive Controls** (Express middleware, error handling, database isolation, input boundaries, and supply chain).
4. **Data Integrity & Contract Safety** (JSON-safe public API surface, BigInt rational arithmetic encapsulation, and compile-time type safety).
5. **Operational & Verification Evidence** (Unit tests, integration tests against isolated PostgreSQL, linting, typechecking, and production builds).

All previously identified High (P1) and Medium (P2) defects have been resolved and verified with dedicated automated tests:
- **AUD-001 (Resolved):** `GoalEvaluationResult` has been stripped of internal `BigInt` fields (`progressNumerator`, `progressDenominator`). All public domain output types are strictly JSON-safe and serialize cleanly via `JSON.stringify` without runtime exceptions.
- **AUD-002 (Resolved):** `checkReadiness` and `createPrismaReadiness` now properly differentiate transient database connectivity/readiness failures (returning `503 DEPENDENCY_UNAVAILABLE`) from unexpected application programming defects (such as `TypeError`), which propagate to the global error handler and return `500 INTERNAL_ERROR` without masking.
- **AUD-003 (Resolved):** `generateClientSummary` accepts an explicit `goalsCount` and distinguishes clients with no goals recorded from clients whose goals are invalid or unselected, eliminating misleading claims of absent data.
- **AUD-004 (Resolved):** Primary Goal selection and Next Best Action (NBA) tie-breaking now utilize a unified, locale-independent ordinal comparator (`compareGoalTargetDateThenId`), ensuring deterministic ordering across mixed-case IDs and punctuation.
- **AUD-005 (Resolved):** `calculateHealthResult` implements strict TypeScript function overloads that enforce a mandatory `asOfDate: string` at compile time when raw `GoalInput[]` is passed, while permitting `asOfDate` to be omitted when passing a pre-evaluated `GoalsComponentResult`.
- **AUD-006 & AUD-007 (Resolved):** Goal validation has been consolidated into a single internal evaluation pipeline (`evaluateGoalInternal`), eliminating duplicate validation logic. Valid goals enforce an internal `ExactRatio` invariant with a strictly positive denominator (`denominator > 0n`).
- **AUD-008 (Resolved):** `README.md` task documentation links have been updated to target `tasks/milestone-1/` and `tasks/milestone-2/` accurately.
- **AUD-009 (Resolved):** `docker-compose.yml` documents base image versioning and production immutable digest pinning strategies for Milestone 6.

---

## Audit Method & Scope

The audit was conducted using three primary analytical axes:
- **Plan & Traceability Audit:** Verification of every requirement across `tasks/milestone-1/todo.md`, `tasks/milestone-1/plan.md`, `tasks/milestone-2/todo.md`, and `tasks/milestone-2/plan.md`.
- **Code Review (Standards & Spec Axes):** Inspection of Git diff `2933d9e...HEAD` against Fowler's 12-point code smell baseline, interface coherence, and functional specification.
- **Security & Vulnerability Audit:** Node.js, Express 5, React/Next.js security best practices, secret leakage analysis, database isolation verification, and `npm audit`.

---

## Detailed Findings & Resolution Status

### AUD-001 — Public Goal results contain `bigint` and are not JSON-safe
- **Severity:** High / P1 (Resolved)
- **Locations:** `backend/src/domain/financial/types.ts:75-88`, `backend/src/domain/financial/goals.ts:98-195`, `backend/tests/unit/financial/goals.test.ts:241-282`
- **Resolution:**
  - Removed `progressNumerator` and `progressDenominator` from `GoalEvaluationResult`.
  - Introduced an internal `ExactRatio { readonly numerator: bigint; readonly denominator: bigint }` used strictly within `goals.ts` for scoring arithmetic.
  - Added regression test suites in `goals.test.ts` and `evaluate-client.test.ts` asserting that `JSON.stringify(evaluateGoal(...))` and `JSON.stringify(evaluateClient(...))` serialize without error and contain no BigInt properties.

### AUD-002 — Readiness masks programming faults as database outages
- **Severity:** High / P1 (Resolved)
- **Locations:** `backend/src/health/readiness.ts:7-20`, `backend/src/health/prisma-readiness.ts:4-28`, `backend/tests/unit/health.test.ts:24-40`, `backend/tests/unit/prisma-readiness.test.ts:1-50`
- **Resolution:**
  - Removed the catch-all conversion in `checkReadiness` that unconditionally converted every caught error to `DependencyUnavailableError`.
  - In `createPrismaReadiness`, explicitly translate Prisma connection errors (`PrismaClientInitializationError`, `PrismaClientKnownRequestError`, `PrismaClientRustPanicError`, and network timeouts) to `DependencyUnavailableError`.
  - Allowed unexpected programming errors (e.g., `TypeError`, `ReferenceError`) to bubble up unmasked, causing the Express `errorHandler` to return `500 INTERNAL_ERROR` with a generic message and logged `requestId`.
  - Added unit tests in `health.test.ts` and `prisma-readiness.test.ts` verifying `503` for database outages/timeouts and `500` for unexpected runtime faults.

### AUD-003 — Summary can state that no Goal was recorded when invalid Goals exist
- **Severity:** Medium / P2 (Resolved)
- **Locations:** `backend/src/domain/financial/summary.ts:8-50`, `backend/src/domain/financial/evaluate-client.ts:38-43`, `backend/tests/unit/financial/summary.test.ts:77-104`
- **Resolution:**
  - Enhanced `SummaryContext` with optional `goalsCount?: number`.
  - In `generateClientSummary`:
    - When `goalsCount === 0`: formats truthfully as `"ปัจจุบันไม่มีเป้าหมายทางการเงินที่บันทึกไว้ในระบบ"`.
    - When `goalsCount > 0` and `primaryGoal === null`: formats as `"ปัจจุบันยังไม่สามารถระบุเป้าหมายทางการเงินหลักได้ (ข้อมูลเป้าหมายไม่ครบถ้วนหรือไม่ผ่านเกณฑ์)"`.
    - When `primaryGoal` is present: formats full primary goal metrics.
  - Passed `goalsCount: input.goals.length` from `evaluateClient`.
  - Added automated tests in `summary.test.ts` verifying both branches.

### AUD-004 — Goal tie-breaking depends on locale
- **Severity:** Medium / P2 (Resolved)
- **Locations:** `backend/src/domain/financial/goals.ts:25-33`, `backend/src/domain/financial/primary-goal.ts:1-38`, `backend/src/domain/financial/recommendation.ts:88-90`, `backend/tests/unit/financial/primary-goal.test.ts:169-199`
- **Resolution:**
  - Implemented and exported `compareGoalTargetDateThenId(a, b)`:
    - Primary sort: `targetDate` ascending (earlier date first).
    - Tie-break: `id` ascending via strict ordinal/code-point comparison (`a.id < b.id ? -1 : (a.id > b.id ? 1 : 0)`).
  - Replaced `localeCompare` in both `selectPrimaryGoal` and `evaluateRecommendation` with `compareGoalTargetDateThenId`.
  - Added test in `primary-goal.test.ts` with mixed-case and punctuation IDs (e.g., `'Goal_A'` vs `'goal-a'`), verifying deterministic ordinal ordering.

### AUD-005 — Health API permits a missing `asOfDate` at compile time
- **Severity:** Medium / P2 (Resolved)
- **Locations:** `backend/src/domain/financial/health.ts:28-52`, `backend/tests/unit/financial/health.test.ts:205-220`
- **Resolution:**
  - Defined TypeScript function overloads for `calculateHealthResult`:
    - Overload 1: `(profile: FinancialProfileInput | null, goalsResult: GoalsComponentResult): HealthResult`
    - Overload 2: `(profile: FinancialProfileInput | null, goals: GoalInput[], asOfDate: string): HealthResult`
  - When raw `GoalInput[]` is passed without `asOfDate`, TypeScript rejects the call at compile time.
  - Added runtime guard throwing `Error('asOfDate is required when evaluating raw GoalInput[]')` and corresponding test in `health.test.ts`.

### AUD-006 & AUD-007 — Goal validity duplicated & Exact ratio invariants
- **Severity:** Low / P3 (Resolved)
- **Locations:** `backend/src/domain/financial/goals.ts:40-195`
- **Resolution:**
  - Consolidated validation logic into `evaluateGoalInternal`, eliminating redundant date and amount checks between `evaluateGoal` and `evaluateGoals`.
  - Enforced `ExactRatio` invariant: valid goals must return a non-null `ExactRatio` with `denominator > 0n`. Invalid goals return validation error fields and are excluded from score summation.

### AUD-008 — README pointed to nonexistent task files
- **Severity:** Low / P3 (Resolved)
- **Location:** `README.md:54`
- **Resolution:**
  - Corrected document references in `README.md` to point directly to `tasks/milestone-1/todo.md`, `tasks/milestone-1/plan.md`, `tasks/milestone-2/todo.md`, and `tasks/milestone-2/plan.md`.

### AUD-009 — Local container images mutable tags
- **Severity:** Low / P3 (Resolved)
- **Location:** `docker-compose.yml:3-4`
- **Resolution:**
  - Added documentation comments in `docker-compose.yml` explaining the versioning strategy for local development and documenting that Milestone 6 production CI will pin immutable SHA256 image digests.

---

## Code Review — Standards Axis

Evaluating the codebase against Fowler's 12-point smell baseline:

| Code Smell | Evaluation | Assessment |
|---|---|---|
| **Mysterious Name** | All domain entity names (`Satang`, `ExactRatio`, `HealthResult`, `compareGoalTargetDateThenId`, `roundRationalHalfUp`) are self-documenting and match business rules. | **PASS** |
| **Duplicated Code** | Goal validation logic is unified in `evaluateGoalInternal`. Date/ID sorting is centralized in `compareGoalTargetDateThenId`. | **PASS** |
| **Feature Envy** | Component calculators operate strictly on explicit input parameter slices without inspecting foreign object internals. | **PASS** |
| **Data Clumps** | BigInt rational pairs are bundled in `ExactRatio`. Financial metrics are grouped in `FinancialProfileInput` and `HealthResult`. | **PASS** |
| **Primitive Obsession** | Money amounts are strictly parsed to BigInt satang before arithmetic; exact fractions are kept as BigInt until final half-up rounding. | **PASS** |
| **Repeated Switches** | Priority ranking (`PRIORITY_RANKS`) and health classifications (`classificationMap`) are defined once in single-lookup maps. | **PASS** |
| **Shotgun Surgery** | Domain calculation modules are modular and cohesive; changes to goal scoring or health aggregation do not spill into unrelated files. | **PASS** |
| **Divergent Change** | Financial rules, HTTP routing, database probe, and summary templating are separated into dedicated modules. | **PASS** |
| **Speculative Generality** | No unused generic frameworks or premature abstraction layers exist. Every exported type and function is tested and utilized. | **PASS** |
| **Message Chains** | Deep property navigation is avoided; evaluations consume flat input structures. | **PASS** |
| **Middle Man** | No redundant delegation wrappers exist; domain functions execute business calculations directly. | **PASS** |
| **Refused Bequest** | Inheritance is not used in the domain layer; functionality is composed via pure functions and TypeScript interfaces. | **PASS** |

**Standards Verdict:** **PASS (0 smells detected).**

---

## Code Review — Spec Axis

Evaluating functional compliance against Milestone 1 and Milestone 2 requirements:

| Milestone Requirement | Verification | Spec Compliance |
|---|---|---|
| **M1-008: Health Endpoint** | `GET /health` returns `200` with status and version on healthy DB, `503` on dependency unavailability or timeout, and `500` on programming faults. No database details or secrets leak. | **PASS** |
| **M1-009: Caddy Proxy** | Caddy configuration maps `/api/*` and `/health` to Express and `/` to Next.js on loopback. Verified with running containers. | **PASS** |
| **M1-010: Foundation Evidence** | Verified clean build, integration tests against isolated PostgreSQL 17, and accurate documentation links. | **PASS** |
| **M2-001 / M2-002: Money & Dates** | BigInt satang arithmetic, exact half-up rounding (`roundHalfUp`, `roundRationalHalfUp`), leap year handling, and 4-digit Gregorian date validation. All outputs are JSON-safe. | **PASS** |
| **M2-003: Five Health Components** | Exact threshold comparisons via integer cross-multiplication. Missing fields properly populate `missingFields` array. | **PASS** |
| **M2-004: Goals Evaluation** | Single-pass evaluation, exact rational scoring ($15 \times \text{progress}$), handles start-date edge, due-date edge ($9.00/1000.00 \to 0.14$), and extreme scales ($0.01/10^{15} \to 0.00$). | **PASS** |
| **M2-005: Health Aggregation** | Component weights sum to 100. Boundaries: $<60$ AT_RISK, $60-79.99$ MODERATE, $\ge 80$ GOOD. Strict compile-time and runtime `asOfDate` contract. | **PASS** |
| **M2-006 / M2-007: Primary Goal & NBA** | Deterministic selection using ordinal comparator. NBA priority rules BR-04.1 through BR-04.6 strictly ordered. Near-threshold display prevents contradictory messages. | **PASS** |
| **M2-008: Client Summary** | Deterministic Thai templated summary. Accurately distinguishes between 0 recorded goals and invalid goals. | **PASS** |
| **M2-009: Unified Client Evaluation** | Pure, idempotent entrypoint `evaluateClient`. Reuses single Goal evaluation result across Health, Primary Goal, and NBA. | **PASS** |
| **M2-010: Boundary Matrix & Handoff** | Comprehensive matrix covering all thresholds, missing fields, and date boundaries. 88 financial unit tests passing. | **PASS** |

**Spec Verdict:** **PASS (100% requirements satisfied).**

---

## Security Posture & Dependency Audit

1. **HTTP Security Controls:**
   - Helmet is configured as the top-level middleware, setting defensive headers (`X-Content-Type-Options: nosniff`, framing protection, and removal of `X-Powered-By`).
   - Global error handler catches all unhandled exceptions, logs `requestId` and error details server-side, and returns a standardized `{ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred", requestId } }` payload without stack trace leakage.
2. **Network & Service Boundaries:**
   - PostgreSQL development port `127.0.0.1:5432` and integration test port `127.0.0.1:5433` are strictly bound to loopback.
   - Test database guard enforces connection URL validation (rejecting non-test databases, external hosts, or incorrect ports).
3. **Dependency Vulnerability Analysis:**
   - Production runtime dependency audit (`npm audit --omit=dev --omit=optional`): **0 vulnerabilities found (Clean)**.
   - Upstream advisory GHSA-ggr8-5vv4-36mx in `deepmerge-ts@7.1.5` affects only the Prisma CLI configuration toolchain (`prisma` $\to$ `@prisma/config`), which is classified as an optional/dev engine. It is not included in the runtime API execution path. Prisma configuration in the project is static, preventing stack exhaustion attacks.

---

## Test Execution & Verification Evidence

All tests and quality checks were executed on `2026-09-08` on Windows host with Node.js `v25.2.1`:

| Quality Suite | Command | Result | Details |
|---|---|---|---|
| **Backend Unit Tests** | `npm run test:unit -w @meridian/api` | **PASS** | 15 test files, **107 unit tests passed** (0 failures). |
| **Frontend Unit Tests** | `npm run test:unit -w @meridian/web` | **PASS** | 1 test file, **1 test passed**. |
| **Monorepo Unit Suite** | `npm run test:unit` | **PASS** | 16 test files, **108 unit tests passed** across monorepo. |
| **Integration Suite** | `npm run test:integration -w @meridian/api` | **PASS** | 1 test file, **2 integration tests passed** against isolated PostgreSQL (`127.0.0.1:5433`). |
| **Monorepo Linter** | `npm run lint` | **PASS** | 0 ESLint warnings or errors across all workspaces. |
| **TypeScript Typecheck** | `npm run typecheck` | **PASS** | 0 type errors (`tsc --noEmit` with strict settings). |
| **Monorepo Build** | `npm run build` | **PASS** | Backend (`tsc`) and Frontend (`next build` with Turbopack) compiled cleanly. |

### Breakdown of Financial Domain Unit Tests (88 tests):
- `tests/unit/financial/primitives.test.ts`: **11 tests** (satang parsing, formatting, ratio comparison, leap years, Gregorian dates, exact half-up rounding, BigInt rational rounding).
- `tests/unit/financial/goals.test.ts`: **15 tests** (single goal start-date, in-progress, due-date, overdue, invalid fields, exact half-up $9/1000 \to 0.14$, $0.01/10^{15} \to 0.00$, JSON-safe serialization).
- `tests/unit/financial/health.test.ts`: **8 tests** (component score aggregation, boundaries $59.99, 60, 79.99, 80$, missing field sets, compile-time/runtime `asOfDate` contract, JSON serialization).
- `tests/unit/financial/components.test.ts`: **9 tests** (liquidity, debt, savings, investment scoring and insufficient data handling).
- `tests/unit/financial/primary-goal.test.ts`: **7 tests** (uncompleted vs completed goal selection, earliest target date, ordinal mixed-case tie-breaking).
- `tests/unit/financial/recommendation.test.ts`: **15 tests** (rules BR-04.1 to BR-04.6 precedence, near-threshold non-contradictory messages, ordinal tie-breaking).
- `tests/unit/financial/summary.test.ts`: **7 tests** (Thai client summary templating, truthful empty vs invalid goal wording, missing fields reporting).
- `tests/unit/financial/evaluate-client.test.ts`: **8 tests** (unified pipeline, idempotency, immutability, client priority comparator, full JSON serialization).
- `tests/unit/financial/matrix.test.ts`: **8 tests** (comprehensive boundary matrix verification).

---

## Conclusion & Next Steps

With all findings from AUD-001 through AUD-009 resolved and substantiated by passing test runs, Milestone 1 and Milestone 2 meet all documented acceptance criteria and quality gates.

The codebase is fully prepared for **Milestone 3: Client Data API, Authentication, and RM Ownership Enforcement**.
