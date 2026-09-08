# Meridian Milestone 5 — Requirement Acceptance Matrix

เอกสารนี้ระบุการเชื่อมโยงความสอดคล้องของข้อกำหนด (Requirement Traceability & Acceptance Matrix) สำหรับ **Milestone 5: Integration, Ownership และ Acceptance Verification** โดยแยกตาม Functional Requirements (FR), Non-Functional Requirements (NFR), User Stories (US) และ Audit Findings (AUD-M4-001–010) พร้อมทั้งระบุ Test Layer, Scenarios, Evidence Targets และสถานะการตรวจรับจริง

---

## สรุปสถานะการตรวจรับภาพรวม (Executive Summary)

| กลุ่มข้อกำหนด | ทั้งหมด | ตรวจรับผ่านใน M5 (PASS) | มอบหมายสู่ M6 (DEFERRED_M6) | อัตราความสำเร็จใน M5 |
|---|:---:|:---:|:---:|:---:|
| **Functional Requirements (FR)** | 25 | **12** (FR-01–12) | **13** (FR-13–25) | **100%** ของขอบเขต M5 |
| **Non-Functional Requirements (NFR)** | 10 | **8** (NFR-01–02, 04–07, 09–10) | **2** (NFR-03, 08) | **100%** ของขอบเขต M5 |
| **User Stories (US)** | 16 | **11** (US-01–09, 15–16) | **5** (US-10–14) | **100%** ของขอบเขต M5 |
| **Audit Regression (AUD-M4)** | 10 | **10** (AUD-M4-001–010) | 0 | **100%** (Zero Regression) |
| **รวมทั้งหมด** | **61** | **41 รายการ** | **20 รายการ** | **100% ผ่านเกณฑ์** |

---

## 1. Functional Requirements (FR-01 ถึง FR-25)

