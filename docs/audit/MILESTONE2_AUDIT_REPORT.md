# Meridian Current Code Audit Report

**Audit date:** 2026-09-08  
**Audited revision:** `f0de199` (`main`)  
**Implementation range:** `2933d9e...f0de199`  
**Scope:** Milestone 1 foundation and Milestone 2 financial domain implementation  
**Overall verdict:** **NEEDS CHANGES**

## Executive summary

The latest Milestone 2 fix resolves the previously demonstrated Goal rounding/`NaN` defects, validates `asOfDate` before the empty-Goal return, reuses one Goal evaluation in `evaluateClient`, adds the missing `79.99` classification assertion, and makes near-threshold NBA messages less contradictory. The schema, exact threshold comparisons, isolated test-database guard, generic HTTP error envelope, Helmet middleware, loopback-bound Compose services, and pure financial-domain boundary are sound foundations.

The audit nevertheless found two high-priority specification failures and several medium-priority contract and truthfulness issues. The most important are a public Goal result that contains `bigint` and cannot be serialized as JSON, and readiness logic that turns programming faults into `503 DEPENDENCY_UNAVAILABLE`. Milestones 1 and 2 should not be treated as fully closed until the affected tickets and evidence are reopened and corrected.

No Critical vulnerability was confirmed in the currently reachable application surface. The only implemented HTTP product endpoint is public `GET /health`; authentication, RM ownership checks, Client APIs, state-changing endpoints, and product UI are explicitly deferred to later milestones and were not assessed as implemented controls.

## Audit method and limits

The audit used three complementary skills:

- `plan-audit`: implementation-to-ticket and acceptance-criteria traceability.
- `code-review`: separate Standards and Spec reviews over `git diff 2933d9e...HEAD`.
- `security-best-practices`: Express, Next.js, React, browser JavaScript, dependency and secret-handling review.

The inspection covered tracked application/configuration files, Prisma schema and migrations, unit/integration test source, task plans, current Git history, high-signal security patterns, `git diff --check`, and `npm audit --omit=dev --json`. The `plan-audit` workflow explicitly defines this as an inspection pass, so application tests, builds, live PostgreSQL, and Caddy were **not rerun** in this audit. Test counts in task files are documentary evidence from earlier runs, not fresh results.

The `code-review` skill expects `docs/agents/issue-tracker.md`; that file is absent. The local task plans and context documents were therefore used directly as the specification source. No repository-specific `AGENTS.md`, `CODING_STANDARDS.md`, or `CONTRIBUTING.md` was found, so the Standards axis uses only the skill's code-smell baseline and labels those findings as judgment calls.

The worktree became dirty during the audit through an external rename of the previous audit file: `docs/audit/CODEBASE_AUDIT_REPORT.md` is deleted and `docs/audit/MILESTONE1_AUDIT_REPORT.md` is untracked. Those changes were preserved and were not made or altered by this audit.

## Findings ordered by severity

### AUD-001 — Public Goal results contain `bigint` and are not JSON-safe

**Severity:** High / P1  
**Work items:** M2-001, M2-002, M2-004, M2-010  
**Locations:** `tasks/milestone-2/plan.md:16`; `backend/src/domain/financial/types.ts:78-90`; `backend/src/domain/financial/goals.ts:84-85,108-109,143-144`; `backend/src/domain/financial/index.ts:1-5`

**Evidence:** The plan requires public output to contain no BigInt types. `GoalEvaluationResult` publicly exposes optional `progressNumerator` and `progressDenominator` as `bigint`; `evaluateGoal` populates them, and the barrel exports both the type and function. Native `JSON.stringify` throws when either field is present.

**Impact:** A later API or logging path that serializes an exported Goal evaluation can fail at runtime even though the calculation itself succeeds. This also makes the declared serialized-output acceptance criterion false.

**Expected behavior:** Exact rational state remains internal. Public Goal output contains only JSON-safe values while preserving the documented decimal-string and numeric-score contracts.

**Suggested fix:** Introduce a private/internal evaluated-goal type containing an `ExactRatio`, then project it to a public `GoalEvaluationResult` without BigInt fields. Alternatively, keep an internal calculation context separate from API/domain output. Add a test that serializes every public evaluation result.

