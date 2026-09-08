# Meridian Milestone 3 Tickets

Status values: `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`. A ticket is only `DONE` when its listed verification has passing evidence.

---

## M3-001 — ตรวจ prerequisite และกำหนด API contracts

**Status:** DONE

**Description:**
ตรวจ baseline หลังแก้ audit จาก commit `b632b03` และจัดทำ types/examples ที่ endpoints ใช้ร่วมกัน เพื่อเป็น contract ตั้งต้นสำหรับทุก endpoints ใน Milestone 3

**Acceptance criteria:**
- [x] บันทึก commit, Git status และผลตรวจ M1–M2 โดยเฉพาะ JSON serialization, Goal rounding, Summary และ readiness; regression ที่พบต้องแก้ในงาน prerequisite ก่อนเริ่ม ticket ที่พึ่งพา
- [x] กำหนด response types ครบทุก endpoint รวม `ClientCard`, Profile snapshot, Sub-endpoints และ Family Graph; ปรับเอกสาร Dashboard ให้รองรับ pagination ตามข้อตกลง (`{items, page, pageSize, total, asOfDate}`)
- [x] ตัวอย่าง success/error มี fields ครบและค่าที่สอดคล้องกัน ไม่ใช้ตัวอย่างย่อเป็น response contract
- [x] รายละเอียด types: `ClientCard` ใช้ `id`, `customerCode`, `displayName`, `riskLevel`, `health`, `recommendation`; Profile เพิ่ม personal fields ได้แก่ `firstName`, `lastName`, `age`, `occupation` โดยสองรายการหลัง nullable และไม่ส่งข้อมูล User/credentials ที่ไม่จำเป็น

**Verification:**
- [x] Baseline unit tests, lint, typecheck และ build ผ่านทั้งหมด:
  - Commit baseline: `b632b0345598dbc43b5d9294023f74bda70ea9dc`, follow-up docs commit `b8605a3`.
  - `npm run lint`: 0 errors across `@meridian/api` and `@meridian/web`.
  - `npm run typecheck`: 0 TypeScript compiler errors across workspaces.
  - `npm run test:unit`: 16 test files, 120 tests passed (119 in `@meridian/api`, 1 in `@meridian/web`).
  - `npm run build`: both `@meridian/api` (TypeScript) and `@meridian/web` (Next.js Turbopack) built cleanly.
- [x] Contract types และ Zod schemas ใน `backend/src/contracts/api.ts` compile ผ่านและมี unit tests รองรับ (`backend/tests/unit/contracts/api-contracts.test.ts` 12 tests passed).
- [x] ตัวอย่าง payload และ contract specification ใน `docs/context/05-architecture-and-data.md` ได้รับการอัปเดตตรงกับ response types ครบทุก fields รวมถึง pagination ของ Morning Action Plan และ full Profile snapshot.

**Dependencies:** ไม่มี  
**Files likely touched:**
- `backend/src/contracts/api.ts`
- `backend/tests/unit/contracts/api-contracts.test.ts`
- `docs/context/05-architecture-and-data.md`
- `tasks/milestone-3/todo.md`  
**Scope:** M

---

## M3-002 — เตรียม HTTP validation และ error handling

**Status:** DONE

**Description:**
เพิ่ม request parsing, security headers, configuration loader และ error handling middleware ที่รองรับ auth และ Client APIs

**Acceptance criteria:**
- [x] กำหนด JSON body limit 16 KiB; malformed JSON/invalid schema คืน `400 Bad Request`, body เกิน limit คืน `413 Payload Too Large`, login ที่ไม่ใช้ `application/json` คืน `415 Unsupported Media Type`; ทุก error ใช้ common error envelope `{error: {code, message, details?}}` เดิมทั้งหมด
- [x] ตรวจ `APP_ORIGIN`, `JWT_SECRET`, environment mode และ proxy configuration ตอนเริ่ม process; production ต้องใช้ HTTPS origin ไม่มี secret default และไม่แสดงค่าลับเมื่อ configuration ผิด
- [x] `JWT_SECRET` ใช้ base64 ของ random bytes อย่างน้อย 32 bytes พร้อมระบุคำสั่งสร้างด้วย Node crypto (`node -e "console.log(crypto.randomBytes(32).toString('base64'))"`); validation ตรวจสอบรูปแบบ base64 และจำนวน bytes
- [x] แยก dependency failure `503 Service Unavailable` จาก programming/query/schema failure `500 Internal Server Error`; logs บันทึกเฉพาะ request ID, route template, status และ safe error code (ห้ามบันทึก stack trace หรือ credentials)

**Verification:**
- [x] Supertest suite สำหรับ body parsing, size limits, content types และ error status code (`400`, `413`, `415`, `500`, `503`): ผ่านครบ 8 tests ใน `backend/tests/unit/middleware/error-handler.test.ts`.
- [x] Environment validation tests ตรวจสอบ rejection เมื่อ `JWT_SECRET` สั้นเกิน 32 bytes, format ผิด, production non-HTTPS origin, หรือ default secret: ผ่านครบ 7 tests ใน `backend/tests/unit/env.test.ts`.
- [x] Log-redaction assertions ตรวจสอบว่าไม่มี secret หรือ sensitive payload หลุดออกทาง console โดย log บันทึกเฉพาะ safe request ID, route path, status 500, และ error code name.
- [x] ทั้งหมด 133 unit tests ผ่าน 100%, lint 0 errors, typecheck 0 errors, build clean.

**Dependencies:** M3-001  
**Files likely touched:**
- `backend/src/config/env.ts`
- `backend/src/errors.ts`
- `backend/src/middleware/error-handler.ts`
- `backend/src/middleware/request-parser.ts`
- `backend/src/app.ts`
- `backend/tests/unit/env.test.ts`
- `backend/tests/unit/middleware/error-handler.test.ts`
- `.env`
- `.env.example`
- `tasks/milestone-3/todo.md`  
**Scope:** M