| ID | คำอธิบายความต้องการ | M5 Status | Test Layer | Scenario / Test Case | หลักฐานตรวจรับ |
|---|---|:---:|---|---|---|
| **FR-01** | Login, logout, validate session และ protect authenticated routes | **PASS** | Supertest + Playwright E2E | - ล็อกอิน credentials ถูกต้องสร้าง HttpOnly cookie<br>- ล็อกอินผิดได้ 401<br>- Logout ส่ง 204 และล้าง cookie<br>- เข้า protected route โดยไม่มี session redirect ไป `/login`<br>- Expired/invalid JWT คืน 401 | `e2e/auth.spec.ts`<br>`backend/tests/integration/api/auth-contracts.test.ts` |
| **FR-02** | แสดง Client List เฉพาะของ RM และแสดง total หลังกรอง | **PASS** | Supertest + Playwright E2E | - RM 1 เห็นเฉพาะลูกค้าของตนเอง<br>- ค่า total ตรงกับจำนวนหลังกรองก่อนแบ่งหน้า<br>- ข้อมูลส่งตาม schema contract | `e2e/client-directory.spec.ts`<br>`backend/tests/integration/api/client-list-search.test.ts` |
| **FR-03** | Search ชื่อ/customer code แบบ partial, case-insensitive ร่วมกับ filter | **PASS** | Supertest + Playwright E2E | - ค้นหาชื่อ "som" หรือรหัส "TH-" ได้ผลลัพธ์ที่ตรง<br>- ใช้งานร่วมกับตัวกรอง Priority/Health ได้ | `e2e/client-directory.spec.ts`<br>`frontend/tests/client-filters.test.tsx` |
| **FR-04** | Filter Priority และ Health พร้อมกันได้ และปุ่ม Reset คืนค่าเริ่มต้น | **PASS** | Supertest + Playwright E2E | - เลือก Priority=HIGH และ Health=MODERATE หรือ AT_RISK พร้อมกัน<br>- กด Reset ล้างค่า query ทั้งหมดและรีเซ็ต page=1 | `e2e/client-directory.spec.ts`<br>`frontend/tests/client-filters.test.tsx` |
| **FR-05** | Morning Action Plan คำนวณ เรียงลำดับ และลิงก์ไปยัง Profile | **PASS** | Supertest + Playwright E2E | - เรียงตามความสำคัญ: HIGH ก่อน MEDIUM/LOW โดยมี secondary tie-break เป็น customerCode ascending<br>- แสดง reason badge ตามกฎที่ทริกเกอร์<br>- คลิกที่ชื่อลูกค้าเปิดไปหน้า `/clients/[id]` | `e2e/morning-action-plan.spec.ts`<br>`backend/tests/integration/api/dashboard-action-plan.test.ts` |
| **FR-06** | Client Profile แสดงข้อมูลส่วนตัว, Health, Risk, goals, summary, NBA | **PASS** | Supertest + Playwright E2E | - Snapshot endpoint เดียวส่งข้อมูลครบทุกมิติ<br>- Complete profile แสดงครบ 5 เสาหลัก<br>- Primary goal คำนวณความคืบหน้าตรงสูตร | `e2e/client-profile.spec.ts`<br>`backend/tests/integration/api/client-profile.test.ts` |
| **FR-07** | คำนวณ Financial Health 0–100 แบบ deterministic หรือ `INSUFFICIENT_DATA` | **PASS** | Unit + Supertest + Playwright E2E | - คะแนน 0–100 เมื่อข้อมูลครบ 5 เสา<br>- ส่งคืนคะแนนเป็น `null` พร้อมสถานะ INSUFFICIENT_DATA เมื่อข้อมูลไม่ครบ<br>- ไม่แสดงคะแนนเทียม | `e2e/client-profile.spec.ts`<br>`backend/tests/unit/financial/health.test.ts` |
| **FR-08** | Breakdown 5 เสาหลัก ผลรวมตรงกับคะแนนรวม และระบุ missing components | **PASS** | Unit + Playwright E2E | - ผลรวมคะแนนแต่ละเสาตรงกับ overall health score<br>- เสาที่ขาดข้อมูลแสดง missingFields ชัดเจน | `e2e/client-profile.spec.ts`<br>`frontend/tests/health-panel.test.tsx` |
| **FR-09** | สร้าง NBA หลัก 1 รายการที่มี action, reason, priority และ rule name | **PASS** | Unit + Supertest + Playwright E2E | - ผลิต Next Best Action เพียงหนึ่งเดียวที่มีลำดับความสำคัญสูงสุดตาม rule precedence (BR-05)<br>- ตรึงวันที่ประเมิน `2026-09-08` | `e2e/client-profile.spec.ts`<br>`backend/tests/unit/financial/recommendation.test.ts` |
| **FR-10** | ไม่มี NBA ถูกส่งคืนโดยปราศจาก rule reason ที่เลือก | **PASS** | Unit + Supertest + Playwright E2E | - Recommendation card แสดง reason สอดคล้องกับ rule ที่ชนะเสมอ | `e2e/client-profile.spec.ts`<br>`backend/tests/unit/financial/recommendation.test.ts` |
| **FR-11** | แสดง Family Wealth Network 1-hop เฉพาะ nodes/edges ที่ RM เห็นได้ | **PASS** | Supertest + Playwright E2E | - โหลดเมื่อเปิด (on-demand lazy fetch)<br>- สลับขั้ว PARENT ↔ CHILD เมื่อ primary เป็น target (BR-10)<br>- กรอง nodes/edges ของ RM อื่นออกทั้งหมด | `e2e/family-network.spec.ts`<br>`backend/tests/integration/api/family-graph.test.ts` |
| **FR-12** | สร้าง Client Summary จากข้อมูลและ derived logic ห้ามสร้างข้อมูลใหม่ | **PASS** | Unit + Playwright E2E | - ข้อความสรุปถูกสร้างขึ้นแบบ template-based จาก health score, primary goal, main issue และ NBA<br>- ปราศจากข้อมูล hallucination | `e2e/client-profile.spec.ts`<br>`backend/tests/unit/financial/summary.test.ts` |
| **FR-13** | Webhook verify signature และ branch ก่อนทริกเกอร์ pipeline | **DEFERRED_M6** | CI/CD Integration | มอบหมายสู่ Milestone 6 (Jenkins Pipeline Automation) | `Jenkinsfile` / M6 verification |
| **FR-14** | Jenkins บันทึก exact commit SHA ที่ทริกเกอร์ | **DEFERRED_M6** | CI/CD Integration | มอบหมายสู่ Milestone 6 | `Jenkinsfile` / M6 verification |
| **FR-15** | ติดตั้ง dependencies ด้วย `npm ci` และ lockfile | **DEFERRED_M6** | CI/CD Pipeline | มอบหมายสู่ Milestone 6 | `Jenkinsfile` / M6 verification |
| **FR-16** | Lint failure ขัดขวางและหยุด pipeline | **DEFERRED_M6** | CI/CD Pipeline | มอบหมายสู่ Milestone 6 | `Jenkinsfile` / M6 verification |
| **FR-17** | รัน frontend/backend unit และ API tests ก่อน deploy | **DEFERRED_M6** | CI/CD Pipeline | มอบหมายสู่ Milestone 6 | `Jenkinsfile` / M6 verification |
| **FR-18** | Test failure ทำให้ build/deploy stages ถูก skip | **DEFERRED_M6** | CI/CD Pipeline | มอบหมายสู่ Milestone 6 | `Jenkinsfile` / M6 verification |
| **FR-19** | สร้าง Docker images (frontend/backend) ด้วย recorded SHA | **DEFERRED_M6** | Container Build | มอบหมายสู่ Milestone 6 | `Dockerfile.*` / M6 verification |
| **FR-20** | Image tag และ running health version ใช้ SHA เดียวกัน | **DEFERRED_M6** | Container Orchestration | มอบหมายสู่ Milestone 6 | `Jenkinsfile` / M6 verification |
| **FR-21** | Trivy สแกนทั้งสอง images ตรวจจับ HIGH และ CRITICAL | **DEFERRED_M6** | Security Gate | มอบหมายสู่ Milestone 6 | `Jenkinsfile` / Trivy reports |
| **FR-22** | มีช่องโหว่ HIGH/CRITICAL หรือ scanner error ต้องบล็อกการ deploy | **DEFERRED_M6** | Security Gate | มอบหมายสู่ Milestone 6 | `Jenkinsfile` / M6 verification |
| **FR-23** | เฉพาะ main build ที่ผ่านเกณฑ์ทุกขั้นจึงรัน Docker Compose deploy | **DEFERRED_M6** | Deployment Gate | มอบหมายสู่ Milestone 6 | `Jenkinsfile` / M6 verification |
| **FR-24** | Health check ตรวจสอบ API, database readiness, version และ web | **DEFERRED_M6** | Post-Deploy Verification | มอบหมายสู่ Milestone 6 | `deploy-verify.sh` / M6 |
| **FR-25** | Jenkins บันทึก Success, Failed หรือ Skipped สำหรับทุก stage | **DEFERRED_M6** | CI/CD Reporting | มอบหมายสู่ Milestone 6 | `Jenkinsfile` / M6 |

