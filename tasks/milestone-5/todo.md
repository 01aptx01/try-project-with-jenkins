# Meridian — Milestone 5 Tickets

สถานะเริ่มต้นทั้งหมดเป็น `TODO`; การเปลี่ยนสถานะต้องใช้ `TODO → IN_PROGRESS → DONE` หรือ `BLOCKED` โดยจะปิดเป็น DONE ได้ต่อเมื่อมีหลักฐานการทดสอบจริง (Verification Evidence) เท่านั้น ข้อตกลงร่วมและคำสั่งอยู่ใน [plan.md](plan.md)

---

## Checkpoint A: Baseline, Matrix และ Data Isolation
- [x] Checkpoint A Complete (M5-001 ถึง M5-003 ผ่านพร้อมหลักฐานจริง)

<a id="m5-001"></a>
### M5-001 — ตรวจ baseline หลังแก้ M4
**Status:** DONE  
**Scope:** S  
**Dependencies:** ไม่มี  
**Requirements:** NFR-04, Prerequisite ของ M5

**งาน:**
ตรวจรับและบันทึกสถานะ baseline ปัจจุบันของ repository บน commit `c4528cf` ตรวจสอบความถูกต้องของการแก้ audit findings AUD-M4-001 ถึง AUD-M4-010 เทียบกับโค้ดจริงและชุด regression tests โดยไม่ใช้ข้อความแทนหลักฐาน

