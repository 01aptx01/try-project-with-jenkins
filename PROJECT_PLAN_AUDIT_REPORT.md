# Meridian Project Plan Audit Report — Revised Disposition
**Original audit input:** Autonomous Multi-Skill Audit Suite (`plan-auditor`, `implementation-plan-review`, `plan-audit`, `plan-security-audit`, `plan-perf-audit`, `plan-reviewer`)  
**Audit target:** Meridian Financial Relationship Management Platform (`meridian_project_context.md`, `docs/context/*`, `docs/adr/*`)  
**Revised:** 2026-09-08  
**Document status:** `SPECIFICATION_REVISED; IMPLEMENTATION_UNVERIFIED`

> The findings and scorecard below are preserved as historical audit input. They are not runtime test results, measured performance results, or evidence that an implementation exists. The authoritative disposition is [Revised Findings and Closure Criteria](#revised-findings-and-closure-criteria) at the end of this report.

## Baseline preserved before revision

| Item | Value |
|---|---|
| Git status | `M README.md`; untracked `CONTEXT.md`, `PROJECT_PLAN_AUDIT_REPORT.md`, `docs/`, `meridian_project_context.md` |
| Source document | `meridian_project_context.md` |
| SHA-256 | `DC7A60806533AD843BDB4B5167D986B1037635E64743ED8AC1B9C8ABD970F504` |
| Source line count | 1,815 reported by PowerShell `Measure-Object -Line` |

---

## Historical Audit Input — Scores are not measured results

The following narrative and scores describe the incoming review. They are retained for traceability only; no scoring method, workload measurement, or application execution evidence is stored in the repository.

### Historical scorecard — not used for release or readiness decisions

| Dimension | Score (1-10) | Rating | Key Highlights & Vulnerabilities |
|---|:---:|:---:|---|
| **Structure & Domain Precision** | **9.5/10** | Excellent | Deterministic rules (BR-01–09), explicit math formulas, clean architecture. |
| **Completeness of Requirements** | **9.0/10** | High | Traceability from FR-01–25 to US-01–16 and CI/CD stages is intact. |
| **Data Flow & Lifecycle Coverage** | **8.0/10** | Good | In-memory priority calculation vs SQL pagination creates a compute gap. |
| **Security & Access Controls** | **7.5/10** | Moderate | Strict RM IDOR scoping; but `/var/run/docker.sock` privilege & rate limiting need hardening. |
| **Performance & Resource Scalability** | **6.5/10** | Caution | 1 VM hosting Jenkins (JVM) + Docker daemon + Postgres + Node + Next.js + Caddy risks OOM. |
| **Task Granularity & Readiness** | **6.0/10** | Needs Work | 7 roadmap milestones are too coarse (>10h each); lacks 30m–2.5h atomic work breakdown. |
| **Overall Development Readiness** | **7.7/10** | **Ready with Revisions** | Fix P0/P1 items before executing Milestone 1. |

---

## Historical audit details

### 1.1 End-to-End Data Flow Coverage Table

| Flow | Trigger / Input | Core Processing | External Dependency | State / Storage | Interface / Consumer | Output / Side Effect | Failure Path | Verification | Gaps / Findings |
|---|---|---|---|---|---|---|---|---|---|
| **F1: RM Auth** | `POST /api/auth/login` (email, password) | bcrypt verify, sign JWT (1h exp) | None | In-memory session / Stateless | Browser via Caddy | `Set-Cookie` (HttpOnly, SameSite=Lax) | 401 Invalid Credential | Supertest test suite | **Gap [P2]:** No rate limiter / brute-force lockout on login endpoint. |
| **F2: Morning Action Plan** | `GET /api/dashboard/morning-action-plan` | Compute Health + NBA for all owned clients; sort `HIGH→MED→LOW→code` | None | PostgreSQL (`clients`, `financial_profiles`, `goals`) | Next.js Dashboard | Sorted JSON array of Client cards | 401 Unauthenticated | Vitest component + API test | **Gap [P1]:** N+1 query if relations are loaded iteratively rather than eager Prisma `include`. |
| **F3: Client List & Filter** | `GET /api/clients?priority=HIGH&page=1` | Dynamic priority filtering & pagination | None | PostgreSQL | Next.js Client List UI | Paginated Client array `{items, page, pageSize, total}` | 400 Invalid Enum, 401 Unauth | API test for query params | **Gap [P0]:** Priority is not stored in DB. SQL `OFFSET/LIMIT` cannot filter by Priority without computing for all owned clients in Node.js first. |
| **F4: Client Deep Dive** | `GET /api/clients/:id` & `/health` & `/recommendations` & `/summary` | RM Ownership verification; compute derived indicators | None | PostgreSQL | Next.js Profile Page | Full Client Profile + Metrics | 404 (if not owned or missing) | Supertest ownership checks | **Gap [P2]:** Multiple roundtrips (5 separate HTTP GETs for 1 profile view). |
| **F5: Family Network** | `GET /api/clients/:id/family` | RM-filtered graph traversal | None | PostgreSQL (`family_relationships`) | React Flow Graph | `{nodes, edges}` JSON | 404 Client not found | API cross-RM visibility test | **Gap [P1]:** Schema has directed edges `(client_id, related_client_id)`. Bidirectional querying requires `OR` clause. |
| **F6: CI/CD Pipeline** | Git push to `main` | Webhook → Jenkins pipeline (7 stages) | Docker Hub (Trivy DB) | Docker Daemon on VM | GitHub Webhook / Jenkins Dashboard | Deployed containers + `/health` 200 | Trivy CVE / Test failure → Deploy skipped | Automated pipeline fixtures | **Gap [P0]:** Hard failure on `--ignore-unfixed=false` if base image has unpatchable CVE. |

### 1.2 Core Object Lifecycle & Invariants

* **`User` (RM):** Created via seed; immutable in MVP; no registration endpoint.
* **`Client`:** Bound to `rm_id`; foreign keys enforce relation integrity, while ownership middleware enforces access control.
* **`FinancialProfile`:** 1:1 relation with Client; required for complete health scoring.
* **`Goal`:** 1:N relation; must enforce `target_date > start_date`.
* **`Recommendation` / NBA:** Ephemeral (computed on the fly); non-persisted in MVP.

---

## Section 2: Implementation Plan Review (Sherpy Standards)

### 2.1 Critical Issues (CRIT) & High-Priority Warnings (WARN)

#### [CRIT-001] In-Memory Priority Filtering vs Database Pagination Mismatch
* **Location:** `docs/context/04-business-rules.md:58-61` and `05-architecture-and-data.md:52`
* **Problem:** The API specification mandates `GET /api/clients?priority=HIGH&page=1&pageSize=20`. However, `Priority` is not stored in the `clients` table; it is derived dynamically from `financial_profiles` and `goals` via pure function BR-06. If the database executes `SELECT ... LIMIT 20 OFFSET 0`, it cannot filter or sort by priority at the SQL level.
* **Remediation:** For the prototype (30 seed clients), explicitly document that the backend controller fetches all clients owned by the RM with their profiles/goals, calculates the derived Priority and Health status in memory, applies the filter, sorts, and slices the page in Node.js before returning.

#### [CRIT-002] Division-by-Zero in Goal Progress on Exact Start Date
* **Location:** `docs/context/04-business-rules.md:23`
* **Problem:** Formula: `expected_amount = target_amount * elapsed_days / total_days`. Then `goal progress = current_amount / expected_amount`.
  * The document specifies: *"วันก่อน start_date ให้ expected amount เป็น 0 และ progress เป็น 1"*.
  * But on the exact `start_date` (`elapsed_days == 0`), `expected_amount` becomes `0`.
  * In JavaScript: `current_amount / 0 === Infinity`, and `Math.min(1, Infinity) === 1`. But if `current_amount == 0`, `0 / 0 === NaN`, which will propagate `NaN` into the Health Score total!
* **Remediation:** Update rule: *"เมื่อ `elapsed_days <= 0` หรือ `expected_amount <= 0` ให้กำหนด `progress = 1.0` ทันที"* เพื่อป้องกัน `NaN` / `Infinity`.

#### [WARN-001] Trivy Vulnerability Gate Blocking on Unfixable Upstream CVEs
* **Location:** `docs/context/06-devsecops.md:42`
* **Problem:** Rule BR-10 states: *"ห้ามใช้ `--ignore-unfixed` ใน MVP"*. If an official base image (like `node:20-alpine` or `ubuntu:22.04`) has an open CVE rated `HIGH` with no fix released upstream, the Jenkins pipeline will be permanently blocked from deploying.
* **Remediation:** Add a documented `.trivyignore` exception file or allow `--ignore-unfixed` exclusively for OS packages while enforcing strict zero-tolerance for application dependencies (`package-lock.json`).

#### [WARN-002] Roadmap Milestone Over-Sizing (Violating 30m–2.5h Atomic Chunking)
* **Location:** `docs/context/08-delivery-roadmap.md:29-38`
* **Problem:** The 7 roadmap milestones are macroscopic (e.g., *"1. Foundation: monorepo, TypeScript, Docker Compose, PostgreSQL/Prisma, .env.example, Caddy and authentication"* represents ~15-20 hours of work across 15+ files). AI agents and pair-programmers will encounter context drift.
* **Remediation:** Decompose each roadmap phase into 3–5 sub-tasks of 30m–2.5h with targeted files and verifiable test commands (see Section 6).

---

## Section 3: Plan-Security-Audit (Kenji / OWASP Framework)

> **Preservation Contract Acknowledgment:**  
> This security assessment adheres strictly to non-destructive analysis and planning guidelines. No secrets are echoed; vulnerabilities are mapped directly to design specifications.

### 3.1 OWASP Top 10 (2021) Mapping

| OWASP Category | Design Assessment & Finding | Risk Level | Remediation Plan |
|---|---|:---:|---|
| **A01: Broken Access Control (BOLA/IDOR)** | **Strongly Mitigated:** ADR 0001 enforces RM Scoping. Middleware checks `rm_id` and returns `404 Not Found` (to avoid enumeration). Family graph strips cross-RM nodes. | **LOW** | Ensure unit tests verify that RM B accessing Client A's ID receives a strict 404. |
| **A02: Cryptographic Failures** | **Acceptable:** bcrypt password hashing with salt; JWT in HttpOnly cookie. No refresh token rotation (acceptable for prototype). | **LOW** | Ensure `JWT_SECRET` has minimum 256-bit entropy in `.env.example` validation. |
| **A03: Injection** | **Mitigated:** Prisma ORM parameterizes queries. Zod enforces schema validation on all inputs. | **LOW** | Enforce Zod `.strict()` to reject unexpected payload properties. |
| **A04: Insecure Design** | **Mitigated:** Same-origin Caddy reverse proxy + `Origin` header check on POST requests. | **LOW** | Maintain CSRF posture via `SameSite=Lax`. |
| **A05: Security Misconfiguration** | **CRITICAL RISK:** Jenkins container mounts `/var/run/docker.sock`. Any compromise of Jenkins (or build script) grants root access to host VM Docker daemon. | **HIGH** | ADR 0002 documents this trade-off. Add host file permission hardening (`chmod 660 /var/run/docker.sock`) and dedicated non-root user. |
| **A06: Vulnerable Components** | **Mitigated:** Trivy scanning for `HIGH,CRITICAL` container vulnerabilities in pipeline. | **LOW** | Lock base images to digest or exact minor versions (`node:20.18-alpine`). |
| **A07: Identification & Auth Failures** | **DEFICIENT:** No rate limiting or account lockout on `POST /api/auth/login`. Susceptible to brute-force credential stuffing. | **MEDIUM** | Add `express-rate-limit` middleware (max 5 requests/minute per IP on `/api/auth/login`). |
| **A08: Software & Data Integrity** | **Acceptable:** NPM lockfiles (`package-lock.json`) committed. | **LOW** | Run `npm ci` rather than `npm install` in Jenkinsfile. |
| **A09: Security Logging & Monitoring** | **DEFICIENT:** No audit log for RM data access or export. | **LOW** | Add structured access logging for Client profile access. |
| **A10: Server-Side Request Forgery (SSRF)** | **Mitigated:** No user-controlled outbound HTTP requests exist in the application. | **NONE** | N/A |

### 3.2 Phased Security Hardening Plan
1. **Phase 1 (Pre-MVP Launch):** Add `express-rate-limit` to Auth routes; enforce `npm ci` in Jenkinsfile; restrict Docker socket permissions.
2. **Phase 2 (Post-MVP / Future Work):** Implement JWT refresh token rotation, Redis-backed blacklist for immediate revocation, and Vault/KMS secrets integration.

---

## Section 4: Plan-Perf-Audit (Kenji Performance Framework)

> **Preservation Contract Acknowledgment:**  
> Plan-only performance analysis. All recommendations target verified architecture bottlenecks and baseline resource allocations.

### 4.1 System Topology & Resource Contention on Single VM

The target environment is a single Ubuntu VM running:
* **Jenkins Controller:** Java JVM (~1.2 GB – 1.8 GB RAM footprint)
* **Docker Daemon + Buildkit:** Active compilation & container layers (spikes of 1.5 GB RAM during `npm run build` of Next.js)
* **Trivy Scanner:** Vulnerability database download & memory-mapped inspection (~400 MB – 800 MB RAM)
* **PostgreSQL 16:** DB buffer pool (~256 MB – 512 MB RAM)
* **Next.js Web Frontend:** Node SSR server (~150 MB – 250 MB RAM)
* **Express.js API Backend:** Node process (~100 MB – 180 MB RAM)
* **Caddy Server:** Go reverse proxy (~50 MB RAM)

> [!CAUTION]
> **Total Peak Memory Demand:** **4.0 GB – 5.5 GB RAM**.  
> If deployed on a standard 2 GB or 4 GB VM without adequate swap, the **Linux OOM (Out-of-Memory) Killer** will terminate either PostgreSQL, Jenkins, or the Node build process during pipeline execution!

**Performance Guardrail:**
* Require host VM with minimum **4 vCPU / 8 GB RAM**, OR configure a **4 GB Linux swapfile** (`fallocate -l 4G /swapfile`).
* Apply Docker container memory limits in `docker-compose.yml` (`mem_limit: 512m` for Postgres, `mem_limit: 512m` for API/Web).

### 4.2 Database & API Bottlenecks
* **Family Graph Traversal (N+1 Query Risk):** When fetching family nodes, executing recursive single queries will degrade performance.
  * *Fix:* Single parameterized SQL query with `OR` or recursive CTE:
    ```sql
    SELECT * FROM family_relationships 
    WHERE (client_id = :id OR related_client_id = :id)
    ```
* **React Flow Bundle Size:** React Flow is ~180 KB minified.
  * *Fix:* Use Next.js dynamic import with SSR disabled:
    ```typescript
    const FamilyGraph = dynamic(() => import('@/components/FamilyGraph'), { ssr: false });
    ```

---

## Section 5: Plan-Audit (Vmark Work-Item & Logic Verification)

### 5.1 Business Rule Boundary Checklist

- [x] **BR-01–03 Health Classifications:** Explicit boundaries at 59.99 / 60.00 / 79.99 / 80.00 verified.
- [x] **BR-04 Liquidity Table:** Thresholds (≥6: 25, ≥3: 18, ≥1: 8, <1: 0) verified.
- [x] **BR-04 Debt Table:** Ratios (≤20%: 25, ≤40%: 18, ≤60%: 8, >60%: 0) verified.
- [x] **BR-04 Savings Table:** Rates (≥20%: 20, ≥10%: 14, >0: 7, ≤0: 0) verified.
- [x] **BR-04 Investment Table:** Ratios (≥20%: 15, ≥10%: 10, >0: 5, ≤0: 0) verified.
- [x] **BR-04 Goal Expected Amount:** Division-by-zero check needed when `elapsed_days == 0` *(See CRIT-002)*.
- [x] **BR-05 Insufficient Data:** Nullification of total score and classification with structured `missingFields` array verified.
- [x] **BR-06 NBA Precedence Ladder:** Precedence rule order (1. Insufficient → 2. Liquidity <3 → 3. Debt >60% → 4. Late Goal ≤365d → 5. Health <60 → 6. Routine) is deterministic and conflict-free.

---

## Section 6: Recommended Atomic Execution Breakdown

To prevent architectural drift during development, Roadmap Steps 1–7 are decomposed into bite-sized atomic tasks (30m–2.5h each):

### Milestone 1: Foundation & Scaffold (Est. 5.5 hours)
* **Task 1.1 (Scaffolding):** Monorepo structure, root `package.json`, TypeScript configs, ESLint rules, and `.env.example`. (1.5h)
* **Task 1.2 (Prisma & DB):** `schema.prisma` with `User`, `Client`, `FinancialProfile`, `Goal`, `FamilyRelationship`, Docker Compose for local PostgreSQL. (1.5h)
* **Task 1.3 (Auth & JWT Middleware):** Express app, Zod login validator, bcrypt password comparison, JWT cookie signing & verification middleware. (1.5h)
* **Task 1.4 (Reverse Proxy & Health):** Caddyfile local configuration, `/health` endpoint returning commit SHA. (1.0h)

### Milestone 2: Seed & Client Core (Est. 5.0 hours)
* **Task 2.1 (Deterministic Seed Engine):** `prisma/seed.ts` creating 2 RMs, 30 Clients with all 6 NBA scenarios, reproducible dates/amounts. (2.0h)
* **Task 2.2 (RM Scoping & Client API):** `GET /api/clients` with RM ownership filtering, partial search, pagination, and Supertest suite. (1.5h)
* **Task 2.3 (Client List Frontend):** Next.js Client table with search input, Priority/Health filters, empty state, and pagination controls. (1.5h)

### Milestone 3: Pure Financial Domain Services (Est. 4.5 hours)
* **Task 3.1 (Health Score Service & Unit Tests):** Pure functions for Liquidity, Debt, Savings, Investment, Goals, Insufficient data, with 100% boundary test coverage in Vitest. (2.0h)
* **Task 3.2 (Priority & NBA Ladder Service):** Strict precedence evaluator returning single action, priority, and formatted reason. (1.5h)
* **Task 3.3 (Summary Generator):** Deterministic string template builder utilizing Health, Goal, and NBA reason. (1.0h)

### Milestone 4: Decision Views & Family Graph (Est. 5.0 hours)
* **Task 4.1 (Dashboard & Morning Action Plan):** `GET /api/dashboard/morning-action-plan` endpoint and responsive UI cards. (1.5h)
* **Task 4.2 (Client Profile View):** Next.js layout displaying Health Breakdown, Goals table, Summary card, and NBA banner. (1.5h)
* **Task 4.3 (Family Graph API & React Flow):** Graph traversal query with strict RM boundary filtering, React Flow interactive canvas. (2.0h)

### Milestone 5: CI/CD Pipeline & DevSecOps (Est. 6.0 hours)
* **Task 5.1 (Dockerfiles):** Multi-stage production Dockerfiles for Next.js and Express API using non-root users. (1.5h)
* **Task 5.2 (Jenkinsfile):** Declarative pipeline with Checkout, Install, Lint, Test, Build, Trivy Scan, Deploy, and Verify stages. (2.5h)
* **Task 5.3 (Verification & Failure Scenarios):** Test failure fixture, Trivy vulnerability fixture, and `/health` polling script. (2.0h)

---

## Plan Reviewer Final Verdict

```json
{
  "project": "Meridian",
  "verdict": "NEEDS_REVISION",
  "auditSummary": "The architectural foundation and business rules are extraordinarily rigorous and deterministic. Implementation can proceed immediately once the 2 critical edge cases (SQL pagination vs in-memory priority, and Goal progress division-by-zero) and the VM memory buffer policy are formally incorporated into the plan.",
  "requiredRevisions": [
    "[P0] Fix Goal progress formula in BR-04 for elapsed_days <= 0 to prevent NaN/Infinity.",
    "[P0] Clarify Client List API implementation: in-memory calculation & slicing for 30 seed records vs database view.",
    "[P1] Add Linux swap (4GB) or VM sizing guidance (8GB RAM) to docs/context/06-devsecops.md to prevent OOM kills during Jenkins Docker build.",
    "[P1] Add express-rate-limit to Auth login endpoint in docs/context/05-architecture-and-data.md.",
    "[P2] Define family_relationships query as bidirectional (client_id = :id OR related_client_id = :id)."
  ]
}
```

---

## Revised Findings and Closure Criteria

This section supersedes the recommendations and final verdict above. `Specification revised` means the document contract now states the intended behavior; it does not mean code, CI, host configuration, or production controls have been implemented or tested.

| Finding | Disposition | Authoritative location | Closure criterion |
|---|---|---|---|
| CRIT-001 — derived Priority vs pagination | **Specification revised** | `docs/context/04-business-rules.md`, BR-09 | API test places a HIGH Client outside a first database-sized result set and proves it appears before MEDIUM/LOW; `total` is measured after filters, then page is sliced |
| CRIT-002 — Goal division at start date | **Specification revised** | `docs/context/04-business-rules.md`, BR-01 | Unit tests for date before/start/after target with zero current amount prove finite score/progress and correct `isBehind` |
| WARN-001 — unfixable Trivy CVE | **Not adopted by agreement** | `docs/context/06-devsecops.md`, Trivy policy | HIGH/CRITICAL and scanner failure continue to block; evidence shows dependency/base-image update and rescan rather than an ignore rule |
| WARN-002 — atomic work items | **Adjusted to project preference** | `docs/context/08-delivery-roadmap.md` | Seven milestones have prerequisites, deliverables, requirement coverage and exit criteria; no hourly task framework is required |
| P1 — VM memory contention | **Specification revised; needs measurement** | `docs/context/06-devsecops.md`, Host baseline | Record peak RAM, OOM events, disk use and latency on the 4 vCPU/8 GiB proposed baseline during a real pipeline run |
| P1 — login brute-force protection | **Specification revised** | `docs/context/05-architecture-and-data.md`, Authentication and session | API test confirms five requests per verified IP per minute, then 429/Retry-After; proxy test rejects spoofed forwarded IP |
| P2 — Family directed edge ambiguity | **Specification revised** | `docs/context/04-business-rules.md`, BR-10 | API tests cover both edge directions, one-hop limit, duplicate suppression and cross-RM filtering |
| P2 — Profile HTTP round trips | **Specification revised** | `docs/context/05-architecture-and-data.md`, Profile snapshot | `GET /api/clients/:id` returns one consistent evaluation; Family Graph remains an explicit separate request |
| NEW-001 — public endpoint inconsistency | **Specification revised** | `docs/context/05-architecture-and-data.md`, API contract | Tests distinguish public login/logout/health from session-protected `/auth/me` and Client endpoints |
| NEW-002 — seed-data contradiction | **Specification revised** | `docs/context/08-delivery-roadmap.md`, Reproducible seed-data specification | Normal seed has two RM/30 complete Clients; exceptional data belongs only to separate fixtures |
| NEW-003 — foreign key/access-control confusion | **Specification revised** | `docs/context/05-architecture-and-data.md`, Data model | Code review and API tests demonstrate ownership middleware, not database foreign keys, controls Client visibility |
| NEW-004 — socket privilege claim | **Adjusted to evidence** | `docs/context/06-devsecops.md`, Runtime topology | Deployment review records agent trust boundary; no claim that socket mode/non-root container contains a socket-capable build |

## Security and operations posture

The project uses a single VM by scope. Jenkins controller must not run builds; one local agent runs them sequentially. A Docker-socket-capable agent is trusted infrastructure and must not run untrusted fork PRs. This remains a documented prototype trade-off rather than a mitigated host privilege boundary.

JWT sessions are stateless until expiry. Login rate limiting is separate state in the API memory store and resets on restart. Caddy is the only public route to the API, which gives the limiter one trusted proxy topology and keeps API ports private. Request logs contain request ID, route and status only.

## Verification status

| Area | Current state | Evidence still required in implementation |
|---|---|---|
| Documentation links, contracts and rule boundaries | Revised in this document set | Markdown validation and peer review |
| Health/Priority/NBA logic | Specified only | Unit tests and finite-value assertions |
| RM ownership/session/limiter | Specified only | Supertest suite including IDOR, Origin and 429 cases |
| Pipeline/Trivy/deployment | Specified only | Jenkins build links, SHA-tagged images and failure-scenario logs |
| Capacity and latency | Not measured | Host metrics during pipeline and demo workload |

## Evidence required for final acceptance

1. A Goal before start, at start with zero amount, at target and past target never produces `NaN`/`Infinity`.
2. Derived Priority filtering/sorting occurs before pagination and does not expose Client counts or graph edges across RM boundaries.
3. Profile snapshot uses one evaluation for Health, NBA and Summary; Family is a separately authorized request.
4. Login limiter uses the verified client IP, rejects invalid Origin, returns 429 at the documented limit and does not log credentials/session/financial data.
5. PR validation never deploys; only validated `main` deploys. Trivy HIGH/CRITICAL, scan error, migration failure, wrong SHA and unavailable database prevent a successful verification result.
6. Normal seed is idempotent with 2 RM and 30 complete Clients; incomplete/cross-RM cases are separate fixtures.
7. Performance claims cite measurements with commit SHA, host configuration and date; the proposed VM size and container limits are not presented as measured results before then.