---

## M3-003 — สร้าง password และ session services

**Status:** DONE

**Description:**
สร้างบริการสำหรับการ hash/verify password และการ sign/verify JWT session token โดยแยกเป็น domain/service layer ที่ทดสอบได้โดยไม่ต้องเปิด HTTP server

**Acceptance criteria:**
- [x] ใช้ asynchronous `bcrypt` cost factor 12; ไม่ trim password และตรวจสอบความยาว UTF-8 ไม่เกิน 72 bytes (`Buffer.byteLength(password, 'utf8') <= 72`) เพื่อป้องกัน silent truncation ตาม bcrypt documentation
- [x] JWT verification จำกัด algorithm `HS256` เท่านั้น และตรวจ standard claims (`sub` User UUID, `iss: "meridian-api"`, `aud: "meridian-web"`, `exp: 3600s`); กรณี expired, malformed, wrong-signature, wrong-algorithm หรือ missing required claims คืน invalid session
- [x] Cookie options (`meridian_session`) อยู่จุดเดียว (single source of truth) ใช้ร่วมกันตอน issue และ clear cookie (`HttpOnly: true`, `SameSite: "Lax"`, `Path: "/"`, `maxAge: 3600 * 1000`; `Secure` เฉพาะ production); ไม่มี refresh token หรือ server-side revocation mechanism ใน milestone นี้

**Verification:**
- [x] Password service unit tests: ผ่านครบ 6 tests ใน `backend/tests/unit/services/password.service.test.ts` ครอบคลุม hash format `$2b$12$`, successful verification, wrong password rejection, non-trimming, Unicode support (รหัสผ่านภาษาไทย), byte length rejection (> 72 bytes), และ dummyVerifyPassword
- [x] Session service unit tests: ผ่านครบ 9 tests ใน `backend/tests/unit/services/token.service.test.ts` ครอบคลุม token generation, standard claims, algorithm whitelist enforcement (`HS256` only), clock injection สำหรับ expiry boundary ที่ 3,600 วินาที, wrong secret, signature tampering rejection, และ cookie options matching (set/clear)
- [x] รวม 148 unit tests ผ่าน 100%, lint 0 errors, typecheck 0 errors, build clean.

**Dependencies:** M3-002  
**Files likely touched:**
- `backend/src/services/password.service.ts`
- `backend/src/services/token.service.ts`
- `backend/src/config/cookie.ts`
- `backend/tests/unit/services/password.service.test.ts`
- `backend/tests/unit/services/token.service.test.ts`
- `backend/package.json`
- `package-lock.json`
- `tasks/milestone-3/todo.md`  
**Scope:** M

---

## Checkpoint A — Baseline & Auth Primitives
- [x] Prerequisite baseline ผ่านทุกการทดสอบ (lint, typecheck, unit, build)
- [x] Shared contracts และ schemas พร้อมใช้งาน
- [x] Password hashing (bcrypt cost 12, max 72 bytes) และ JWT session verification ผ่าน unit tests 100% โดยไม่ต้องพึ่ง HTTP server

---

## M3-004 — เพิ่ม Origin protection และ login limiter

**Status:** DONE

**Description:**
ป้องกัน POST requests ด้วย Origin header check และจำกัดจำนวน login attempts ด้วย IP rate limiting ก่อนเข้าสู่การคำนวณ bcrypt หรือ query ฐานข้อมูล

**Acceptance criteria:**
- [x] ตรวจสอบ Origin Header แบบ exact match กับ `APP_ORIGIN` บนทุกคำขอที่เป็น POST; หาก Origin missing, `null` หรือไม่ตรง คืน `403 Forbidden` ทันที ก่อนอ่าน credentials หรือนับ rate limit
- [x] Login ทุก request ที่ผ่าน Origin check นับใน rate limit 5 ครั้งต่อ 60 วินาทีต่อ IP; ครั้งที่ 6 คืน `429 Too Many Requests` พร้อม Header `Retry-After` และ common error envelope
- [x] Memory store แยกต่อ application instance สำหรับ isolated unit/integration tests; trust proxy เริ่มต้นไม่เชื่อถือ (false) และเปิดเฉพาะ IP/CIDR ที่ระบุของ Caddy (ไม่ใช้ `trust proxy: true` แบบ global)
- [x] จัดการ IP key ตาม `express-rate-limit` รวม IPv6; ไม่ parse `X-Forwarded-For` ด้วยตนเอง

**Verification:**
- [x] Middleware tests ครอบคลุม Origin check matrix: matching origin, mismatched origin, missing origin, null origin ใน `backend/tests/unit/middleware/origin-and-limiter.test.ts`
- [x] Rate limiter tests: requests 1–5 ผ่าน, request 6 คืน 429 พร้อม header `Retry-After` และ standard error envelope; origin failure บล็อกคำขอเป็น 403 ก่อนเข้าถึง limiter counter
- [x] Proxy spoofing tests: ปลอม `X-Forwarded-For` จาก untrusted peer ไม่ทำให้ bypass rate limit ได้เนื่องจาก Express ใช้ socket remoteAddress โดยตรงเมื่อ trust proxy เป็น false
- [x] รวม 156 unit tests ผ่าน 100%, lint 0 errors, typecheck 0 errors, build clean.

**Dependencies:** M3-002  
**Files likely touched:**
- `backend/src/middleware/origin-guard.ts`
- `backend/src/middleware/rate-limiter.ts`
- `backend/src/app.ts`
- `backend/tests/unit/middleware/origin-and-limiter.test.ts`
- `tasks/milestone-3/todo.md`  
**Scope:** M

