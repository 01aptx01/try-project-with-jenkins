# Meridian — Milestone 5 Current Audit

วันที่ตรวจ: 2026-09-09  
ผล: **IMPLEMENTATION PASS WITH DOCUMENTATION LIMITATIONS**

รายงานนี้เป็น audit รอบหลังแก้ไขและแทนผลการประเมินปัจจุบันของ M5 ตรวจ working tree ที่ยังไม่ commit บน HEAD `15e5b901392f1edb6ea1b05fc68eae19b129a5da` E2E provenance บันทึก source fingerprint `8079c21d937068d64e3e836e5c57996464757fda7db6f9921cfb047907461975` และ `dirty: true`; ดังนั้นผลยืนยัน source ปัจจุบัน ไม่ใช่ commit HEAD ล้วน ๆ

ใช้ `plan-audit` เทียบ M5-001 ถึง M5-014 และตรวจ TypeScript/Express/Next.js security practices ครอบคลุม financial rules, data model, ownership, auth/CSRF, session lifecycle, test isolation, runtime topology, dependency audit และเอกสารหลักฐาน

## Findings

### AUD-M5-010 — Medium: browser BFCache จริงยังพิสูจน์ไม่ได้ทุก environment

- **M5:** M5-010, M5-014
- **หลักฐาน:** [session-lifecycle.spec.ts](../../e2e/session-lifecycle.spec.ts:156) ตรวจ back navigation; [session-lifecycle.test.tsx](../../frontend/tests/session-lifecycle.test.tsx:309) ตรวจ deterministic `pagehide/pageshow.persisted` lifecycle
- **ผลกระทบ:** browser อาจเลือกไม่ใช้ BFCache จึงห้ามสรุปว่า E2E browser test พิสูจน์ BFCache restoration ได้ทุกครั้ง
- **สถานะ:** แก้ข้อความ test ให้ตรงจริงแล้ว; `SessionProvider` ซ่อน sensitive content ระหว่าง revalidation แต่ browser proof ยังเป็นข้อจำกัด
- **เกณฑ์ปิด:** เก็บ trace ที่ `pageshow.persisted === true` บน browser/environment ที่รองรับ หรือ mark `not-covered`

### AUD-M5-011 — Medium: usability/performance เป็น local baseline เท่านั้น

- **M5:** M5-012, M5-014
- **หลักฐาน:** [usability-performance.spec.ts](../../e2e/usability-performance.spec.ts:21) ใช้ viewport 640×480 เป็น reflow emulation; keyboard test เป็น focused primary sequence; [stack-launcher.ts](../../e2e/support/stack-launcher.ts:103) ใช้ compiled API แต่ local HTTP configuration
- **ผลกระทบ:** ไม่ใช่ browser zoom 200% จริง, full keyboard traversal ทุก flow, WCAG certification หรือ performance ของ production VM
- **สถานะ:** source เก็บ 30 samples หลัง warm-up 5 รอบและบันทึก SHA/fingerprint/build ID แล้ว
- **เกณฑ์ปิด:** ต้องทดสอบ browser zoom/assistive technology และ VM environment ที่ตกลง

ไม่มี Critical หรือ High finding ที่ยืนยันได้ใน audit รอบนี้

## Closure matrix — รายงานก่อนหน้า