### AUD-002 — Readiness masks programming faults as database outages

**Severity:** High / P1  
**Work items:** M1-008, M1-010  
**Locations:** `tasks/milestone-1/plan.md:13`; `backend/src/health/readiness.ts:16-18`; `backend/tests/unit/health.test.ts:11-22`

**Evidence:** `checkReadiness` catches every error other than an existing `DependencyUnavailableError` and replaces it with that error. A `TypeError` or other programming defect in the readiness adapter therefore returns `503`, although the plan requires application faults to remain `500`. Existing tests exercise a generic thrown `Error` as though every such error represented database unavailability and do not distinguish fault classes.

**Impact:** Operational monitoring can interpret a code regression as a transient dependency incident. The real defect is hidden from status classification and incident routing.

**Expected behavior:** Known database connectivity/readiness failures and probe timeouts return generic `503`; unexpected application errors reach the centralized `500` handler without leaking details.

**Suggested fix:** Translate known Prisma connectivity errors inside the Prisma adapter, keep the timeout typed as dependency unavailability, and let unexpected errors propagate. Add separate tests for known database failure, timeout, and programming error.

### AUD-003 — Summary can state that no Goal was recorded when invalid Goals exist

**Severity:** Medium / P2  
**Work items:** M2-008, FR-12, BR-06  
**Locations:** `docs/context/03-requirements.md:14`; `docs/context/04-business-rules.md:91-93`; `backend/src/domain/financial/summary.ts:40-47`; `backend/tests/unit/financial/summary.test.ts:56-75`

**Evidence:** When `primaryGoal` is `null`, the template says that no primary financial Goal is recorded. `primaryGoal` is also `null` when Goals exist but all are invalid. The formatter receives no field that distinguishes “no Goals” from “Goals exist but none qualifies.” The current null-primary test covers only the generic branch.

**Impact:** The Client Summary can fabricate an absence of data and conflict with `INSUFFICIENT_DATA`/`missingFields`, violating the source-only summary rule.

**Expected behavior:** The wording distinguishes no Goals from an unavailable primary Goal. It must not claim that nothing was recorded when invalid records exist.

**Suggested fix:** Pass an explicit Goal-state/result into the summary context, or use neutral wording such as “ยังไม่สามารถระบุเป้าหมายหลักได้” for the ambiguous state. Test empty Goals and all-invalid Goals separately.

### AUD-004 — Goal tie-breaking depends on locale

**Severity:** Medium / P2  
**Work items:** M2-006, M2-007, BR-10  
**Locations:** `docs/context/04-business-rules.md:100`; `backend/src/domain/financial/primary-goal.ts:23-30`; `backend/src/domain/financial/recommendation.ts:90-95`

**Evidence:** Both Goal selectors use `localeCompare`, while the contract calls for lexical/ordinal ascending order. The Client comparator already implements ordinal `<`/`>` comparison. For mixed-case IDs, locale and ordinal order can differ.

**Impact:** The chosen Primary Goal or NBA reason can vary from the specified ordering and potentially across runtime/ICU configurations.

**Expected behavior:** The same input produces the same ordinal result independent of locale.

**Suggested fix:** Extract one target-date-then-ordinal-ID comparator and reuse it in both selectors. Add mixed-case and punctuation tie cases, or constrain Goal IDs to canonical UUID format at the boundary and document that invariant.

### AUD-005 — Health API permits a missing `asOfDate` at compile time

**Severity:** Medium / P2  
**Work items:** M2-005, M2-009  
**Locations:** `tasks/milestone-2/plan.md:5,12`; `backend/src/domain/financial/health.ts:28-39`

**Evidence:** `calculateHealthResult` accepts `GoalInput[] | GoalsComponentResult`, but declares `asOfDate` optional and suppresses the invalid raw-Goal branch with `asOfDate!`. `calculateHealthResult(profile, rawGoals)` therefore typechecks and fails only at runtime.

**Impact:** The public TypeScript contract admits a state the plan explicitly disallows and moves an avoidable integration failure beyond compile time.

**Expected behavior:** Raw Goals always require an explicit validated date; a pre-evaluated Goals result does not.