---

## M3-005 — เปิด Login และ Logout API

**Status:** DONE

**Description:**
สร้างเส้นทาง HTTP สำหรับเข้าสู่ระบบ (`POST /api/auth/login`) และออกจากระบบ (`POST /api/auth/logout`) เชื่อมต่อ User repository และ session service

**Acceptance criteria:**
- [x] Login รับ payload strict `{email, password}`; normalize email ด้วย trim และ lowercase; กรณี email ไม่พบ หรือ password ไม่ถูกต้อง คืน `401 Unauthorized` ด้วยข้อความเดียวกัน พร้อมรัน dummy bcrypt comparison เสมอเพื่อป้องกัน timing attack
- [x] Login สำเร็จคืน `200 OK` พร้อม `{user: {id, name, role}}` และตั้ง cookie `meridian_session`; ห้ามส่ง JWT token, password hash หรือ Prisma internal fields ใน body หรือ logs
- [x] Logout รับคำขอ POST ตรวจสอบ Origin แล้วคืน `204 No Content` พร้อมล้าง cookie `meridian_session` ด้วย attributes เดียวกัน แม้ไม่มี session หรือ token หมดอายุแล้ว; token เดิมที่คัดลอกไว้ยังใช้ได้จนหมดอายุตามข้อตกลง stateless JWT

**Verification:**
- [x] Supertest flow สำหรับ login สำเร็จ: ตรวจ `Set-Cookie` headers (`meridian_session`, `HttpOnly`, `Path=/`, `SameSite=Lax`), status 200, และ payload format `{user:{id,name,role}}` โดยไม่มี token/hash ใน body ใน `backend/tests/integration/api/auth-login-logout.test.ts`
- [x] Supertest สำหรับ invalid login: ทดสอบ wrong email, wrong password, timing dummy comparison, non-RM role rejection, malformed JSON, และ extra schema fields (คืน 400 จาก Zod validation)
- [x] Supertest สำหรับ logout: cookie removal attributes (`Max-Age=0` / expired 1970 date, `Path=/`, `SameSite=Lax`, `HttpOnly`), คืน 204 No Content, และทดสอบการ logout ซ้ำแบบ idempotent
- [x] Database unavailable error handling: คืน 503 `DEPENDENCY_UNAVAILABLE` เมื่อ user repository ขัดข้อง
- [x] รวม 165 tests (unit + integration) ผ่าน 100%, lint 0 errors, typecheck 0 errors, build clean.

**Dependencies:** M3-003, M3-004  
**Files likely touched:**
- `backend/src/routes/auth.routes.ts`
- `backend/src/controllers/auth.controller.ts`
- `backend/src/repositories/user.repository.ts`
- `backend/src/services/auth.service.ts`
- `backend/src/middleware/error-handler.ts`
- `backend/tests/integration/api/auth-login-logout.test.ts`
- `tasks/milestone-3/todo.md`  
**Scope:** M

---

## M3-006 — ยืนยัน RM session และเปิด `/auth/me`

**Status:** DONE

**Description:**
สร้าง authenticated request context middleware และ guard สำหรับ Client/Dashboard endpoints พร้อมเปิดเส้นทาง `GET /api/auth/me`

**Acceptance criteria:**
- [x] Middleware ตรวจสอบ session cookie, verify JWT token และ query User จากฐานข้อมูล; หาก missing cookie, invalid token, หรือ User ถูกลบ/ไม่มีอยู่จริง คืน `401 Unauthorized`
- [x] ตรวจสอบว่า User ที่ล็อกอินมี role เป็น `RM`; หากไม่ใช่ role `RM` ปฏิเสธคำขอด้วย `401 Unauthorized` (เมื่อ role ไม่ใช่ RM)
- [x] เปิดเส้นทาง `GET /api/auth/me` คืนเฉพาะ `{id, name, role}`; authenticated context ส่งต่อ RM identity สู่ routes ถัดไปอย่างปลอดภัย โดยไม่เชื่อถือ RM ID จาก client input
- [x] เส้นทาง login, logout, `/health` ยังคงเป็น public; error จากฐานข้อมูลขณะตรวจ User คืน `503` และ response ทุกเส้นทางมี header `Cache-Control: no-store`

**Verification:**
- [x] Supertest session matrix: valid session, missing session, expired token, signature mismatch, deleted user
- [x] Role verification tests: non-RM role rejection (คืน 401 Unauthorized พร้อม message ชัดเจน)
- [x] Verification tests ยืนยันว่า public routes (`/health`, `/api/auth/login`, `/api/auth/logout`) ไม่ถูก block
- [x] Header checks ยืนยัน `Cache-Control: no-store` บน authenticated responses
- [x] Full end-to-end integration test ครอบคลุม login -> cookie -> /auth/me -> logout -> /auth/me rejection ใน `backend/tests/integration/api/auth-me.test.ts`
- [x] รวม 177 tests ผ่าน 100%, lint 0 errors, typecheck 0 errors, build clean.

**Dependencies:** M3-003, M3-005  
**Files likely touched:**
- `backend/src/middleware/auth-guard.ts`
- `backend/src/routes/auth.routes.ts`
- `backend/src/controllers/auth.controller.ts`
- `backend/src/app.ts`
- `backend/src/types/express.d.ts`
- `backend/tests/integration/api/auth-me.test.ts`
- `tasks/milestone-3/todo.md`  
**Scope:** M

---

## Checkpoint B — Authentication & Session Context
- [x] Exact Origin protection และ Login rate limiter (5 req / 60s) ป้องกัน routes ได้อย่างรัดกุม
- [x] End-to-end login flow ผ่าน Supertest: login → cookie → `/auth/me` → logout
- [x] Auth guard แนบ RM identity เข้า request context ได้อย่างถูกต้องและปฏิเสธคำขอที่ไม่ได้รับอนุญาต