---

## 2. Non-Functional Requirements (NFR-01 ถึง NFR-10)

| ID | คำอธิบายความต้องการ | M5 Status | Test Layer | Scenario / Evidence | หลักฐานตรวจรับ |
|---|---|:---:|---|---|---|
| **NFR-01** | bcrypt password hash, expiring session, protected routes, secrets ผ่าน environment | **PASS** | Unit + Supertest + Playwright E2E | - รหัสผ่าน hash cost 12<br>- Session cookie HttpOnly, SameSite=Lax<br>- ปฏิเสธ mismatched Origin บน state-changing requests<br>- Rate limiter 429 พร้อม Retry-After | `e2e/auth.spec.ts`<br>`backend/tests/unit/services/password.service.test.ts` |
| **NFR-02** | API response < 500 ms และ page load < 2 s บน prototype dataset | **PASS** | Benchmark (Node + Playwright) | - วัด 30 samples ต่อ flow บน production build หลัง warm-up 5 รอบ<br>- ผลลัพธ์: API p95 < 130 ms, Page ready p95 < 432 ms (ผ่านเกณฑ์ทั้งหมด) | `e2e/usability-performance.spec.ts`<br>`tasks/milestone-5/verification.md` |
| **NFR-03** | Failed build หรือ scan ต้องไม่แทนที่ version ที่กำลังรัน | **DEFERRED_M6** | CI/CD Orchestration | จัดการผ่าน Blue/Green หรือ staged rollout ใน Milestone 6 | `Jenkinsfile` / M6 |
| **NFR-04** | TypeScript, modular naming, ESLint, business logic แยกจาก controller | **PASS** | Static Analysis + Build | - `npm run lint` 0 errors, 0 warnings<br>- `npm run typecheck` 0 errors across API/Web<br>- Clean bundle boundary | `tasks/milestone-5/verification.md` |
| **NFR-05** | Domain services ทดสอบได้โดยไม่พึ่ง controller หรือ database | **PASS** | Unit Tests | - ทดสอบ domain evaluation, health, recommendation, summary แบบ pure functions | `backend/tests/unit/financial/*.test.ts` |
| **NFR-06** | UI desktop/laptop อ่านง่าย มี loading, empty, error states ชัดเจน | **PASS** | Component + Playwright E2E | - ตรวจสอบ layout 1280×720 และ 1440×900<br>- แสดง empty state เมื่อ search ไม่พบ<br>- แสดง error retry เมื่อ network fail | `e2e/usability-performance.spec.ts`<br>`frontend/tests/accessibility-usability.test.tsx` |
| **NFR-07** | ทุก score และ recommendation มีคำอธิบายที่มาอย่างโปร่งใส | **PASS** | Component + Playwright E2E | - Health score breakdown แยกคะแนนย่อย 5 ด้าน<br>- NBA แสดง rule code และ actionable rationale | `e2e/client-profile.spec.ts`<br>`frontend/tests/health-panel.test.tsx` |
| **NFR-08** | Traceability จาก Git commit → Jenkins build → Docker image → running version | **DEFERRED_M6** | CI/CD Traceability | ตรวจสอบผ่าน metadata และ tag sha ใน Milestone 6 | M6 handover / Jenkins |
| **NFR-09** | รันได้ด้วย Docker Compose บนโฮสต์ที่มี configuration ครบ | **PASS** | Integration / Infrastructure | - รัน `postgres-e2e` บน port 5544 และ Caddy proxy บน port 8180 ผ่าน Docker Compose ได้ราบรื่น | `docker-compose.yml`<br>`e2e/support/stack-launcher.ts` |
| **NFR-10** | Foreign keys และ database constraints สำหรับความสัมพันธ์สำคัญ | **PASS** | Schema Tests | - Prisma schema กำหนด onDelete: Cascade และ unique compound constraints บน FamilyRelationship, ClientProfile, Goal | `backend/tests/integration/schema.test.ts` |

