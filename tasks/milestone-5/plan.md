# Meridian — Milestone 5: Integration, Ownership และ Acceptance Verification

## 1. เป้าหมายและฐานที่ใช้วางแผน

แผนการดำเนินงาน Milestone 5 (M5) สำหรับระบบ **Meridian** มีเป้าหมายเพื่อพิสูจน์ความถูกต้องแบบ End-to-End ว่า frontend (Next.js App Router), API (Express + Prisma) และ database (PostgreSQL 17) ทำงานร่วมกันจริงตาม requirements (FR-01–12, NFR-01–10, US-01–16) และ business rules (BR-01–10) โดยเพิ่ม **Playwright E2E** ตามตัวเลือกที่ได้รับการยืนยันแล้ว

- **วันที่วางแผน:** 2026-09-09
- **Git baseline:** `c4528cffafaa08a48504024d1c31a0b37bd39bc2` (`c4528cf`) ซึ่งแก้ปัญหา AUD-M4-001 ถึง AUD-M4-010 แล้ว
- **Working Tree:** สะอาด (Clean working tree)
- **สถานะเริ่มต้น:** ทุก ticket เริ่มด้วยสถานะ `TODO` และติดตามความคืบหน้าผ่าน [todo.md](todo.md) โดยต้องใช้หลักฐานจริงในการปิดงานเท่านั้น
- **ขอบเขตการส่งมอบ:**
  - `tasks/milestone-5/plan.md` — ข้อตกลงและลำดับงาน
  - `tasks/milestone-5/todo.md` — tickets M5-001 ถึง M5-014 พร้อม 5 Checkpoints
  - `tasks/milestone-5/acceptance-matrix.md` — ตาราง Requirement Acceptance Matrix
  - `tasks/milestone-5/verification.md` — บันทึกผลการทดสอบและหลักฐานจริง
  - `tasks/milestone-5/handover.md` — รายงานการส่งมอบสู่ Milestone 6 พร้อมเชื่อมโยงจาก `README.md`

---

## 2. รูปแบบการทดสอบและสถาปัตยกรรม E2E

### 2.1 Test Stack Isolation
- **E2E PostgreSQL Database:**
  - กำหนด service ใน `docker-compose.yml` ภายใต้ profile `e2e`: database `meridian_e2e`, user `meridian_e2e`, password `meridian_e2e_password`
  - เผยแพร่พอร์ตผูกกับ loopback เท่านั้น: `127.0.0.1:5544:5432` และแยก volume `meridian-postgres-e2e-data`
  - มี **Database Guard** ตรวจสอบ URL, hostname, port (5544), user, และ query `SELECT current_database()` อย่างเคร่งครัด หากตรวจพบการ fallback ไปยัง `DATABASE_URL` (5432) หรือ `TEST_DATABASE_URL` (5433) จะปฏิเสธทันที
- **Application Server (API):**
  - รัน Express backend บน loopback port `127.0.0.1:3101`
  - ตรึงวันประเมินทางการเงินไว้ที่ `2026-09-08` ผ่าน dependency injection clock โดยไม่มี test-control endpoints สาธารณะในแอป
  - JWT token ยังคงใช้เวลาจริง (`Date.now()`) เพื่อให้การทดสอบ session expiration เป็นไปตามเงื่อนไขจริง
- **Web Frontend:**
  - รัน Next.js production build (`next build` + `next start`) บน loopback port `127.0.0.1:3100`
- **Reverse Proxy (Caddy):**
  - รัน Caddy บน loopback port `127.0.0.1:8180:8080` (profile `e2e-proxy`) ชี้ `/api/*` และ `/health` ไปยัง Express API (`3101`) และ paths อื่นไปยัง Next.js Web (`3100`)
- **Process Management & Cleanup:**
  - Runner ไม่ reuse processes ที่มีอยู่เดิม ต้องตรวจ readiness/version ก่อนเริ่มทดสอบ
  - หยุดและทำความสะอาดเฉพาะ processes และ containers ที่ runner สร้างขึ้นเมื่อเสร็จสิ้น หรือเมื่อเกิดข้อผิดพลาด/การยกเลิก