---

## M3-007 — ออกแบบ normal seed dataset

**Status:** DONE

**Description:**
สร้าง deterministic seed catalogue และ validation schema สำหรับชุดข้อมูลปกติ 2 RMs / 30 Clients ก่อนบันทึกลงฐานข้อมูลจริง

**Acceptance criteria:**
- [x] มีข้อมูล RM 2 คน แต่ละคนดูแล Client 15 คน (รวม 30 คน); ทุก record ใช้ fixed UUID และ customer code (`C-001` ถึง `C-030`) มี Financial Profile ครบถ้วน และมี Goal ที่ valid อย่างน้อย 1 รายการต่อคน
- [x] กำหนดค่า `--as-of YYYY-MM-DD` เป็น mandatory parameter; วันที่และจำนวนเงินเป็น relative date เทียบกับ `asOfDate` เพื่อให้ข้อมูล deterministic โดยไม่ใช้ randomness สำหรับข้อมูลธุรกิจ
- [x] ข้อมูลครอบคลุมกรณีทดสอบ NBA ครบทั้ง 5 แบบ และ Priority ครบทั้ง 3 ระดับ:
  - `Review Emergency Fund` (HIGH)
  - `Review Debt Position` (HIGH)
  - `Review Goal Funding` (MEDIUM)
  - `Schedule Financial Health Review` (MEDIUM)
  - `Routine Financial Review` (LOW)
- [x] ข้อมูลความสัมพันธ์ Family อยู่ภายใน RM เดียวกัน ครอบคลุมทั้ง 4 ประเภท (`PARENT`, `CHILD`, `SPOUSE`, `SIBLING`); มี canonical ordering และตัวตรวจความถูกต้องป้องกัน self-relation, duplicate pair หรือ conflicting relation

**Verification:**
- [x] Catalogue unit tests: ตรวจสอบจำนวน record (2 RMs, 30 Clients, 30 Profiles, >=30 Goals, Family relations 12 records) ใน `backend/tests/unit/seed/catalogue.test.ts`
- [x] Deterministic NBA check: รัน pure evaluation กับ catalogue ข้อมูลด้วยวันคงที่ ยืนยันว่าได้ผลลัพธ์ NBA ครบ 5 แบบและ Priority ครบ 3 ระดับตามที่คาดหมายล่วงหน้า และให้ผลลัพธ์สอดคล้องกันทุก asOfDate
- [x] Intra-RM verification: ทุก family relation เชื่อมต่อ client ภายใน RM เดียวกัน และทดสอบว่า validation ปฏิเสธ cross-RM relation อย่างถูกต้อง
- [x] รวม 164 unit tests ผ่าน 100%, lint 0 errors, typecheck 0 errors, build clean.

**Dependencies:** M3-001  
**Files likely touched:**
- `backend/src/seed/catalogue.ts`
- `backend/src/seed/types.ts`
- `backend/src/seed/validator.ts`
- `backend/tests/unit/seed/catalogue.test.ts`
- `tasks/milestone-3/todo.md`  
**Scope:** M

---

## M3-008 — Persist seed แบบ idempotent

**Status:** DONE

**Description:**
สร้าง script และ runner สำหรับ persist seed catalogue ลงฐานข้อมูลผ่าน Prisma แบบ idempotent โดยใช้ transaction

**Acceptance criteria:**
- [x] รันผ่านคำสั่ง `npm run db:seed -- --as-of YYYY-MM-DD` โดยใช้ fixed IDs ในการ upsert ภายใต้ database transaction; รันซ้ำแล้วไม่เพิ่มจำนวน record และไม่ reset database
- [x] รับรหัสผ่านของ RM ทั้ง 2 คนจาก environment variables (`SEED_RM1_PASSWORD`, `SEED_RM2_PASSWORD`) โดยไม่มี secret บันทึกใน git repository; ใช้ password hash เดิมเมื่อรหัสผ่านไม่เปลี่ยนแปลง และไม่พิมพ์ credentials ออกทาง terminal/logs
- [x] จัดการเฉพาะ records ที่กำหนดใน catalogue; หากเกิด collision กับ unrelated data ต้อง abort transaction และ rollback ทันที พร้อมบันทึกสรุป counts และ reference date โดยไม่เปิดเผยข้อมูลลับ
- [x] Seed ไม่ถูกรันอัตโนมัติในขั้นตอน application startup หรือ deployment

**Verification:**
- [x] Integration test บน test database: รัน seed ครั้งที่ 1 บันทึก counts, รัน seed ครั้งที่ 2 ตรวจสอบ counts เท่าเดิม ไม่เกิด duplicated rows ใน `backend/tests/integration/seed/seed.test.ts`
- [x] Transaction rollback test: จำลอง collision หรือ database constraint error ยืนยันว่าไม่มี partial data หลงเหลือ
- [x] ตรวจสอบความถูกต้องของ password hash ในฐานข้อมูลและทดสอบ authentication ผ่าน credentials ของ seed RMs
- [x] ทดสอบ CLI script `npm run db:seed -- --as-of 2026-09-08` ทำงานแบบ idempotent บน local database สำเร็จ
- [x] รวม 25 integration tests และ 164 unit tests ผ่าน 100%, lint 0 errors, typecheck 0 errors, build clean.

**Dependencies:** M3-003, M3-007  
**Files likely touched:**
- `backend/src/seed/runner.ts`
- `backend/src/seed/seed.ts`
- `backend/src/seed/catalogue.ts`
- `backend/package.json`
- `package.json`
- `backend/tests/integration/seed/seed.test.ts`
- `tasks/milestone-3/todo.md`  
**Scope:** M