---

## 3. User Stories (US-01 ถึง US-16)

| ID | Story Summary | M5 Status | Test Layer | Scenario & Verification Target |
|---|---|:---:|---|---|
| **US-01** | RM login เพื่อเข้าถึงข้อมูล | **PASS** | Playwright E2E | เข้าสู่ระบบสำเร็จด้วย RM 1, ทดสอบ invalid password, logout ล้าง session, protected URL navigation (`e2e/auth.spec.ts`) |
| **US-02** | RM ดู Morning Action Plan | **PASS** | Playwright E2E | ตรวจสอบลำดับการแสดงผล HIGH นำหน้า, badge เหตุผล, คลิกเข้า Client Profile สำเร็จ (`e2e/morning-action-plan.spec.ts`) |
| **US-03** | RM ค้นหา Client | **PASS** | Playwright E2E | ค้นหาชื่อและรหัสลูกค้า, แสดง empty state เมื่อไม่พบ (`e2e/client-directory.spec.ts`) |
| **US-04** | RM กรอง Client และ Reset | **PASS** | Playwright E2E | กรอง Priority/Health ร่วมกัน, กด Reset คืนค่าทั้งหมด, pagination fixture >20 clients (`e2e/client-directory.spec.ts`) |
| **US-05** | RM ดู Client Profile | **PASS** | Playwright E2E | โหลด snapshot เดียว, เข้าถึงข้อมูลลูกค้าของ RM 2 ได้ 404 Client Not Found (`e2e/client-profile.spec.ts`) |
| **US-06** | RM เข้าใจคะแนน Health | **PASS** | Playwright E2E | ข้อมูลครบแสดงคะแนน 0–100, ข้อมูลไม่ครบแสดง INSUFFICIENT_DATA ไม่แสดงเลขเทียม (`e2e/client-profile.spec.ts`) |
| **US-07** | RM ดูคำแนะนำ NBA | **PASS** | Playwright E2E | แสดง NBA หนึ่งรายการที่มี action, priority, reason สอดคล้องกับ business rule (`e2e/client-profile.spec.ts`) |
| **US-08** | RM ดู Family Network | **PASS** | Playwright E2E | โหลดเมื่อกดเปิด, 1-hop nodes, กลับทิศทางตาม BR-10, ไม่เห็นบุคคลของ RM อื่น (`e2e/family-network.spec.ts`) |
| **US-09** | RM อ่าน Client Summary | **PASS** | Playwright E2E | สรุปข้อมูล 4 ส่วนสำคัญ (Health, Goal, Issue, NBA) โดยไม่มีข้อมูลแต่งเติม (`e2e/client-profile.spec.ts`) |
| **US-10** | Developer push code → trigger Jenkins | **DEFERRED_M6** | CI/CD | มอบหมายสู่ Milestone 6 (Webhook & Pipeline) |
| **US-11** | Developer เห็น test result | **DEFERRED_M6** | CI/CD | มอบหมายสู่ Milestone 6 (Pipeline Stage Status) |
| **US-12** | Developer เห็น scan result | **DEFERRED_M6** | CI/CD | มอบหมายสู่ Milestone 6 (Trivy Security Gate) |
| **US-13** | Developer deploy ไปยัง environment | **DEFERRED_M6** | CI/CD | มอบหมายสู่ Milestone 6 (Automated Deployment) |
| **US-14** | Developer ตรวจสอบ failed/skipped stages | **DEFERRED_M6** | CI/CD | มอบหมายสู่ Milestone 6 (Jenkins Stage View) |
| **US-15** | RM ดู Health breakdown ละเอียด | **PASS** | Playwright E2E | อธิบายคะแนนย่อย 5 มิติ และระบุ missing fields (`e2e/client-profile.spec.ts`) |
| **US-16** | RM ดูเหตุผลของคำแนะนำ NBA | **PASS** | Playwright E2E | การ์ด NBA แสดง rule code และ actionable rationale อย่างชัดเจน (`e2e/client-profile.spec.ts`) |