**Acceptance criteria:**
- [x] บันทึก full SHA (`c4528cffafaa08a48504024d1c31a0b37bd39bc2`), Git status, environment (Node.js, npm, OS)
- [x] รันคำสั่ง root: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run build` และบันทึกผลจริง
- [x] ตรวจสอบโค้ดและชุด regression tests ของ AUD-M4-001–010 ในไฟล์ต้นฉบับ ยืนยันว่าไม่มีการถดถอย
- [x] สรุปรายการ unresolved issues และ tickets ที่ถูกบล็อก (หากมี)

**Verification:**
- [x] Root commands ผ่าน 100% (lint 0, typecheck 0, unit 300 passed, integration 78 passed, build passed, audit 0)
- [x] บันทึกผลใน `tasks/milestone-5/verification.md`

**Files likely touched:**
- `tasks/milestone-5/verification.md`

---

<a id="m5-002"></a>
### M5-002 — สร้าง requirement acceptance matrix
**Status:** DONE  
**Scope:** M  
**Dependencies:** M5-001  
**Requirements:** Traceability ของ FR-01–25, NFR-01–10, US-01–16

**งาน:**
จัดทำเอกสาร Requirement Traceability & Acceptance Matrix สำหรับ Milestone 5 เพื่อเชื่อมโยง requirements, user stories, audit findings เข้ากับ test layers, test scenarios และหลักฐานตรวจรับ

**Acceptance criteria:**
- [x] มีรายการราย ID ครบถ้วนสำหรับ FR-01–12, NFR-01–10 และ US-01–16 พร้อมระบุ test layer, scenario และ evidence target
- [x] ระบุ requirements และ stories ด้าน CI/CD pipeline, Trivy container security scans และ production deployment (FR-13–25, NFR-03, NFR-08, US-10–14) ว่า `DEFERRED_M6` พร้อมเหตุผลเชิงสถาปัตยกรรม ไม่ประกาศว่าผ่านใน M5
- [x] เชื่อมโยง audit findings เดิม (AUD-M4-001–010) เข้ากับ regression scenarios
- [x] แยกประเภทหลักฐานชัดเจน: API assertions, component tests, browser E2E, และ manual/benchmark evidence

**Verification:**
- [x] ทุก requirement มีผู้รับผิดชอบ เกณฑ์ปิด และวิธีการพิสูจน์ ไม่มีการใช้ test count แทนความครอบคลุมจริง
- [x] บันทึกใน `tasks/milestone-5/acceptance-matrix.md`

**Files likely touched:**
- `tasks/milestone-5/acceptance-matrix.md`

---

<a id="m5-003"></a>
### M5-003 — สร้าง isolated E2E database และ fixtures
**Status:** DONE  
**Scope:** M  
**Dependencies:** M5-001  
**Requirements:** NFR-01, NFR-09, NFR-10

**งาน:**
สร้างระบบฐานข้อมูลเฉพาะสำหรับ E2E บน Docker Compose (port 5544, database `meridian_e2e`) พร้อมตัวตรวจจับ Guard ที่ปฏิเสธการ fallback ไปยังฐานข้อมูลอื่น และชุด fixtures ที่ทำซ้ำได้

**Acceptance criteria:**
- [x] เพิ่ม service `postgres-e2e` ใน `docker-compose.yml` ภายใต้ profile `e2e` กำหนดพอร์ต `127.0.0.1:5544:5432`, user `meridian_e2e`, db `meridian_e2e`, volume `meridian-postgres-e2e-data`
- [x] สร้าง Guard ใน `e2e/support/db-guard.ts` ตรวจ explicit E2E URL, user, host, port (5544) และ query `SELECT current_database()` ปฏิเสธ fallback ไป `DATABASE_URL` หรือ `TEST_DATABASE_URL`
- [x] สร้าง Normal seed (2 RM, 30 Clients) และ scenario fixtures สำหรับ pagination (>20 clients ของ RM 1), anomaly (incomplete profile, zero expenses), และ cross-RM relationship fixtures
- [x] การ setup และ cleanup ล้างเฉพาะ E2E database ไม่กระทบ development หรือ test database

**Verification:**
- [x] ทดสอบรัน setup และ cleanup 2 รอบได้ผลลัพธ์เหมือนกัน (counts: 2 RMs, 30 clients, 30 profiles, 30 goals, 8 relationships)
- [x] ทดสอบส่ง configuration ไปยังพอร์ตหรือชื่อฐานข้อมูลผิด ถูก guard ปฏิเสธทันที
- [x] ตรวจสอบว่า development database sentinel ไม่ถูกแตะต้อง (RM count = 2)
- [x] Automated test `backend/tests/integration/e2e-isolation.test.ts` ผ่าน 5/5 tests

**Files likely touched:**
- `docker-compose.yml`
- `e2e/support/db-guard.ts`
- `e2e/support/seed-e2e.ts`
- `e2e/support/fixtures.ts`
- `backend/tests/integration/e2e-isolation.test.ts`

---

## Checkpoint B: Isolated Stack และ Authentication
- [x] Checkpoint B Complete (M5-004 ถึง M5-006 ผ่านพร้อมหลักฐานจริง)

<a id="m5-004"></a>
### M5-004 — เตรียม application stack สำหรับ E2E
**Status:** DONE  
**Scope:** M  
**Dependencies:** M5-003  
**Requirements:** NFR-01, NFR-04, NFR-09

**งาน:**
จัดเตรียมตัวจัดการและรัน Application Stack สำหรับ E2E (Next.js 3100, Express 3101, Caddy 8180) พร้อม dependency injection ตรึงวันประเมินทางการเงิน `2026-09-08` โดยไม่มี test endpoints สาธารณะในแอป

**Acceptance criteria:**
- [x] รัน Next.js production build (`next build` + `next start`) บน `127.0.0.1:3100`
- [x] รัน Express API บน `127.0.0.1:3101` ผ่าน application wiring จริง โดย inject clock ประเมินทางการเงินเป็น `2026-09-08` ในขณะที่ JWT token ใช้เวลาจริง (`Date.now()`)
- [x] รัน Caddy บน `127.0.0.1:8180` (profile `e2e` / `caddy-e2e`) ชี้ API/health ไปยัง 3101 และ Next.js ไปยัง 3100
- [x] `APP_VERSION` ถูกส่งเป็น commit SHA ของ checkout ปัจจุบัน (dynamic git rev-parse HEAD)
- [x] Runner ตรวจ readiness/version และมีระบบ cleanup จัดการปิด processes/services ของตนเองเมื่อเสร็จสิ้นหรือเมื่อถูก abort

**Verification:**
- [x] เรียกผ่าน origin เดียว `http://127.0.0.1:8180` เข้าถึงหน้าเว็บ (`/login` 200), `/health` (version ตรงกับ git SHA) และ API error envelope (`/api/clients` 401) ได้
- [x] Automated test `backend/tests/integration/e2e-stack.test.ts` ผ่านเรียบร้อย

**Files likely touched:**
- `backend/src/server.ts`
- `backend/src/e2e-server.ts`
- `Caddyfile.e2e`
- `docker-compose.yml`
- `e2e/support/stack-launcher.ts`
- `backend/tests/integration/e2e-stack.test.ts`