---

## M3-009 — สร้าง fixtures และ API integration harness

**Status:** DONE

**Description:**
เตรียม anomaly test fixtures และ test harness สำหรับการทดสอบ integration API ที่แยกขาดจาก normal seed dataset

**Acceptance criteria:**
- [x] สร้าง fixture factories สำหรับเคสผิดปกติ: missing profile, missing fields, zero denominators, ไม่มี goal, invalid goal, และ cross-RM family relationships
- [x] มี database guard ตรวจสอบว่า target database ต้องเป็น test database (`TEST_DATABASE_URL` ที่ชี้ `meridian_test` port `5433`) เท่านั้น ป้องกันการรัน fixture หรือ cleanup บน development database
- [x] Test harness รองรับการ inject clock (UTC date) และ mock dependencies ได้ โดยใช้ Prisma client เชื่อมต่อ PostgreSQL จริง และ isolate rate limiter memory state ต่อ test suite
- [x] ฟังก์ชัน cleanup จัดการเฉพาะ fixture records ที่สร้างขึ้นระหว่างทดสอบ ไม่กระทบ seed records ทั่วไป

**Verification:**
- [x] Test harness self-test: ยืนยันว่า guard บล็อกการทำงานทันทีหากชี้ไปยัง database ที่ไม่ใช่ `meridian_test` ใน `backend/tests/integration/support/harness.test.ts`
- [x] Fixture creation & cleanup verification: ตรวจสอบความสะอาดของ database ก่อนและหลังรัน suite ยืนยันว่า normal seed records 30 รายการไม่ได้รับผลกระทบ
- [x] Anomaly fixtures สามารถประเมินผลผ่าน pure evaluation และคืน `INSUFFICIENT_DATA` หรือ fallback ตามกฎของ M2
- [x] รวม 31 integration tests และ 164 unit tests ผ่าน 100%, lint 0 errors, typecheck 0 errors, build clean.

**Dependencies:** M3-006, M3-008  
**Files likely touched:**
- `backend/tests/fixtures/client.fixtures.ts`
- `backend/tests/fixtures/anomaly.fixtures.ts`
- `backend/tests/support/test-harness.ts`
- `backend/tests/support/db-guard.ts`
- `backend/tests/integration/support/harness.test.ts`
- `backend/vitest.config.ts`
- `tasks/milestone-3/todo.md`  
**Scope:** M

---

## Checkpoint C — Seed & Integration Test Harness
- [x] Normal seed 2 RMs / 30 Clients รันซ้ำได้ (idempotent) และ rollback ปลอดภัยเมื่อเกิดข้อผิดพลาด
- [x] Test harness แยกต่างหาก ป้องกันไม่ให้รันโดน production/development database
- [x] Anomaly fixtures พร้อมรองรับการทดสอบ edge cases สำหรับ API endpoints ถัดไป

---

## M3-010 — เปิด Profile snapshot พร้อม ownership

**Status:** DONE

**Description:**
พัฒนา endpoint `GET /api/clients/:id` สำหรับดึง Profile snapshot ของ Client พร้อมการตรวจสอบ ownership ของ RM

**Acceptance criteria:**
- [x] รับ Client ID ในรูปแบบ UUID; หากรูปแบบ UUID ผิด คืน `400 Bad Request`, หากไม่พบ Client หรือ Client นั้นไม่ได้เป็นของ RM ที่ล็อกอิน คืน `404 Not Found` (ข้อความเดียวกันเพื่อป้องกัน resource enumeration)
- [x] โหลดข้อมูล Client, FinancialProfile, และ Goals ของ Client ที่เป็นของ RM แล้ว map Prisma Decimal และ dates เป็น domain inputs อย่างถูกต้อง
- [x] เรียกใช้ `evaluateClient(input, asOfDate)` เพียงครั้งเดียวต่อคำขอ; คืนโครงสร้าง `{client, financialProfile, goals, primaryGoal, health, recommendation, summary, asOfDate}`
- [x] กรณีข้อมูลไม่ครบถ้วน คืน `200 OK` พร้อม `health.status = "INSUFFICIENT_DATA"` ตามกฎ BR-08; Family Graph ไม่ถูกโหลดหรือแนบใน response นี้

**Verification:**
- [x] Supertest integration tests ใน `backend/tests/integration/api/client-profile.test.ts`:
  - Valid owned client คืน status 200 พร้อม fields ครบถ้วนตาม schema
  - Malformed UUID คืน status 400
  - Non-existent client คืน status 404
  - Cross-RM client (Client ของ RM อื่น) คืน status 404 ด้วย uniform message
  - Client ที่มีข้อมูลไม่ครบ คืน status 200 พร้อม INSUFFICIENT_DATA
  - Unauthenticated request คืน status 401
- [x] Response headers ยืนยัน `Cache-Control: no-store`
- [x] รวม 37 integration tests และ 164 unit tests ผ่าน 100%, lint 0 errors, typecheck 0 errors, build clean.

**Dependencies:** M3-006, M3-009  
**Files likely touched:**
- `backend/src/routes/client.routes.ts`
- `backend/src/controllers/client.controller.ts`
- `backend/src/repositories/client.repository.ts`
- `backend/src/mappers/client.mapper.ts`
- `backend/src/contracts/api.ts`
- `backend/src/server.ts`
- `backend/tests/integration/api/client-profile.test.ts`
- `tasks/milestone-3/todo.md`  
**Scope:** M

---

## M3-011 — เปิด Client List พร้อม Search

**Status:** TODO

**Description:**
พัฒนา endpoint `GET /api/clients` สำหรับแสดงรายการ Client Cards ของ RM ที่ล็อกอิน พร้อมระบบ Text Search

