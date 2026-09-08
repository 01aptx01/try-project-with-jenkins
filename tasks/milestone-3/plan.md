# Meridian Milestone 3 Implementation Plan: Seed, Authentication และ Client APIs

## 1. Overview และขอบเขต

Milestone 3 เป็นการสร้างระบบข้อมูลตั้งต้น (Seed), ระบบยืนยันตัวตน (Authentication & Authorization) และชุด Client APIs ทั้งหมดสำหรับ Relationship Manager (RM) บนพื้นฐาน Express, Prisma ORM, Zod validation และ Pure domain functions ที่ส่งมอบจาก Milestone 2 (commit `b632b03`)

### ขอบเขตที่รับผิดชอบใน M3:
- **Seed Data:** ชุดข้อมูลทดสอบ deterministic 2 RMs / 30 Clients ที่รันแบบ idempotent พร้อม anomaly fixtures แยกเฉพาะ integration test
- **Authentication & Security:** ระบบ Login/Logout, Session cookie (`meridian_session`), JWT verification, Exact Origin protection, IP-based login rate limiting, และ RM identity middleware
- **Client & Dashboard APIs:** 
  - Profile snapshot (`GET /api/clients/:id`)
  - Client List พร้อม In-memory Search, Derived Filters และ Pagination (`GET /api/clients`)
  - Morning Action Plan (`GET /api/dashboard/morning-action-plan`)
  - Sub-endpoints (`/health`, `/recommendations`, `/summary`)
  - One-hop Family Graph กรองตามสิทธิ์ RM (`GET /api/clients/:id/family`)
- **Integration & Verification:** Local verification ผ่าน Caddy reverse proxy, Test database harness และ Acceptance matrix

### ขอบเขตที่อยู่นอก M3:
- Product UI และ Client Components (ส่งมอบใน Milestone 4)
- Jenkins Pipeline, Docker container build, Trivy security gate, Ubuntu VM deployment และ Production TLS (ส่งมอบใน Milestone 6)

---

## 2. Shared Contracts & Architecture Decisions

1. **Pure Domain Reuse:** ใช้ domain functions จาก M2 (`evaluateClient`, `calculateHealthResult`, `determineRecommendation`, `generateClientSummary`, `compareClientsByPriority`) โดยตรง ไม่เขียนสูตรการเงินหรือ business logic ซ้ำใน controllers หรือ services
2. **Dependencies & Lockfile:** เพิ่ม `bcrypt` (และ `@types/bcrypt`), `jsonwebtoken` (และ `@types/jsonwebtoken`), `cookie-parser` (และ `@types/cookie-parser`), `express-rate-limit` ใน `@meridian/api` โดยรักษา single root `package-lock.json`
3. **Password Hashing:** ใช้ asynchronous `bcrypt` ด้วย cost factor 12 ไม่ trim password และตรวจสอบความยาว UTF-8 ไม่เกิน 72 bytes เพื่อป้องกัน bcrypt silent truncation
4. **JWT Contract:**
   - Algorithm: `HS256` เท่านั้น (ปฏิเสธ `none` หรือ asymmetric algorithms)
   - Payload claims: `sub` เป็น User UUID, `iss: "meridian-api"`, `aud: "meridian-web"`
   - Expiration: 3,600 วินาที (1 ชั่วโมง)
   - Verification: ตรวจสอบทั้ง signature, algorithm whitelist, standard claims และ expiration ผ่าน `jwt.verify`
5. **Session Cookie (`meridian_session`):**
   - Flags: `HttpOnly: true`, `SameSite: "Lax"`, `Path: "/"`, `maxAge: 3600 * 1000` (1 ชั่วโมง)
   - `Secure`: เปิดใช้งานเมื่อ `NODE_ENV === "production"`; ปิดใน local HTTP development
   - Clear options: ใช้ path/domain/samesite เดียวกันทุกประการตอน logout