**Suggested fix:** Use overloads, separate `calculateHealthFromGoals`/`aggregateHealth` functions, or a discriminated context type. Remove the non-null assertion and the unused `HealthEvaluationContext` unless it becomes the enforced contract.

### SEC-001 — Prisma toolchain retains a High upstream advisory

**Rule:** EXPRESS-DEPS-001 / NEXT-SUPPLY-001 / REACT-SUPPLY-001  
**Severity:** Upstream High; current project exposure Medium  
**Location:** `package-lock.json:1651-1659,3344,5159-5163`; `backend/package.json` Prisma dependencies

**Evidence:** On 2026-09-08, `npm audit --omit=dev --json` returned three High records and exit code 1: `prisma@6.19.3` → `@prisma/config@6.19.3` → `deepmerge-ts@7.1.5`, affected by GHSA-ggr8-5vv4-36mx (recursive-object merge stack exhaustion, `<8.0.0`). A fix is reported as available. No Critical advisory was returned.

**Impact:** Malicious recursive configuration input could exhaust the stack in an affected merge path. The observed dependency is primarily Prisma configuration/tooling rather than a demonstrated public request path, which lowers current exploitability, but the project's future HIGH/CRITICAL deployment gate may block the build.

**Fix:** Evaluate a compatible Prisma release that removes the affected dependency, regenerate the lockfile through the normal upgrade flow, rerun unit/integration/schema checks, and rerun the audit. Do not use force-upgrade or suppress the advisory merely to pass a gate.

**Mitigation:** Keep Prisma configuration static and trusted; do not accept request/user-controlled objects into configuration merging.

**False-positive note:** `npm audit --omit=dev` still reports Prisma because of its relationship with `@prisma/client` and the resolved workspace tree. Confirm the final production image contents separately in Milestone 6.

### AUD-006 — Goal validity is implemented in two places

**Severity:** Low / P3  
**Work items:** M2-004, M2-009  
**Locations:** `backend/src/domain/financial/goals.ts:18-49`; `backend/src/domain/financial/goals.ts:170-205`

**Evidence:** `evaluateGoals` repeats amount/date/range validation to collect `missingFields`, then calls `evaluateGoal`, which performs the same validation again.

**Impact:** A future rule change must be made twice; drift can make `missingFields` disagree with `isValid`. It also weakens the claim of a single-pass Goal evaluation.

**Suggested fix:** Return structured validation issues from the single Goal evaluator or extract one shared validator used once per Goal.

### AUD-007 — Exact ratio invariants are optional and silently defaulted

**Severity:** Low / P3  
**Work items:** M2-001, M2-004  
**Locations:** `backend/src/domain/financial/types.ts:78-92`; `backend/src/domain/financial/goals.ts:222-225`

**Evidence:** A valid Goal's exact ratio is represented by two independently optional fields. Aggregation silently substitutes `0/1` if either is absent.

**Impact:** A malformed “valid” evaluation can quietly reduce the score instead of failing an internal invariant.

**Suggested fix:** Use a discriminated valid/invalid internal result and one non-optional `ExactRatio { numerator, denominator }` for the valid branch. Validate a positive denominator at construction.

### AUD-008 — README points to nonexistent task files

**Severity:** Low / P3  
**Work item:** M1-010  
**Location:** `README.md:54`

**Evidence:** The README links to `tasks/todo.md` and `tasks/plan.md`; neither path exists. The actual files live under `tasks/milestone-1/` and `tasks/milestone-2/`.

**Impact:** A developer following the handoff cannot reach the recorded verification evidence from the project README.

**Suggested fix:** Link a task index or both milestone directories explicitly.

### AUD-009 — Local container images are mutable tags

**Severity:** Low / P3  
**Work items:** M1-004, M1-009  
**Location:** `docker-compose.yml:3,17,32`

**Evidence:** PostgreSQL uses `postgres:17-alpine` and Caddy uses `caddy:2.10-alpine` without image digests.

**Impact:** A clean checkout at a later date can pull different bits despite unchanged source. This affects reproducibility and supply-chain traceability, although this Compose file is currently local-development scope.

**Suggested fix:** At minimum record tested resolved image digests in verification evidence. For CI/production artifacts in Milestone 6, pin approved digests and update them deliberately.