**Acceptance criteria:**
- [ ] โหลดเฉพาะ Clients ที่เป็นของ RM ที่ล็อกอิน พร้อม Profile และ Goals แบบ batch query เดียว; ห้าม query ใน loop และห้ามเกิด N+1 queries
- [ ] Text search ทำงานแบบ partial match, case-insensitive บน `customerCode` และ `displayName` (`firstName + " " + lastName`); trim search input และหากเป็นค่าว่างให้ถือว่าไม่ค้นหา
- [ ] ค้นหาในหน่วยความจำ (in-memory search) ด้วย Unicode NFC normalization เพื่อความสอดคล้องของภาษาไทยและภาษาอังกฤษ
- [ ] ประเมินผล Clients ด้วยวัน UTC เดียวกัน จัดเรียงตาม Priority (HIGH → MEDIUM → LOW) แล้วตามด้วย `customerCode` แบบ ordinal และแปลงเป็น `ClientCard` (`{id, customerCode, displayName, riskLevel, health, recommendation}`)

**Verification:**
- [ ] Search tests: ค้นหาด้วยชื่อเต็ม, ชื่อบางส่วน, customer code, case ตัวพิมพ์เล็ก-ใหญ่, ข้อความภาษาไทย, และอักขระพิเศษ (`%`, `_`)
- [ ] Isolation tests: RM แต่ละคนมองเห็นเฉพาะ Clients ของตนเองเท่านั้น
- [ ] Batch query verification: ตรวจสอบจำนวน database queries ว่าคงที่ ไม่เพิ่มตามจำนวน Client

**Dependencies:** M3-010  
**Files likely touched:**
- `backend/src/services/client-list.service.ts`
- `backend/src/controllers/client.controller.ts`
- `backend/src/routes/client.routes.ts`
- `backend/tests/integration/api/client-list-search.test.ts`  
**Scope:** M

---

## M3-012 — เพิ่ม derived filters และ pagination boundaries

**Status:** TODO

**Description:**
เพิ่มการกรองตามสถานะทางการเงิน (Priority และ Health) ควบคู่กับ Text Search และการแบ่งหน้า (Pagination)

**Acceptance criteria:**
- [ ] รองรับ query parameters สำหรับ filtering: `priority` (`HIGH`, `MEDIUM`, `LOW`) และ `health` (`GOOD`, `MODERATE`, `AT_RISK`, `INSUFFICIENT_DATA`); เมื่อระบุคู่กันให้ใช้เงื่อนไขแบบ AND
- [ ] Pipeline ลำดับการประมวลผล: ownership query → batch load → in-memory search → evaluate → filter → sort → calculate total → paginate (slice `items`)
- [ ] Parameter `page` default 1, `pageSize` default 20 (max 100); ปฏิเสธค่า 0, จำนวนติดลบ, ทศนิยม, unsafe integers, duplicate query keys, หรือ invalid enums ด้วย `400 Bad Request`
- [ ] คืนโครงสร้าง `{items, page, pageSize, total}`; กรณี `page` เกินจำนวนหน้า คืน `items: []` โดยค่า `total` ยังคงถูกต้อง

**Verification:**
- [ ] Filter tests: ทดสอบ filter priority เดี่ยว, health เดี่ยว, และ combination ของทั้งสอง
- [ ] Ordering preservation test: Client ที่มี Priority HIGH อยู่ท้าย dataset ต้องถูกจัดขึ้นมาหน้าแรกเสมอ
- [ ] Boundary pagination tests: page 1, last page, page เกินขอบเขต, pageSize 1, 20, 100, และ pageSize เกิน 100 ถูกปฏิเสธด้วย 400
- [ ] Total count check: ค่า `total` ต้องสะท้อนจำนวน record หลัง search และ filter แล้วเสมอ

**Dependencies:** M3-011  
**Files likely touched:**
- `backend/src/schemas/client-query.schema.ts`
- `backend/src/services/client-list.service.ts`
- `backend/tests/integration/api/client-list-pagination.test.ts`  
**Scope:** M

---

## Checkpoint D — Client Profile & List Pipeline
- [ ] Profile snapshot (`GET /api/clients/:id`) ส่งมอบข้อมูลครบถ้วนพร้อม ownership check และ single evaluation
- [ ] Client List (`GET /api/clients`) โหลดแบบ batch, ค้นหาภาษาไทย/อังกฤษได้, กรอง priority/health ได้, และแบ่งหน้าถูกต้อง
- [ ] ไม่มี N+1 queries ในการดึงข้อมูลรายการ Client ทั้งหมดของ RM

---

## M3-013 — เปิด Morning Action Plan API

**Status:** TODO

**Description:**
พัฒนา endpoint `GET /api/dashboard/morning-action-plan` สำหรับแสดง Action Cards บน Dashboard โดยใช้ pipeline ร่วมกับ Client List

**Acceptance criteria:**
- [ ] รองรับ query parameters เช่นเดียวกับ Client List (`search`, `priority`, `health`, `page`, `pageSize`) และคืนโครงสร้าง `{items, page, pageSize, total, asOfDate}`
- [ ] ข้อมูลใน `items` แต่ละรายการใช้ `ClientCard` schema เดียวกันกับ Client List โดยข้อมูล Action, reason, Priority และ Health ต้องตรงกับ Client List และ Profile ทุกประการเมื่อประเมินที่วันเดียวกัน
- [ ] พฤติกรรมเมื่อไม่พบข้อมูล, validation error, หรือ cross-RM isolation สอดคล้องกับ Client List; ห้ามเขียน logic การกรองหรือ scoring ซ้ำซ้อนขึ้นมาใหม่ใน controller