---

## 4. Audit Findings Mapping (AUD-M4-001 ถึง AUD-M4-010)

| Audit Finding ID | ปัญหาเดิมที่พบ | Status | Regression Test Scenario ใน M5 | หลักฐานตรวจรับใน M5 |
|---|---|:---:|---|---|
| **AUD-M4-001** | React state ค้างข้อมูลลูกค้าเดิมเมื่อสลับ RM ในแท็บเดิม | **PASS** | E2E Scenario: Login RM 1 → เปิดดู Profile ลูกค้า → สลับ Login เป็น RM 2 ในหน้าต่างเดิม → ตรวจสอบว่าหน้าจอ unmount และล้างข้อมูลลูกค้าเดิมทันที | `e2e/session-lifecycle.spec.ts` |
| **AUD-M4-002** | UI แสดงข้อมูลลูกค้าระหว่าง session revalidation / 503 | **PASS** | E2E Scenario: ระหว่างเปิดหน้า Profile จำลอง backend 503 → หน้าจอต้องซ่อนข้อมูลอ่อนไหวและแสดง banner "Retry Connection" | `e2e/session-lifecycle.spec.ts` |
| **AUD-M4-003** | Family network cache ค้างข้ามลูกค้าเมื่อ unmount | **PASS** | E2E Scenario: เปิด Family ของลูกค้า A → สลับไปลูกค้า B → ข้อมูลเครือข่ายของ A ต้องไม่หลงเหลือใน cache | `e2e/family-network.spec.ts` |
| **AUD-M4-004** | MIME type `application/*+json` ไม่ถูกรับโดย `express.json` | **PASS** | API Contract Scenario: ส่ง request header `Content-Type: application/vnd.api+json` ต้อง parse body ได้ถูกต้อง | `backend/tests/integration/api/auth-contracts.test.ts` |
| **AUD-M4-005** | API client logout ยอมรับ 200 OK แทนที่จะบังคับ 204 | **PASS** | API Scenario: จำลอง logout endpoint ตอบ 200 OK JSON → API client ต้อง reject เป็น INVALID_RESPONSE | `frontend/tests/api-client.test.ts` |
| **AUD-M4-006** | `display-format.ts` มีเครื่องหมาย `฿` ฮาร์ดโค้ด | **PASS** | Component / E2E Scenario: ตรวจสอบจำนวนเงินในตารางและ Profile ว่าแสดงเฉพาะตัวเลขคั่นจุลภาค (neutral formatting) | `e2e/client-profile.spec.ts` |
| **AUD-M4-007** | ขาดตัวอย่าง client UUID ของ RM 2 ในเอกสาร | **PASS** | E2E Test: ใช้ UUID `00000000-0000-4000-8000-000000000016` (Pakorn Panyarat) ของ RM 2 ในการทดสอบ cross-RM 404 | `e2e/client-profile.spec.ts`<br>`e2e/family-network.spec.ts` |
| **AUD-M4-008** | Incomplete score แสดง `role="progressbar" aria-valuenow="0"` | **PASS** | E2E Scenario: เปิดดู Incomplete profile ตรวจสอบว่าเสาที่คะแนนเป็น null ไม่ emit `role="progressbar"` | `e2e/client-profile.spec.ts` |
| **AUD-M4-009** | AbortSignal ระหว่าง streaming json เสีย flag `isAbort` | **PASS** | API Client Scenario: ยกเลิกระหว่างอ่าน body response ต้องรักษาแฟล็ก `isAbort: true` | `frontend/tests/api-client.test.ts` |
| **AUD-M4-010** | Graceful shutdown เคลียร์ forceTimeout ก่อน Prisma disconnect | **PASS** | Code Inspection / Process Shutdown Test: ยืนยันว่า timeout deadline ครอบคลุมการ disconnect ของ Prisma | `backend/src/server.ts` |