| Finding | สถานะ | หลักฐานปัจจุบัน |
|---|---|---|
| AUD-M5-001 stale build/SHA | Closed | [stack-launcher.ts](../../e2e/support/stack-launcher.ts:84) build web ใหม่ทุก run, ตรวจ SHA/fingerprint ก่อนและหลัง build, เขียน provenance |
| AUD-M5-002 stale RM response claim | Closed as test-boundary correction | browser test เปลี่ยนเป็น ownership test; deterministic stale-request coverage อยู่ใน [session-lifecycle.test.tsx](../../frontend/tests/session-lifecycle.test.tsx:110) และ [client-profile.test.tsx](../../frontend/tests/client-profile.test.tsx:104) |
| AUD-M5-003 HIGH fixture becomes MEDIUM | Closed | [fixtures.ts](../../e2e/support/fixtures.ts:235) สร้าง valid Goal; [client-directory.spec.ts](../../e2e/client-directory.spec.ts:90) assert HIGH |
| AUD-M5-004 resource ownership | Closed | native Caddy/process cleanup และหยุด Postgres เฉพาะ exact container ID ที่ runner เริ่ม: [stack-launcher.ts](../../e2e/support/stack-launcher.ts:119) |
| AUD-M5-005 E2E excluded from gates | Closed | [package.json](../../package.json:11) เพิ่ม `lint:e2e`/`typecheck:e2e`; [e2e/tsconfig.json](../../e2e/tsconfig.json:1) |
| AUD-M5-006 BFCache claim | Partially closed | scope corrected; remaining limit AUD-M5-010 |
| AUD-M5-007 usability/mixed build | Partially closed | compiled API/provenance; remaining local-baseline limit AUD-M5-011 |
| AUD-M5-008 limiter/IP proof | Closed | exact 1–5/6th in [origin-and-limiter.test.ts](../../backend/tests/unit/middleware/origin-and-limiter.test.ts:107); proxy/spoofing in [caddy-flow.test.ts](../../backend/tests/integration/proxy/caddy-flow.test.ts:195) |
| AUD-M5-009 public upstream ports | Closed | API/Caddy/Next bind `127.0.0.1`; no listeners remained on 3100, 3101, 8180 after E2E teardown |

## Coverage assessment

| Area | Result | Evidence |
|---|---|---|
| Financial rules, NBA, priority sort | Pass | domain unit tests and source in `backend/src/domain/financial/` |
| Client/Family ownership | Pass | repository scopes `id + rmId`, Family controller filters cross-RM relatives, E2E 32/32 |
| Auth/session/CSRF | Pass | HS256 issuer/audience/TTL, HttpOnly cookie, exact Origin guard, limiter integration tests and E2E |
| E2E isolation | Pass | fail-closed DB identity guard, committed migrations, `meridian_e2e`; no development reset |
| Fresh artifacts and cleanup | Pass | fresh Next build, compiled API, provenance, loopback topology, owned resource cleanup |
| Quality gates | Pass | root lint/typecheck now include E2E and its config |
| DevSecOps production controls | Deferred M6 | Jenkins, Trivy, TLS, VM deployment and load/resource verification not audited as delivered functionality |

## Commands actually executed

| Command | Result |
|---|---|
| `npm run lint` | Pass; API, Web and E2E |
| `npm run typecheck` | Pass; API, Web and E2E |
| `npm run test:unit` | Backend 173 tests passed; frontend suite passed; lifecycle focused re-run 12/12 with no React act warnings |
| `npm run test:integration` | Pass; API, seed, proxy and isolated DB suites |
| `npm run build` | Pass; API compile and Next production build |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |
| `playwright test --list` | 32 tests in 9 files |
| `playwright test --reporter=list` | 32/32 passed; fresh build, migrations and E2E DB guard used |
| post-E2E port inspection | no listeners on 3100, 3101, 8180 |

## Notes

- E2E now uses the checksum-verified native Caddy bootstrap in [install-caddy.ps1](../../e2e/install-caddy.ps1:1). This lets Caddy, Next and API all bind loopback; it replaces the old E2E container proxy path only.
- `.tools/e2e-provenance.json`, artifacts and reports remain ignored. A release pipeline should archive them outside Git.
- [verification.md](../../tasks/milestone-5/verification.md) is a historical record with an earlier SHA. This report is the authoritative audit for the current uncommitted source until clean-checkout verification is repeated after commit.
- Data are synthetic. This audit did not deploy, enable TLS, scan images with Trivy, or perform VM load testing.