6. **Origin Protection:** ตรวจสอบ Header `Origin` แบบ exact match กับ `APP_ORIGIN` บนทุกคำขอที่เป็น `POST` (รวม `/api/auth/login` และ `/api/auth/logout`); หาก missing, `null` หรือไม่ตรง คืนสถานะ `403 Forbidden` ทันที
7. **Login Rate Limiter:** จำกัด 5 คำขอต่อ 60 วินาทีต่อ IP address บนเส้นทาง `/api/auth/login` ตรวจสอบ Origin ก่อน limiter; คำขอที่เกินส่งคืน `429 Too Many Requests` พร้อม Header `Retry-After` และโครงสร้าง error มาตรฐาน
8. **RM Ownership & Authorization Context:**
   - Routes ที่ต้องการสิทธิ์ (`/api/auth/me`, `/api/clients/*`, `/api/dashboard/*`) ต้องผ่าน middleware ตรวจสอบ session และยืนยันว่า User ยังมีอยู่จริงในฐานข้อมูลและมี role เป็น `RM`
   - RM identity ดึงจาก session token เท่านั้น ห้ามรับหรือเชื่อถือ RM ID จาก request body หรือ query parameters
   - การเข้าถึง Client ที่ตนเองไม่ได้เป็นเจ้าของ คืน `404 Not Found` (เช่นเดียวกับ Client ที่ไม่มีอยู่จริง) เพื่อป้องกัน resource enumeration
9. **Single UTC Clock Injection:** ทุกคำขอประเมินผลการเงินด้วยวัน UTC เพียงวันเดียวจาก clock service ที่ inject ได้ (`asOfDate`); ไม่มี query parameter เปิดให้ภายนอกระบุวันเอง
10. **Data Serialization & Privacy:**
    - คืน JSON ในรูปแบบ camelCase, จำนวนเงินเป็น decimal string สองตำแหน่ง (เช่น `"1000.00"`), วันที่ Goal เป็น `YYYY-MM-DD`, ค่าว่างเป็น `null` อย่างชัดเจน
    - Headers สำหรับ auth, client, dashboard responses รวม error responses ต้องมี `Cache-Control: no-store`
    - ไม่ส่ง password hash, raw token, BigInt หรือ Prisma internal metadata ออกไปยัง client

---

## 3. Dependency Flow

```text
M3-001 (Prerequisites & Contracts)
  │
  ├──→ M3-002 (HTTP Validation & Errors)
  │      │
  │      ├──→ M3-003 (Password & Session Services) ──┐
  │      │      │                                    │
  │      │      └──→ M3-005 (Login/Logout API) ←─┐   │
  │      │                                       │   │
  │      └──→ M3-004 (Origin & Rate Limiter) ────┘   │
  │                                                  │
  │                                     M3-006 (RM Session & /auth/me)
  │                                                  │
  ├──→ M3-007 (Seed Dataset Design)                  │
  │      │                                           │
  │      └──→ M3-008 (Idempotent Seed Runner) ←──────┘ (depends on M3-003)
  │             │
  │             └──→ M3-009 (Integration Harness & Fixtures)
  │                    │
  │                    ├──→ M3-010 (Profile Snapshot & Ownership)
  │                    │      │
  │                    │      ├──→ M3-011 (Client List & In-Memory Search)
  │                    │      │      │
  │                    │      │      └──→ M3-012 (Derived Filters & Pagination)
  │                    │      │             │
  │                    │      │             └──→ M3-013 (Morning Action Plan)
  │                    │      │
  │                    │      ├──→ M3-014 (Health, Recommendation, Summary Endpoints)
  │                    │      │
  │                    │      └──→ M3-015 (Family Graph API)
  │                    │
  │                    └─────────────────────────────┐
  │                                                  ▼
  └──────────────────────────────────────────────→ M3-016 (Caddy Local Integration)
                                                     │
                                                     ▼
                                                   M3-017 (M3 Acceptance Matrix)
                                                     │
                                                     ▼
                                                   M3-018 (Clean Checkout & M4 Handover)
```