## Plan gaps summary

| Work item | Status from this audit | Missing or partial acceptance |
|---|---|---|
| M1-001–M1-007 | No blocking gap found by inspection | Runtime/database evidence was not rerun. |
| M1-008 | **Partial** | Programming errors are not preserved as `500` (AUD-002). |
| M1-009 | No blocking gap found by inspection | Live Caddy routing was not rerun; local-only scope is correctly documented. |
| M1-010 | **Partial** | README evidence links are broken (AUD-008), and the current dirty worktree is not clean-checkout evidence. |
| M2-001/M2-002 | **Partial** | Public serialization contract is broken by BigInt fields (AUD-001); exact ratio invariant is weak (AUD-007). |
| M2-003 | No blocking gap found by inspection | Exact threshold comparisons use integer cross-multiplication. |
| M2-004 | **Partial** | Output contract and duplicated validation remain (AUD-001, AUD-006, AUD-007). |
| M2-005 | **Partial** | Raw-Goal overload admits missing evaluation date (AUD-005). |
| M2-006/M2-007 | **Partial** | Goal tie-break is locale-dependent (AUD-004). |
| M2-008 | **Partial** | All-invalid Goal state can produce a fabricated absence statement (AUD-003). |
| M2-009 | Mostly complete | `evaluateClient` now reuses one `GoalsComponentResult`; public helper contracts still need AUD-005/AUD-006 cleanup. |
| M2-010 | **Reopen** | Evidence claims complete boundary/contract coverage while AUD-001–AUD-005 remain untested or contradicted. |

## Test coverage gaps

The following tests are missing or insufficient based on source inspection:

1. Serialize each public financial result with `JSON.stringify`, especially valid pre-start, in-progress and due-date Goal evaluations.
2. Readiness test matrix distinguishing typed dependency failure (`503`), timeout (`503`), and programming fault (`500`).
3. Summary cases for no Goals, all-invalid Goals, and mixed valid/invalid Goals, asserting truthful wording.
4. Primary Goal and NBA Goal-selection ties using mixed case and punctuation, or runtime validation that restricts IDs to canonical UUIDs.
5. Compile-time contract coverage proving raw Goals cannot be passed to Health calculation without `asOfDate`.
6. Internal invariant test proving every valid Goal has one complete, positive-denominator exact ratio and invalid Goals never enter aggregation.
7. A clean-checkout verification after fixes: install, lint, typecheck, unit tests, build, migrations/integration suite, and Caddy readiness transition. These are follow-up execution requirements, not results of this inspection.

## Security posture

### Confirmed controls

- `helmet()` is installed before routes; existing tests inspect `nosniff`, framing protection and removal of `X-Powered-By`.
- The API has custom 404/500 envelopes and does not return stack traces.
- Prisma queries found in source use ORM methods or tagged `$queryRaw` templates; no unsafe raw SQL call was found.
- PostgreSQL and Caddy published ports are bound to `127.0.0.1`; development and integration databases use separate ports, credentials and named volumes.
- `.env` variants are ignored while `.env.example` remains tracked. The tracked-source secret-pattern scan found no confirmed private key, access token or committed production credential.
- No `dangerouslySetInnerHTML`, direct DOM HTML sink, dynamic code execution, browser token storage, `postMessage`, untrusted redirect, user-controlled outbound request, file upload, command execution, or Node inspector path was found in implemented source.
- The frontend currently renders only static React content through normal JSX escaping.

### Deferred controls, not current defects

JWT cookies, login rate limiting, Origin/CSRF checks, RM ownership, Client endpoint validation, `Cache-Control: no-store`, trusted-proxy configuration, production TLS, Trivy enforcement, and deploy verification belong to Milestones 3 and 6. They must be implemented before exposing Client data or state-changing routes. Their absence from the current public-health-only scaffold is not counted as an implemented vulnerability.

### Security notes and risks