**Verification:**
- [ ] Parity integration tests: เปรียบเทียบผลลัพธ์ระหว่าง `GET /api/dashboard/morning-action-plan` และ `GET /api/clients` ยืนยันว่าค่าที่ได้ตรงกัน 100%
- [ ] AsOfDate verification: ยืนยันว่า response แนบ `asOfDate` ที่ถูกต้อง
- [ ] Edge cases: ทดสอบวันที่ข้าม UTC midnight และการแบ่งหน้า

**Dependencies:** M3-012  
**Files likely touched:**
- `backend/src/routes/dashboard.routes.ts`
- `backend/src/controllers/dashboard.controller.ts`
- `backend/tests/integration/api/dashboard-action-plan.test.ts`  
**Scope:** S

---

## M3-014 — เปิด Health, Recommendation และ Summary endpoints

**Status:** TODO

**Description:**
พัฒนา sub-endpoints สำหรับดึงข้อมูลเฉพาะส่วน (`/health`, `/recommendations`, `/summary`) โดยนำผลจากการประเมิน Profile ของ RM มาฉาย (project) เป็นคำตอบ

**Acceptance criteria:**
- [ ] `GET /api/clients/:id/health` คืน `HealthResult`
- [ ] `GET /api/clients/:id/recommendations` คืน object เดียว `{action, reason, priority, rule}`
- [ ] `GET /api/clients/:id/summary` คืน `{summary, health, primaryGoal, recommendation, asOfDate}`
- [ ] ทุก sub-endpoint ต้องตรวจสอบสิทธิ์ RM ownership ของ Client ก่อน และประเมินผลผ่าน service เดียวกัน ห้ามมีสูตรการคำนวณแยกต่างหาก
- [ ] ข้อมูลที่ส่งคืนต้องตรงกับ Profile snapshot ทุกประการ รวมถึงการจัดการ nullable fields, `404 Not Found`, `401 Unauthorized` และ error handling

**Verification:**
- [ ] Parameterized integration tests: เปรียบเทียบข้อมูลย่อยจาก sub-endpoints กับข้อมูลใน Profile snapshot
- [ ] Ownership tests: ปฏิเสธ Client ของ RM อื่นด้วย 404
- [ ] Incomplete data tests: คืนสถานะ INSUFFICIENT_DATA ที่ตรงกับ Profile snapshot

**Dependencies:** M3-010  
**Files likely touched:**
- `backend/src/routes/client-sub.routes.ts`
- `backend/src/controllers/client-sub.controller.ts`
- `backend/tests/integration/api/client-sub-endpoints.test.ts`  
**Scope:** S

---

## M3-015 — เปิด Family Graph API

**Status:** TODO

**Description:**
พัฒนา endpoint `GET /api/clients/:id/family` ส่งข้อมูล Graph ความสัมพันธ์แบบ 1-hop โดยแสดงเฉพาะสมาชิกที่ RM มีสิทธิ์เข้าถึง

**Acceptance criteria:**
- [ ] ตรวจสอบว่า Client หลักเป็นของ RM ที่ล็อกอิน; หากไม่ใช่หรือไม่มีอยู่จริง คืน `404 Not Found`
- [ ] ดึงข้อมูลความสัมพันธ์ทั้งสองทิศทาง (primary เป็น source หรือ target ในแถวความสัมพันธ์) และกรองให้เหลือเฉพาะปลายทางที่ RM นั้นเป็นเจ้าของ
- [ ] จำกัดการค้นหาที่ 1 hop เท่านั้น ไม่ traverse ต่อไปยังญาติของญาติ; หากไม่มีความสัมพันธ์ คืน primary node 1 node และ `edges: []`
- [ ] โครงสร้าง Node: `{id, label, type}` (`type` เป็น `PRIMARY` หรือ `RELATED`); โครงสร้าง Edge: `{id, source, target, relationshipType}` โดยไม่มี node หรือ edge ซ้ำซ้อน
- [ ] ความสัมพันธ์ที่เชื่อมโยงกับ Client ของ RM อื่น ต้องถูกซ่อนโดยสิ้นเชิง และไม่ส่งผลต่อ node counts หรือเปิดเผยข้อมูลสมาชิกที่ถูกกรองออก

**Verification:**
- [ ] Graph integration tests:
  - ความสัมพันธ์ทุกประเภท (`PARENT`, `CHILD`, `SPOUSE`, `SIBLING`)
  - Primary client ปรากฏเป็น source หรือ target ในฐานข้อมูล
  - Isolated client (ไม่มีความสัมพันธ์) คืน 1 node และ empty edges
  - Cross-RM isolation: edge ที่เชื่อมไปยัง Client ต่าง RM ต้องไม่ปรากฏใน graph
  - 2-hop traversal rejection: ตรวจสอบว่าไม่ดึงความสัมพันธ์ระดับที่ 2

**Dependencies:** M3-009, M3-010  
**Files likely touched:**
- `backend/src/routes/family.routes.ts`
- `backend/src/controllers/family.controller.ts`
- `backend/src/repositories/family.repository.ts`
- `backend/tests/integration/api/family-graph.test.ts`  
**Scope:** M

---

## Checkpoint E — Dashboard, Sub-endpoints & Family Graph
- [ ] Morning Action Plan (`GET /api/dashboard/morning-action-plan`) ให้ผลลัพธ์สอดคล้องกับ Client List 100%
- [ ] Sub-endpoints (`/health`, `/recommendations`, `/summary`) ส่งคืนข้อมูลที่ตรงกับ Profile snapshot
- [ ] Family Graph API คืนโครงสร้าง 1-hop ถูกต้อง และกรองข้อมูลข้าม RM อย่างสมบูรณ์ ไม่มีการรั่วไหลของข้อมูล

---

## M3-016 — ตรวจ auth flow ผ่าน Caddy ใน local

**Status:** TODO

