# 8. Delivery Roadmap and Repository Structure

## Target repository structure

```text
meridian/
├── frontend/                 # Next.js UI and component tests
├── backend/
│   ├── src/                  # routes, controllers, services, middleware, utils
│   ├── prisma/schema.prisma
│   └── tests/                # unit and API tests
├── docs/
│   ├── context/              # current project documentation
│   └── adr/                  # durable architectural decisions
├── docker-compose.yml
├── Jenkinsfile
├── Caddyfile
├── .env.example
├── CONTEXT.md
└── README.md
```

## Reproducible seed-data specification

Normal seed สร้างแบบ idempotent RM 2 คนกับ Client รวม 30 คน แต่ละ Client มี Financial Profile และอย่างน้อยหนึ่ง Goal ที่ valid, `startDate` และ `targetDate`; มี family relationships ภายใน RM เดียวกัน และห้าม seed cross-RM relationship ที่จะแสดงผล ห้าม reset database ใน deployment

ข้อมูลต้องครอบคลุมอย่างน้อยหนึ่ง Client สำหรับ NBA/priority ทุกแบบ: `Review Emergency Fund` HIGH, `Review Debt Position` HIGH, `Review Goal Funding` MEDIUM, `Schedule Financial Health Review` MEDIUM และ `Routine Financial Review` LOW Seed ใช้ fixed IDs/customer codes และ deterministic dates/amounts; การแสดง demo ที่อิง current day ต้องสร้าง relative date จากวัน seed ที่บันทึกหรือ mock UTC date ใน test Fixtures แยกต่างหากใช้สำหรับ `Review Client Data`, incomplete data และ cross-RM family visibility จึงไม่ทำให้ข้อกำหนด normal seed ขัดกัน

## Development roadmap

### Milestone 1 — Foundation, schema and test environment

**Prerequisites:** approved context/ADR. **Deliverables:** monorepo, TypeScript, lint, Compose PostgreSQL, Prisma schema, test database, `.env.example`, Caddy skeleton and `/health`. **Covers:** NFR-04, NFR-09, NFR-10. **Exit:** clean install/lint, migration applies to test database and health distinguishes dependency readiness.

### Milestone 2 — Financial rules and boundaries

**Prerequisites:** Milestone 1 schema/test harness. **Deliverables:** pure Health, Goal, Priority, NBA and Summary services with boundary fixtures. **Covers:** FR-07–10, FR-12, NFR-05, NFR-07, BR-01–08. **Exit:** all table boundaries, exact start date, missing data and NBA precedence tests pass without NaN/Infinity.

### Milestone 3 — Seed, authentication and Client APIs

**Prerequisites:** Milestones 1–2. **Deliverables:** idempotent normal seed, separate fixtures, RM ownership middleware, session/origin/limiter and Client List/Profile snapshot endpoints. **Covers:** FR-01–04, FR-06, BR-09–10, NFR-01, NFR-10. **Exit:** 2 RM/30 Client normal seed, ownership/search/filter/pagination and API-contract tests pass.

### Milestone 4 — Dashboard, Profile and Family views

**Prerequisites:** Milestone 3 APIs. **Deliverables:** Login, Client List, Morning Action Plan, Profile snapshot, Health/NBA/Summary components and one-hop Family Graph. **Covers:** FR-05, FR-06, FR-11, US-01–09, NFR-06. **Exit:** UI tests prove loading, empty, incomplete-data and cross-RM graph behavior.

### Milestone 5 — Integration, ownership and acceptance verification

**Prerequisites:** Milestones 2–4. **Deliverables:** end-to-end API/component integration, acceptance fixtures and traceability evidence. **Covers:** FR-01–12, NFR-01–10, US-01–16. **Exit:** requirements matrix has test evidence and Profile snapshot has a single consistent evaluation.

### Milestone 6 — DevSecOps and deployment verification

**Prerequisites:** Milestones 1–5 and Ubuntu baseline. **Deliverables:** Dockerfiles, Jenkins controller/agent configuration, verified webhooks, pipeline, SHA tags, Trivy gate and Caddy deployment verification. **Covers:** FR-13–25, NFR-02, NFR-03, NFR-08. **Exit:** PR never deploys; successful main, test failure, Trivy failure, migration failure and health failure evidence exists.

### Milestone 7 — Presentation documentation and demo evidence

**Prerequisites:** Milestone 6. **Deliverables:** screenshots, measurement log, README, GitHub Pages documentation, final report and presentation. **Covers:** project success criteria. **Exit:** every claim identifies its commit, environment and evidence; measured results remain distinct from requirements.

## Delivery checklist

- เอกสารใน [README](README.md) ถูกตรวจ links/anchors และสอดคล้องกับ schema/API
- ไม่มี real secrets หรือ real personal/financial data ใน repository
- `.env.example` มีชื่อ variables ครบโดยไม่มีค่าลับ
- seed data และ test suite รันซ้ำได้
- demo ระบุ commit SHA และแสดง successful/test-fail/security-fail/health-fail evidence แยกจากแผนทดสอบ
