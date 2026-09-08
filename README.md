# Meridian

Meridian เป็น prototype สำหรับ Relationship Manager (RM) เอกสารผลิตภัณฑ์ฉบับปัจจุบันอยู่ที่ [docs/context/README.md](docs/context/README.md); [meridian_project_context.md](meridian_project_context.md) เป็นเอกสารต้นฉบับเพื่ออ้างอิงประวัติ

## Milestone 1 local development

ต้องมี Node.js 22.14–25, npm 10 ขึ้นไป และ Docker Desktop ที่กำลังทำงาน ใช้ Node สำหรับ Next.js/Express บนเครื่อง และใช้ Docker เฉพาะ PostgreSQL/Caddy

```powershell
npm ci
Copy-Item .env.example .env
npm run db:up
npm run db:migrate
npm run dev:api
```

เปิด PowerShell อีกหน้าต่างแล้วรัน frontend และ Caddy:

```powershell
npm run dev:web
npm run proxy:up
```

เข้า `http://localhost:<CADDY_PORT>/`; Caddy ส่ง `/health` และ `/api/*` ไป API (`localhost:3001`) และส่งเส้นทางอื่นไป Next.js (`localhost:3000`) ค่า default คือ `8080`; หาก Windows สงวน port นี้ ให้เปลี่ยน `CADDY_PORT=8081` ใน `.env` ก่อนรัน `npm run proxy:up` การตั้งค่านี้เป็น local HTTP topology เท่านั้น ไม่ใช่ production TLS หรือ proxy-trust configuration

## Database และ tests

PostgreSQL development bind เฉพาะ `127.0.0.1:5432` และ data อยู่ใน named volume `meridian-postgres-data` Test database แยกโดยสมบูรณ์อยู่ที่ `127.0.0.1:5433` ใน Compose profile `test`

```powershell
npm run db:test:up
$env:DATABASE_URL = (Get-Content .env | Where-Object { $_ -like 'DATABASE_URL=*' }).Substring(13)
$env:TEST_DATABASE_URL = (Get-Content .env | Where-Object { $_ -like 'TEST_DATABASE_URL=*' }).Substring(18)
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npm run prisma:migrate -w @meridian/api
$env:DATABASE_URL = (Get-Content .env | Where-Object { $_ -like 'DATABASE_URL=*' }).Substring(13)
npm run test:integration
```

`TEST_DATABASE_URL` ต้องชี้ database ชื่อ `meridian_test` ที่ port `5433` และต้องไม่เท่ากับ `DATABASE_URL`; test harness จะปฏิเสธ target อื่นก่อนเชื่อมต่อหรือ cleanup

คำสั่ง `db:migrate` โหลด `DATABASE_URL` จาก `.env` โดยตรง หากต้อง apply migration กับ test database ให้ตั้งค่า `DATABASE_URL` ใน PowerShell เป็น `TEST_DATABASE_URL` เฉพาะคำสั่งนั้นตามตัวอย่างข้างต้น

คำสั่งตรวจรับ M1:

```powershell
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:integration
```

ผลทดสอบจริงและสถานะ tickets อยู่ใน [tasks/todo.md](tasks/todo.md) โดยแยกจากแผนใน [tasks/plan.md](tasks/plan.md)