**Description:**
ทดสอบการทำงานร่วมกันระหว่าง Browser (Client), Caddy reverse proxy และ Express API ในสภาพแวดล้อม local development

**Acceptance criteria:**
- [ ] Caddy reverse proxy ส่งผ่านคำขอ `/api/*` และ `/health` ไปยัง Express API (`localhost:3001`) โดยรักษา path เดิม; `APP_ORIGIN` สอดคล้องกับ port ที่ใช้งานจริง (รวมถึงกรณี `CADDY_PORT=8081`)
- [ ] ตรวจสอบ full auth flow ผ่าน local origin: login → รับ cookie → เรียก `/auth/me` → เข้าถึง List/Profile → logout; cookie บน local HTTP ต้องไม่ตั้ง `Secure` และไม่มี JWT ปรากฏใน body
- [ ] ตรวจสอบ proxy configuration ของ Express: ระบุเฉพาะ trusted proxy IP ของ Caddy; การส่ง spoofed forwarded headers จาก client ภายนอกต้องไม่สามารถปลอมแปลง IP สำหรับ rate limiter ได้
- [ ] บันทึกข้อจำกัดของ Docker Desktop / Windows NAT ที่อาจรวบ client IP เข้าด้วยกัน

**Verification:**
- [ ] Live HTTP smoke tests ผ่าน Caddy proxy: ทดสอบ endpoint `/health`, `/api/auth/login`, `/api/auth/me`, `/api/clients`
- [ ] Forged header tests: ทดสอบส่ง `X-Forwarded-For` ปลอมและยืนยันว่า Express limiter ไม่ใช้ IP ปลอมแปลงนั้น

**Dependencies:** M3-013, M3-014, M3-015  
**Files likely touched:**
- `Caddyfile`
- `backend/src/config/proxy.ts`
- `backend/tests/integration/proxy/caddy-flow.test.ts`  
**Scope:** M

---

## M3-017 — ตรวจ acceptance matrix ของ M3

**Status:** TODO

**Description:**
ทดสอบ Acceptance Matrix รวมทุกเงื่อนไขของ Milestone 3 เพื่อยืนยันความปลอดภัย สิทธิการเข้าถึง และความสอดคล้องของ API ทั้งหมด

**Acceptance criteria:**
- [ ] RM Isolation Matrix: RM A และ RM B ไม่สามารถเข้าถึง, มองเห็นจำนวนนับ, หรือเห็น Family edges ของกันและกันได้ในทุก endpoint
- [ ] Auth & Error Matrix: ทุก protected endpoint ปฏิเสธคำขอที่ไม่มี session หรือ session ไม่ถูกต้อง (`401`); ตรวจสอบ error codes ครบทุกประเภท (`400`, `401`, `403`, `404`, `413`, `415`, `429`, `500`, `503`) โดยไม่มี sensitive stack trace หรือ credentials หลุดใน payload หรือ logs
- [ ] Performance & Query Instrumentation: ยืนยันว่า Client List และ Morning Action Plan ไม่เกิด N+1 query regression เมื่อจำนวน Client เพิ่มขึ้น
- [ ] Data Consistency: ผลลัพธ์ Health, Primary Goal, NBA, และ Summary ตรงกันทุก endpoint เมื่อประเมินด้วยข้อมูลและวันอ้างอิงเดียวกัน

**Verification:**
- [ ] รัน API integration test suite ทั้งหมด: `npm run test:integration`
- [ ] Matrix automated test suite ครอบคลุม RM cross-access tests, error envelopes, and header security assertions (`Cache-Control: no-store`)

**Dependencies:** M3-016  
**Files likely touched:**
- `backend/tests/integration/api/acceptance-matrix.test.ts`  
**Scope:** M

---

## M3-018 — ตรวจ clean checkout และส่งต่อ M4

**Status:** TODO

**Description:**
ตรวจสอบความสมบูรณ์ของระบบจาก clean git checkout รวบรวมหลักฐานการทดสอบจริง และจัดทำเอกสารส่งต่อสำหรับ Milestone 4

**Acceptance criteria:**
- [ ] อัปเดต `README.md` อธิบายคำสั่ง environment setup, secret generation, database migrations, seed data พร้อมการระบุ reference date, startup, และ testing จนสามารถทำตามได้ครบถ้วน
- [ ] ตรวจสอบจาก clean checkout: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`, และ `npm run test:integration` ผ่าน 100%
- [ ] รัน seed ซ้ำและทดสอบ API smoke flow ได้อย่างราบรื่น
- [ ] จัดทำเอกสารสรุปผลการตรวจรับ: บันทึกวันที่, commit SHA, environment, commands, ผลลัพธ์จริง และ mapping FR/BR/NFR สำหรับ backend/API evidence เพื่อส่งต่อให้ Milestone 4

**Verification:**
- [ ] Clean install และ verify commands:
  - `npm ci`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:unit`
  - `npm run build`
  - `npm run test:integration`
- [ ] ตรวจสอบ Markdown links ใน `README.md` และ `tasks/milestone-3/`
- [ ] Git diff สะอาด ไม่มี secrets หรือไฟล์ขยะหลงเหลือ

**Dependencies:** M3-001–017  
**Files likely touched:**
- `README.md`
- `tasks/milestone-3/todo.md`
- `tasks/milestone-3/plan.md`  
**Scope:** M

---

## Checkpoint F — Milestone 3 Final Acceptance & M4 Handover
- [ ] Live Caddy proxy integration ผ่านการทดสอบ
- [ ] Acceptance matrix ผ่านครบทุก endpoints, security controls, และ data isolation checks
- [ ] Clean checkout ผ่าน build, lint, typecheck, unit tests, และ integration tests 100% พร้อมส่งมอบให้ Milestone 4