- `backend/src/app.ts:41` logs raw unexpected error objects. No current request path was shown to place secrets in such an error, but future auth/financial routes must introduce structured redaction before logging request-derived or credential-bearing errors.
- Helmet protects Express responses, while the Next.js app shell currently has no repository-visible CSP/edge-header policy. The current page contains no untrusted content. Verify and implement the final header policy when the product UI and production Caddy configuration are introduced.
- The native API listens on `0.0.0.0` for local Docker-to-host Caddy routing. Production must keep the API port unexposed and configure proxy trust to match the actual one-proxy topology.

## Code review — Standards axis

No documented repository coding standard was found, so there are no hard standards violations. The following are heuristic findings:

1. **Possible Duplicated Code:** Goal validation occurs in both `evaluateGoal` and `evaluateGoals` (AUD-006).
2. **Possible Primitive Obsession/Data Clump:** exact ratio state is two optional primitive fields rather than one invariant-bearing value (AUD-007).
3. **Possible Data Clump/Speculative Generality:** `calculateHealthResult` combines two input modes with an optional date, while `HealthEvaluationContext` is unused (AUD-005).
4. **Possible Duplicated Code:** Primary Goal and NBA selection repeat deadline/ID ordering and both differ from the established ordinal Client comparator (AUD-004).

**Standards result:** Four heuristic findings; the worst is duplicated Goal validation because it creates two sources of truth for validity.

## Code review — Spec axis

1. **P1:** Public Goal output violates the no-BigInt contract (AUD-001).
2. **P1:** Readiness reports programming faults as dependency failures (AUD-002).
3. **P2:** Goal tie-breaking remains locale-dependent (AUD-004).
4. **P2:** Health calculation permits a missing evaluation date at compile time (AUD-005).

No scope creep requiring action was found.

**Code-review summary:** Standards: four heuristic findings, worst duplicated validity logic. Spec: four findings, worst public-output serialization and readiness fault classification.

## Positive implementation evidence

- Commit `f0de199` replaces floating Goals-score accumulation with BigInt rational arithmetic and adds exact half-up regressions for `9/1000` and `0.01/10^15`.
- `evaluateClient` now computes `GoalsComponentResult` once and passes it to Health, Primary Goal and NBA derivation.
- Date parsing rejects years outside `1000–9999` and invalid Gregorian dates.
- Component thresholds use exact integer comparisons before display formatting.
- Health preserves computable breakdown fields while returning `score`/`classification` as `null` for insufficient data.
- Database migrations enforce non-negative financial values, valid persisted Goal ranges, canonical family pairs, uniqueness, foreign keys and lookup indexes.
- The test database guard requires the expected protocol, loopback host, port, user and database name before connecting.
- Root workspaces use one lockfile, strict TypeScript options, explicit lint/typecheck/test/build scripts, and no `--if-present` bypass.

## Other evidence and documentation risks

- `git diff --check 2933d9e...HEAD` reports trailing whitespace and blank-line-at-EOF issues in task/audit documents and `money.ts`. These are formatting defects, not runtime failures.
- The renamed historical M1 audit still identifies itself as commit `a48b27b`, claims “PRODUCTION-READY FOUNDATION” and assigns percentage grades without a reproducible scoring method. It should remain clearly historical and must not be used as evidence that current `f0de199` passed this audit.
- That historical report maps authentication/body parsing to Milestone 2 and financial rules to Milestone 3, which conflicts with the current roadmap where financial rules are Milestone 2 and auth/Client APIs are Milestone 3.

## Recommended repair order and exit criteria

1. Fix AUD-001 and add JSON serialization tests.
2. Fix AUD-002 and add fault-classification tests.
3. Fix AUD-003–AUD-005 and their focused tests.
4. Consolidate Goal validation/invariants (AUD-006/AUD-007), repair README links, and update stale evidence.
5. Evaluate the Prisma dependency fix without bypassing the advisory, then rerun the dependency audit.
6. Rerun lint, typecheck, all unit tests, build, integration/schema tests against the isolated database, and live Caddy readiness transitions from a clean checkout.
7. Update ticket status and verification records with the new commit SHA and actual command output. Close M2-010 only after all high/medium findings pass.

The acceptance state after those steps should show no Critical/High open finding, no public BigInt value, correct `500` versus `503` behavior, ordinal Goal selection, truthful Summary wording, an enforced `asOfDate` contract, current dependency evidence, passing clean-checkout verification, and working documentation links.