---

<a id="m5-005"></a>
### M5-005 — ติดตั้ง Playwright และคำสั่ง acceptance
**Status:** DONE  
**Scope:** S  
**Dependencies:** M5-004  
**Requirements:** Testing Architecture ของ M5

**งาน:**
ติดตั้ง `@playwright/test` ใน workspace root, กำหนดค่า `playwright.config.ts` และเพิ่ม root acceptance commands

**Acceptance criteria:**
- [x] ติดตั้ง `@playwright/test` ที่ root และรักษา lockfile เดียว (`package-lock.json`)
- [x] เพิ่มคำสั่ง root `test:e2e` และ `test:e2e:headed`
- [x] ตั้งค่า Playwright: Chromium browser, `workers: 1`, `retries: 0`, baseURL `http://127.0.0.1:8180`
- [x] บันทึก failure screenshots และ traces เฉพาะกรณี test fail และ ignore ใน `.gitignore` ไม่ commit credentials/traces ลง Git
- [x] Browser/server startup failure ต้องทำให้คำสั่ง exit non-zero ไม่ skip เป็น PASS

**Verification:**
- [x] Smoke test ผ่านทั้ง headless (`npm run test:e2e`) และ headed (`npm run test:e2e:headed`) modes (2/2 tests passed)
- [x] จงใจปิด service prerequisite / ป้อน configuration ผิด แล้วคำสั่งล้มเหลวด้วย exit code 1

**Files likely touched:**
- `package.json`
- `package-lock.json`
- `playwright.config.ts`
- `.gitignore`
- `e2e/smoke.spec.ts`
- `e2e/global-setup.ts`
- `e2e/global-teardown.ts`

---

<a id="m5-006"></a>
### M5-006 — ตรวจ Login, logout และ session contracts
**Status:** DONE  
**Scope:** M  
**Dependencies:** M5-002, M5-005  
**Requirements:** FR-01, NFR-01, US-01

**งาน:**
ทดสอบ flow การยืนยันตัวตน, จัดการ session, การออกจากระบบ และ security headers ผ่าน browser จริงร่วมกับ negative API test cases

**Acceptance criteria:**
- [x] Browser login จริงด้วย credentials ที่ถูกต้อง สร้าง HttpOnly cookie โดยใน response body ไม่มี JWT
- [x] ป้อน invalid credentials แสดง error banner และ direct navigation ไปยัง protected route ถูก redirect ไปหน้า `/login`
- [x] Logout สำเร็จหลังได้รับ HTTP 204 และ session cookie ถูกล้าง; จำลอง logout failure ให้แสดงปุ่ม retry และไม่แจ้งว่าล้าง session แล้ว
- [x] API integration tests ครอบคลุม: expired JWT, invalid JWT signature, missing/mismatched Origin header, และ rate limiter 429 พร้อม header `Retry-After` โดยไม่ลด limiter หรือเปลี่ยน TTL ของแอป

**Verification:**
- [x] Playwright E2E suite `e2e/auth.spec.ts` บน browser จริงผ่าน 5/5 tests
- [x] Negative API contract tests `backend/tests/integration/api/auth-contracts.test.ts` ผ่าน 6/6 tests

**Files likely touched:**
- `e2e/auth.spec.ts`
- `backend/tests/integration/api/auth-contracts.test.ts`

---

## Checkpoint C: Product Flows และ Ownership
- [x] Checkpoint C Complete (M5-007 ถึง M5-009 ผ่านพร้อมหลักฐานจริง)

<a id="m5-007"></a>
### M5-007 — ตรวจ Client List และ Morning Action Plan
**Status:** DONE  
**Scope:** M  
**Dependencies:** M5-006  
**Requirements:** FR-02, FR-03, FR-04, FR-05, US-02, US-03, US-04

**งาน:**
ทดสอบ Client Directory (ค้นหา, กรอง, จัดหน้า, URL sync) และ Morning Action Plan พร้อมพิสูจน์การแยกข้อมูลระหว่าง Relationship Managers