### 2.2 Playwright Configuration & Data Constraints
- **Test Engine:** เพิ่ม `@playwright/test` ใน root workspace และรักษา single lockfile (`package-lock.json`)
- **Execution:** ใช้ Chromium เท่านั้น, `workers: 1`, `retries: 0`
- **Browser Contexts:** สร้าง new browser context ต่อแต่ละ test case และแยก browser contexts อิสระระหว่าง RM 1 และ RM 2
- **No Mocking:** ห้าม mock API ในชุด happy-path และ ownership acceptance suite โดยเรียกผ่าน Caddy proxy เสมือนการใช้งานจริง
- **Trace & Privacy:** บันทึก failure screenshots และ traces เฉพาะเมื่อ test ล้มเหลว และไม่ commit cookies, storage states หรือ credentials ลง Git
- **Fixtures:**
  - Normal seed: 2 RM และ 30 Clients
  - Pagination fixture: ข้อมูลลูกค้าของ RM เดียวมากกว่า 20 ราย
  - Anomaly & Cross-RM fixtures: แยกตาม scenario และล้างเฉพาะใน E2E database

### 2.3 Milestone Boundaries (M5 vs M6)
- **Milestone 5 Scope:** Product acceptance FR-01–12, NFR-01–02, NFR-04–07, NFR-10, US-01–09, US-15–16
- **Deferred to Milestone 6 (`DEFERRED_M6`):**
  - FR-13–25, NFR-03, NFR-08, US-10–14 (Webhook triggers, Jenkins CI/CD pipeline stages, Trivy container security scans, deployment gates, production container orchestration, and production domain TLS)
  - รายการเหล่านี้จะถูกมาร์กเป็น `DEFERRED_M6` พร้อมเหตุผลชัดเจนใน matrix โดยไม่ประกาศว่าผ่านใน M5

---

## 3. ลำดับงานและ Checkpoints

1. **Checkpoint A (หลัง 001–003):** Baseline, Acceptance Matrix และ Data Isolation พร้อม
   - M5-001: ตรวจ baseline หลังแก้ M4
   - M5-002: สร้าง requirement acceptance matrix
   - M5-003: สร้าง isolated E2E database และ fixtures
2. **Checkpoint B (หลัง 004–006):** Isolated Stack และ Authentication ผ่านจริง
   - M5-004: เตรียม application stack สำหรับ E2E
   - M5-005: ติดตั้ง Playwright และคำสั่ง acceptance
   - M5-006: ตรวจ Login, logout และ session contracts
3. **Checkpoint C (หลัง 007–009):** Product Flows และ Ownership ผ่านครบ
   - M5-007: ตรวจ Client List และ Morning Action Plan
   - M5-008: ตรวจ Profile snapshot และผลทางการเงิน
   - M5-009: ตรวจ Family Graph และ ownership
4. **Checkpoint D (หลัง 010–012):** Privacy, Failure Recovery และ Usability มีหลักฐาน
   - M5-010: ตรวจ session เปลี่ยนระหว่างมีข้อมูลบนหน้า
   - M5-011: ตรวจ failure และ recovery
   - M5-012: ตรวจ usability และเก็บ performance baseline
5. **Checkpoint E (หลัง 013–014):** M5 พร้อมส่งต่อโดยมีหลักฐานตรวจสอบย้อนกลับได้
   - M5-013: ตรวจ clean checkout และความทำซ้ำได้ (PASS)
   - M5-014: ปิด acceptance matrix และส่งต่อ M6 (PASS)

---

## 4. สถานะการส่งมอบ Milestone 5 (Final Status)
- **สถานะ:** **ACCEPTED / COMPLETED 100%**
- **วันที่ตรวจรับ:** 2026-09-09
- **เอกสารส่งมอบครบถ้วน:**
  - [todo.md](todo.md) — 14/14 tickets DONE
  - [acceptance-matrix.md](acceptance-matrix.md) — 100% verified (31 PASS, 20 DEFERRED_M6, 10 AUD-M4 PASS)
  - [verification.md](verification.md) — บันทึกผลการทดสอบจริงครบทุก Checkpoints A–E
  - [handover.md](handover.md) — รายงานการส่งมอบสู่ Milestone 6
  - [README.md](../../README.md) — อัปเดตข้อมูลเชื่อมโยง M5 และคำสั่งทดสอบ E2E
