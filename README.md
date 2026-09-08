# Meridian

ผลการส่งมอบ Milestone 5: [Integration, Ownership และ Acceptance Verification](tasks/milestone-5/handover.md) และ [tickets M5-001–014](tasks/milestone-5/todo.md) — สถานะเสร็จสมบูรณ์ 100% (DONE) พร้อมส่งต่อ Milestone 6

Meridian เป็น prototype สำหรับ Relationship Manager (RM) เอกสารผลิตภัณฑ์ฉบับปัจจุบันอยู่ที่ [docs/context/README.md](docs/context/README.md); [meridian_project_context.md](meridian_project_context.md) เป็นเอกสารต้นฉบับเพื่ออ้างอิงประวัติ

## Milestone 1–5 local development

ต้องมี Node.js 22.14–25, npm 10 ขึ้นไป และ Docker Desktop ที่กำลังทำงาน ใช้ Node สำหรับ Next.js/Express บนเครื่อง และใช้ Docker เฉพาะ PostgreSQL/Caddy

```powershell
npm ci
Copy-Item .env.example .env
npm run db:up
npm run db:migrate
npm run db:seed -- --as-of 2026-09-08
npm run dev:api
```

เปิด PowerShell อีกหน้าต่างแล้วรัน frontend และ Caddy:

```powershell
npm run dev:web
npm run proxy:up
```

เข้า `http://localhost:<CADDY_PORT>/`; Caddy ส่ง `/health` และ `/api/*` ไป API (`localhost:3001`) และส่งเส้นทางอื่นไป Next.js (`localhost:3000`) ค่า default คือ `8080`; หาก Windows สงวน port นี้ ให้เปลี่ยน `CADDY_PORT=8081` ใน `.env` ก่อนรัน `npm run proxy:up`

### ข้อมูลสำหรับทดสอบเข้าใช้งาน (Seed Credentials):
- **RM 1:** `rm1@meridian.local` / `Password123!` (ดูแลลูกค้า `C-001` ถึง `C-015`)
- **RM 2:** `rm2@meridian.local` / `Password123!` (ดูแลลูกค้า `C-016` ถึง `C-030`)

## Database และ Testing Architecture

ระบบทดสอบของ Meridian แบ่งออกเป็น 3 เลเยอร์อย่างเคร่งครัดตามหลักการ Data Isolation:
1. **Development Database:** PostgreSQL bind `127.0.0.1:5432` (`meridian`)
2. **Integration Test Database:** PostgreSQL bind `127.0.0.1:5433` (`meridian_test` ใน Compose profile `test`)
3. **E2E Acceptance Database:** PostgreSQL bind `127.0.0.1:5544` (`meridian_e2e` ใน Compose profile `e2e` มี fail-closed guard ปฏิเสธการแตะต้องฐานข้อมูลอื่น)

### คำสั่งตรวจรับคุณภาพทั้งระบบ:

```powershell
# 1. การตรวจสอบรูปแบบโค้ดและ Type Safety
npm run lint
npm run typecheck

# 2. การทดสอบระดับ Unit (Pure financial logic & component contracts)
npm run test:unit

# 3. การทดสอบระดับ Integration (API & DB schema contracts บนพอร์ต 5433)
npm run test:integration

# 4. ทดสอบ Production Bundle Build
npm run build

# 5. การทดสอบระดับ End-to-End Acceptance (Playwright Chromium บนพอร์ต 8180 & DB 5544)
npm run test:e2e
```

หากต้องการเปิด browser จริงเพื่อสังเกตการทดสอบ E2E ให้ใช้:
```powershell
npm run test:e2e:headed
```

## เอกสารอ้างอิงประจำ Milestones
- **Milestone 1:** [tasks/milestone-1/todo.md](tasks/milestone-1/todo.md)
- **Milestone 2:** [tasks/milestone-2/todo.md](tasks/milestone-2/todo.md)
- **Milestone 3:** [tasks/milestone-3/todo.md](tasks/milestone-3/todo.md)
- **Milestone 4:** [tasks/milestone-4/todo.md](tasks/milestone-4/todo.md) | [handover.md](tasks/milestone-4/handover.md)
- **Milestone 5:**
  - [plan.md](tasks/milestone-5/plan.md) — แผนงานและข้อตกลง M5
  - [todo.md](tasks/milestone-5/todo.md) — สถานะ tickets M5-001 ถึง M5-014 (DONE 100%)
  - [acceptance-matrix.md](tasks/milestone-5/acceptance-matrix.md) — Requirement Traceability Matrix
  - [verification.md](tasks/milestone-5/verification.md) — บันทึกหลักฐานผลการทดสอบจริง
  - [handover.md](tasks/milestone-5/handover.md) — รายงานการส่งมอบสู่ Milestone 6 (CI/CD Pipeline)