**Acceptance criteria:**
- [x] ค้นหาชื่อ/customer code, กรอง Priority (HIGH/MEDIUM/LOW) และ Health (GOOD/MODERATE/AT_RISK/INSUFFICIENT_DATA), reset filters, pagination และ browser history ใช้งานร่วมกันได้
- [x] ทดสอบ pagination fixture (>20 clients): ลูกค้าระดับ HIGH ที่อยู่ท้ายข้อมูลต้นทาง ปรากฏในหน้าที่ถูกต้อง และค่า `total` ตรงกับผลลัพธ์หลังกรองก่อนแบ่งหน้า
- [x] Morning Action Plan เรียงลำดับงานตามกฎธุรกิจอย่างถูกต้อง (HIGH ขึ้นก่อน, ตามด้วย customerCode จากน้อยไปมาก BR-01)
- [x] Client List และ Dashboard ไม่แสดงข้อมูลหรือจำนวนลูกค้าของ RM อื่น และแสดงลำดับตาม API ส่งมา

**Verification:**
- [x] E2E tests บน fixture มากกว่า 20 Clients และ Supertest assertions ยืนยัน order และ count
- [x] ไม่ใช้ UI response เดียวกันมาเป็น expected result ทั้งหมด

**Files likely touched:**
- `e2e/client-directory.spec.ts`
- `e2e/morning-action-plan.spec.ts`

---

<a id="m5-008"></a>
### M5-008 — ตรวจ Profile snapshot และผลทางการเงิน
**Status:** DONE  
**Scope:** M  
**Dependencies:** M5-006  
**Requirements:** FR-06, FR-07, FR-08, FR-09, FR-10, FR-12, US-05, US-06, US-07, US-09, US-15, US-16

**งาน:**
ทดสอบการแสดงผลหน้า Client Profile, Financial Health, Next Best Action (NBA), Rule-Based Summary และความถูกต้องของข้อมูลทางการเงิน

**Acceptance criteria:**
- [x] หน้า Profile เรียก endpoint snapshot เพียงครั้งเดียวสำหรับประกอบข้อมูล Health, NBA, Summary โดยไม่เรียก sub-endpoints อื่น
- [x] Complete/incomplete profile, zero/null values, ทศนิยมทางการเงิน 2 ตำแหน่ง, รูปแบบวันที่ YYYY-MM-DD และ primary goal แสดงถูกต้องตาม contract
- [x] 5-Pillar Health Score breakdown, Single NBA card (action, reason, priority), และ deterministic summary แสดงตรงตามกฎธุรกิจ ห้าม hallucinate ข้อมูล
- [x] การตรวจรับอ้างอิง fixed fixtures และ boundary specifications ไม่ใช้ production function เดียวกันเป็น oracle เพียงอย่างเดียว

**Verification:**
- [x] API, component, และ E2E checks สอดคล้องกัน
- [x] ตรวจ network payload ยืนยัน single-request snapshot pattern

**Files likely touched:**
- `e2e/client-profile.spec.ts`

---

<a id="m5-009"></a>
### M5-009 — ตรวจ Family Graph และ ownership
**Status:** DONE  
**Scope:** M  
**Dependencies:** M5-008  
**Requirements:** FR-11, US-08, BR-10

**งาน:**
ทดสอบการโหลด Family Wealth Network แบบ on-demand, กฎการกลับทิศทางความสัมพันธ์ (BR-10) และการบังคับใช้ Multi-Tenancy Data Isolation

**Acceptance criteria:**
- [x] Family Network โหลดเมื่อกดเปิด (on-demand lazy fetch) แสดงความสัมพันธ์แบบ 1-hop
- [x] กฎ BR-10: แสดงความสัมพันธ์ถูกต้องทั้งกรณี primary client เป็น source หรือ target (PARENT ↔ CHILD สลับขั้ว, SPOUSE และ SIBLING คงเดิม) ทั้งใน SVG graph และ accessible HTML list
- [x] ใช้ UUID ของลูกค้าที่เป็นของ RM 2 ทดสอบด้วยบัญชี RM 1 ต้องได้รับ HTTP 404 (แยกเทสต่างหากจาก unknown UUID)
- [x] Cross-RM relationship fixture: บุคคลที่ไม่ได้อยู่ภายใต้การดูแลของ RM 1 จะต้องไม่ปรากฏใน nodes, edges, labels หรือจำนวนนับ
- [x] Unmount/remount หรือการเปลี่ยนลูกค้าต้องล้าง cache เก่าทันที ไม่นำ cache ข้ามสิทธิ์มาแสดง