---

## 4. Checkpoints & Verification Gates

- **Checkpoint A (หลัง M3-001–003):** Baseline ผ่าน, types และ wire contracts พร้อม, password hashing และ JWT token signing/verification ผ่าน unit tests 100% โดยไม่ต้องเปิด HTTP server
- **Checkpoint B (หลัง M3-004–006):** Origin check, Rate limiter, Login flow (`POST /api/auth/login` → cookie), Session verification, `GET /api/auth/me`, และ Logout (`POST /api/auth/logout`) ทำงานครบวงจรผ่าน Supertest
- **Checkpoint C (หลัง M3-007–009):** Seed 2 RMs / 30 Clients รันซ้ำได้โดยไม่สร้าง record ซ้ำและ rollback ได้เมื่อชน; Anomaly fixtures พร้อมบน isolated test database
- **Checkpoint D (หลัง M3-010–012):** Profile snapshot และ Client List เชื่อมต่อฐานข้อมูลจริงพร้อมการกรอง ownership; Search, Filter, Sort และ Pagination ทำงานสอดคล้องกันและเรียงลำดับถูกต้อง
- **Checkpoint E (หลัง M3-013–015):** Morning Action Plan, Sub-endpoints (`/health`, `/recommendations`, `/summary`), และ Family Graph API คืนผลสอดคล้องกับ Profile และไม่รั่วไหลข้อมูลข้าม RM
- **Checkpoint F (หลัง M3-016–018):** End-to-end smoke ผ่าน Caddy reverse proxy, Acceptance matrix ครบทุกข้อกำหนด และเอกสาร README / Task records พร้อมสำหรับส่งมอบต่อ Milestone 4

---

## 5. Risks and Mitigations

| ความเสี่ยง (Risk) | ผลกระทบ | แนวทางป้องกันและแก้ไข (Mitigation) |
|---|---|---|
| Bcrypt 72-byte truncation silently ignores excess bytes | High | ตรวจสอบ `Buffer.byteLength(password, 'utf8') <= 72` ใน validation schema ก่อนส่งเข้า bcrypt |
| Reverse proxy IP spoofing ทำให้ Rate Limiter นับ IP รวมหรือ bypass | High | ไม่ใช้ `trust proxy: true` แบบ global; ระบุเฉพาะ IP/subnet ของ Caddy ที่เชื่อถือได้ พร้อมทดสอบ spoofed header |
| N+1 queries เมื่อประเมิน Health/Priority สำหรับ Client List 30 คน | Medium | โหลด Client, FinancialProfile, Goals ทั้งหมดของ RM ด้วย batch query เดียว แล้วประเมินผลในหน่วยความจำ |
| ความแตกต่างของ Collation และ Case ใน Database Search | Low | โหลด records ของ RM ใน batch แล้วทำ case-insensitive Unicode NFC search ในหน่วยความจำ |
| Timezone drifting ทำให้ `asOfDate` ไม่ตรงกันข้ามรอบประเมิน | Medium | ใช้ UTC clock service เดียวที่ inject ได้ต่อ request เพื่อให้ timestamp คงที่ตลอด request lifecycle |

---

## 6. Navigation & Tracking

- Task checklist: [todo.md](todo.md)
- Milestone 1 plan: [tasks/milestone-1/plan.md](../milestone-1/plan.md)
- Milestone 1 tickets: [tasks/milestone-1/todo.md](../milestone-1/todo.md)
- Milestone 2 plan: [tasks/milestone-2/plan.md](../milestone-2/plan.md)
- Milestone 2 tickets: [tasks/milestone-2/todo.md](../milestone-2/todo.md)
- Requirements: [docs/context/03-requirements.md](../../docs/context/03-requirements.md)
- API Architecture: [docs/context/05-architecture-and-data.md](../../docs/context/05-architecture-and-data.md)