**Verification:**
- [x] E2E tests แยก browser contexts ระหว่าง RM 1 และ RM 2
- [x] ผสานการตรวจ API assertions และ hook regression tests

**Files likely touched:**
- `e2e/family-network.spec.ts`

---

## Checkpoint D: Privacy, Recovery และ Usability
- [x] Checkpoint D Complete (M5-010 ถึง M5-012 ผ่านพร้อมหลักฐานจริง)

<a id="m5-010"></a>
### M5-010 — ตรวจ session เปลี่ยนระหว่างมีข้อมูลบนหน้า
**Status:** DONE  
**Scope:** M  
**Dependencies:** M5-007, M5-009  
**Requirements:** AUD-M4-001, AUD-M4-002, NFR-01

**งาน:**
ทดสอบการเปลี่ยนผ่าน session, การสลับบัญชี RM, การทำ multi-tab logout และการป้องกันข้อมูลรั่วไหลผ่าน BFCache หรือ delayed responses

**Acceptance criteria:**
- [x] สลับบัญชี RM 1 → RM 2 ในหน้าต่างเดียวกัน: sensitive UI subtrees (List, Dashboard, Profile, Family) ต้องถูก unmount และล้างข้อมูลเดิมทันที รวมถึง delayed responses จาก request เดิมต้องถูกละทิ้ง
- [x] Background revalidation หรือ dependency failure (503) ต้องซ่อนข้อมูลลูกค้าทันทีและแสดง banner พร้อมปุ่ม Retry โดยไม่ตีความเป็น session หมดอายุ
- [x] Multi-tab logout ผ่าน storage event เคลียร์ session ทุกแท็บที่เปิดอยู่
- [x] Browser Back/Forward และ lifecycle `pagehide`/`pageshow` มีหลักฐานตามพฤติกรรมจริง หาก Chromium headless ไม่เข้า BFCache ให้ระบุว่า case นั้นยังไม่พิสูจน์ ไม่ใช้ mock จำลอง

**Verification:**
- [x] ทดสอบ live components ร่วมกับ provider สำหรับ race conditions
- [x] Browser tests สำหรับ cookie และ context transitions

**Files likely touched:**
- `e2e/session-lifecycle.spec.ts`

---

<a id="m5-011"></a>
### M5-011 — ตรวจ failure และ recovery
**Status:** DONE  
**Scope:** M  
**Dependencies:** M5-008, M5-010  
**Requirements:** NFR-01, NFR-04

**งาน:**
ทดสอบความทนทานต่อความล้มเหลว (Resilience) เมื่อ database ดับ และการจัดประเภท error responses

**Acceptance criteria:**
- [x] เมื่อหยุด E2E PostgreSQL: endpoint `/health` และ API ที่ต่อกับฐานข้อมูลต้องตอบ 503 (DependencyUnavailableError) และเมื่อสตาร์ท DB กลับมา ระบบต้องฟื้นตัวกลับสู่ 200 ได้อัตโนมัติ
- [x] การจำแนกประเภท Client error: Malformed JSON (400), Unsupported MIME (415), Not Found (404), Rate Limit (429) และ timeout ระหว่างอ่าน body มี error envelope สอดคล้องกัน
- [x] UI ไม่แสดงข้อมูลเก่าค้าง และไม่แปลงความล้มเหลวของ service (500/503) ไปเป็น "Insufficient Data"

**Verification:**
- [x] แยก real dependency failure tests ออกจาก browser fault injection
- [x] Teardown คืนสภาพเฉพาะ E2E stack แม้ test จะ fail

**Files likely touched:**
- `e2e/failure-recovery.spec.ts`

---

<a id="m5-012"></a>
### M5-012 — ตรวจ usability และเก็บ performance baseline
**Status:** DONE  
**Scope:** M  
**Dependencies:** M5-007–011  
**Requirements:** NFR-02, NFR-06, NFR-07

**งาน:**
ตรวจรับความสะดวกในการใช้งานบนขนาดจอ Desktop/Laptop และเก็บข้อมูลประสิทธิภาพ (Performance Baseline) ของระบบบน production build

**Acceptance criteria:**
- [x] ตรวจสอบ layout บน viewport 1280×720 (Desktop) และ 1440×900 (Laptop), การนำทางด้วย keyboard, zoom 200% horizontal scroll, loading/empty/error states และ nullable ARIA attributes
- [x] วัดบน Next.js + Express production build: ทำการ warm-up 5 รอบ และเก็บข้อมูล 30 samples ต่อ flow วัด API request duration และ page time-to-ready
- [x] รายงานค่า median (p50) และ p95 เปรียบเทียบกับเป้าหมาย NFR-02 (API < 500 ms, Page Load < 2 s) พร้อมระบุ environment อย่างชัดเจนว่าเป็น local measurement (แยกจาก VM baseline)

**Verification:**
- [x] มีตาราง measurement data และ browser evidence ครบถ้วน
- [x] ไม่เคลมเกินจริงว่าเป็น production performance หรือ WCAG certified

**Files likely touched:**
- `e2e/usability-performance.spec.ts`
- `tasks/milestone-5/verification.md`

---

## Checkpoint E: Repeatability และ Handover
- [x] Checkpoint E Complete (M5-013 และ M5-014 ผ่านพร้อมหลักฐานจริง)

<a id="m5-013"></a>
### M5-013 — ตรวจ clean checkout และความทำซ้ำได้
**Status:** DONE  
**Scope:** S  
**Dependencies:** M5-012  
**Requirements:** NFR-04, Testing Standards

**งาน:**
ทดสอบการติดตั้งและรันคำสั่งทั้งหมดจาก Clean checkout เพื่อพิสูจน์ว่าระบบสามารถทำซ้ำได้ (Repeatability) โดยไม่พึ่งพา state ตกค้าง

**Acceptance criteria:**
- [x] Checkout สะอาดสามารถติดตั้งสำเร็จด้วย `npm ci` โดยรักษา lockfile เดิม
- [x] รัน lint, typecheck, unit, integration, build และ E2E สำเร็จ 2 รอบติดต่อกันโดยไม่ต้อง reset development database
- [x] ยืนยันว่าไม่มี hidden dependency หรือ state ตกค้างจากรอบก่อนหน้า
- [x] บันทึก tested SHA, commands, exit codes, execution times
- [x] `git diff` หลังรันต้องไม่มี untracked temporary files, secret credentials, หรือ test traces

**Verification:**
- [x] รันชุดคำสั่งทั้งหมดผ่าน exit code 0 (2 รอบติดต่อกัน)
- [x] ทุก failure (หากมี) มี owner ชัดเจนก่อนปิดงาน
- [x] บันทึกผลใน `tasks/milestone-5/verification.md`

**Files likely touched:**
- `tasks/milestone-5/verification.md`

---

<a id="m5-014"></a>
### M5-014 — ปิด acceptance matrix และส่งต่อ M6
**Status:** DONE  
**Scope:** S  
**Dependencies:** M5-013  
**Requirements:** Milestone 5 Completion & M6 Handover

**งาน:**
สรุปผล Requirement Acceptance Matrix, จัดทำเอกสารส่งมอบงาน (Handover Report) สู่ Milestone 6 และอัปเดต README.md

**Acceptance criteria:**
- [x] ทุก requirement ใน matrix มีผล `PASS`, `FAIL` หรือ `DEFERRED_M6` พร้อมหลักฐานอ้างอิงและเหตุผล
- [x] อัปเดต testing strategy ให้ Playwright Chromium เป็น gate ของ M5 ตามข้อตกลง โดยไม่เพิ่ม browser matrix อื่น
- [x] จัดทำเอกสาร Handover ระบุผลลัพธ์ที่พิสูจน์แล้ว, residual risks และ production gates ที่ส่งต่อให้ M6
- [x] อัปเดต `README.md` เพิ่มลิงก์ไปยัง Milestone 5 artifacts
- [x] ตรวจสอบ links, anchors, evidence references ทั้งหมดถูกต้องสมบูรณ์ ไม่มี acceptance ที่ยังไม่รันแต่ระบุ DONE

**Verification:**
- [x] เอกสาร M5 ทั้งหมดครบถ้วน พร้อมสำหรับการตรวจรับ (`tasks/milestone-5/handover.md`, `tasks/milestone-5/acceptance-matrix.md`, `README.md`)

**Files likely touched:**
- `tasks/milestone-5/acceptance-matrix.md`
- `tasks/milestone-5/handover.md`
- `README.md`
- `tasks/milestone-5/todo.md`

