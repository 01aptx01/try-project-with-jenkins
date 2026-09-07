# 5. Architecture, Data, API and Security

## Architecture

```text
Browser → Caddy → Next.js frontend → Express REST API → PostgreSQL
                                      │
                                      └→ Health / Priority / NBA / Summary services
```

Next.js เป็น UI; Express เป็น API และไม่เปิด database ให้ browser เข้าถึงโดยตรง; Prisma จัดการ schema/query; React Flow แสดง Family Wealth Network Database, business-rule services และ API ต้องบังคับ RM ownership ก่อนคืน Client data

## Technology choices

| Layer | Technology |
|---|---|
| Language / web | TypeScript, Next.js, React Bootstrap |
| API / validation | Node.js, Express, Zod |
| Authentication | bcrypt, JWT in HttpOnly cookie |
| Data | PostgreSQL, Prisma |
| Graph / tests | React Flow, Vitest, React Testing Library, Supertest |
| Delivery | GitHub, Jenkins, Docker, Docker Compose, Caddy, Trivy |

## Data model

| Model | Fields / relation |
|---|---|
| `users` | `id`, `email` unique, `password_hash`, `name`, `role`, timestamps; RM 1→N Client |
| `clients` | `id`, `customer_code` unique, name, age, occupation, `risk_level`, `rm_id`, timestamps |
| `financial_profiles` | `client_id` unique, `monthly_income`, `monthly_expense`, `liquid_assets`, `total_assets`, `total_debt`, `savings`, `investments`, `updated_at` |
| `goals` | `client_id`, `goal_type`, `target_amount`, `current_amount`, **`start_date`**, `target_date`, timestamps |
| `family_relationships` | `client_id`, `related_client_id`, `relationship_type`, timestamp; canonical pair, no self relation or contradictory pair |
| `recommendations` | Optional future persistence only; MVP generates NBA on request and does not persist it |

Monetary values are non-negative decimals. `monthly_income`, `monthly_expense`, `total_assets` และ `target_amount` ต้องมากกว่า 0 เพื่อสร้าง complete Health Score; foreign keys และ unique constraints บังคับ referential/data integrity แต่ **ไม่บังคับ RM authorization** Ownership middleware ต้องตรวจ `rm_id` ทุกครั้งที่คืน Client data

## Authentication and session

`POST /api/auth/login` ตรวจ email/password ด้วย bcrypt แล้ว set JWT `HS256` อายุหนึ่งชั่วโมงใน cookie `meridian_session` ที่มี `HttpOnly`, `Secure` (production), `SameSite=Lax`, `Path=/`; response body ไม่คืน token `POST /api/auth/logout` clear cookie ด้วยชื่อ/path/attributes เดียวกัน ไม่มี refresh token และ server ไม่เพิกถอน token ก่อนหมดอายุ `JWT_SECRET` สร้างครั้งเดียวจาก cryptographically secure random bytes และเก็บเป็น deployment secret

production ให้ Caddy รวม frontend/API เป็น origin เดียวบน HTTPS: `/api/*` และ `/health` route ไป Express, ส่วนอื่น route ไป Next.js API port ไม่ publish สู่ภายนอก Express เชื่อถือ proxy เฉพาะ Caddy ตาม topology ที่กำหนดและรับ forwarded client IP จาก proxy นี้เท่านั้น Local development ใช้ HTTP และไม่ตั้ง `Secure` cookie ได้ Middleware อ่าน cookie, verify JWT และวาง RM identity ใน request ทุก POST รวม login/logout ต้องตรวจ Origin; missing, `null` หรือ origin ไม่ตรงได้ `403`

Login limiter ใช้ `express-rate-limit` memory store ของ API instance เดียว: สูงสุด 5 request ต่อ 60 วินาทีต่อ verified client IP; เกินได้ `429` และ `Retry-After` Memory counter หายได้เมื่อ API restart จึงไม่ใช่ account lockout แบบ shared/distributed store

## API contract

`POST /api/auth/login`, `POST /api/auth/logout` และ `GET /health` เป็น public; `/api/auth/me` และ Client endpoints ต้อง authenticated `401` หมายถึงไม่มี/ไม่ถูกต้อง/หมดอายุ; `404` หมายถึง Client ไม่มีอยู่หรือไม่ใช่ Client ของ RM โดยเจตนาไม่เปิดเผยความแตกต่าง Validation error เป็น `400`; Origin reject เป็น `403`; login rate limit เป็น `429`; dependency ไม่พร้อมเป็น `503` error response ใช้ `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`

| Endpoint | Behavior |
|---|---|
| `POST /api/auth/login` | body `{email,password}`; success `{user:{id,name,role}}` + cookie |
| `POST /api/auth/logout` | clear cookie, `204` |
| `GET /api/auth/me` | current RM `{id,name,role}` |
| `GET /api/clients` | `search`, `priority`, `health`, `page` (default 1), `pageSize` (default 20, max 100); returns owned Client only |
| `GET /api/clients/:id` | owned Client Profile snapshot: client, financialProfile, goals, primaryGoal, health, recommendation, summary และ asOfDate |
| `GET /api/dashboard/morning-action-plan` | ordered owned Client cards with Health status, Priority, NBA reason |
| `GET /api/clients/:id/health` | contract and null behavior in [04-business-rules.md](04-business-rules.md) |
| `GET /api/clients/:id/recommendations` | one `{action, reason, priority, rule}` object; plural path remains for compatibility |
| `GET /api/clients/:id/family` | `{nodes,edges}` filtered by RM visibility |
| `GET /api/clients/:id/summary` | template-generated `{summary, health, primaryGoal, recommendation}` |
| `GET /health` | unauthenticated `{status:"ok", version:"<commit-sha>"}` เมื่อ API และ database ready; ไม่พร้อมคืน `503` |

Client List response shape is `{items, page, pageSize, total}` Search is partial and case-insensitive against display name and `customerCode`; priority values คือ `HIGH`, `MEDIUM`, `LOW`; health values คือ `GOOD`, `MODERATE`, `AT_RISK`, `INSUFFICIENT_DATA` JSON ใช้ camelCase, วันที่เป็น `YYYY-MM-DD`, monetary values เป็น decimal string และ score เป็น number หรือ `null` Response ที่มีข้อมูล RM/Client ตั้ง `Cache-Control: no-store`

### Status and wire contract matrix

| Endpoint | Success example / required fields | Expected error status |
|---|---|---|
| `POST /api/auth/login` | `200`, `{user:{id,name,role}}` and cookie | `400` invalid body, `401` invalid credential, `403` Origin, `429` limit |
| `POST /api/auth/logout` | `204`, clears `meridian_session` | `403` Origin |
| `GET /api/auth/me` | `200`, `{id,name,role}` | `401` invalid session |
| `GET /api/clients` | `200`, `{items: ClientCard[],page:number,pageSize:number,total:number}` | `400` invalid query, `401` session |
| `GET /api/clients/:id` | `200`, Profile snapshot below | `401` session, `404` missing/not-owned Client, `503` dependency |
| `GET /api/dashboard/morning-action-plan` | `200`, `{items: ActionPlanCard[],asOfDate}` | `401` session, `503` dependency |
| `GET /api/clients/:id/health` | `200`, `HealthResult` with nullable score/classification | `401`, `404`, `503` |
| `GET /api/clients/:id/recommendations` | `200`, `{action,reason,priority,rule}` | `401`, `404`, `503` |
| `GET /api/clients/:id/family` | `200`, `{nodes:FamilyNode[],edges:FamilyEdge[]}` | `401`, `404`, `503` |
| `GET /api/clients/:id/summary` | `200`, `{summary,health,primaryGoal,recommendation,asOfDate}` | `401`, `404`, `503` |
| `GET /health` | `200`, `{status:"ok",version:"<commit-sha>"}` | `503` API/database unavailable |

`ClientCard` contains `id`, `customerCode`, display name, `riskLevel`, `health` and `recommendation`; `HealthResult` contains nullable `score` and `classification`, a `status` of `COMPLETE` or `INSUFFICIENT_DATA`, `missingFields` and complete/null breakdown fields. `FamilyNode` has `id`, label and type; `FamilyEdge` has `id`, source, target and relationship type. Any error uses the common error object above; no endpoint returns a token or sensitive stack trace

## Profile snapshot and response examples

`GET /api/clients/:id` สร้าง Health, NBA และ Summary จาก evaluation เดียวกัน; endpoints ย่อยยังคงอยู่เพื่อ UI component หรือ consumer อื่น แต่ต้องเรียก service และ response types ชุดเดียวกัน Family Graph โหลดแยกผ่าน `/family`

```json
{
  "client": { "id": "client-1", "customerCode": "C-001", "riskLevel": "MEDIUM" },
  "financialProfile": { "monthlyIncome": "80000.00", "monthlyExpense": "35000.00" },
  "goals": [{ "id": "goal-1", "startDate": "2026-01-01", "targetDate": "2030-01-01" }],
  "primaryGoal": { "id": "goal-1" },
  "health": { "score": 74, "classification": "MODERATE", "status": "COMPLETE" },
  "recommendation": { "action": "Routine Financial Review", "priority": "LOW", "rule": "BR-04.6" },
  "summary": "…",
  "asOfDate": "2026-09-08"
}
```

ข้อมูลที่จำเป็นขาดยังคืน Profile สำเร็จพร้อม `health.status = "INSUFFICIENT_DATA"`; database, service หรือ dependency failure เป็น error response และต้องไม่แปลงเป็นข้อมูลไม่เพียงพอ Primary Goal เลือก Goal ที่ยังไม่สำเร็จและ `targetDate` เร็วสุด, เสมอใช้ `id`; หากสำเร็จทุก Goal เลือกวันที่เร็วสุด และถ้าไม่มี Goal ที่ valid คืน `null`

## Security considerations

Never commit `.env`, `JWT_SECRET`, database passwords or webhooks. Store credentials in Jenkins Credentials, environment or deployment secret store; use Zod `.strict()` validation, Prisma/parameterized queries, Caddy TLS, bcrypt and JWT verification. Logs may contain request ID, route and status only; never log password, cookie, token or financial data Mounting `/var/run/docker.sock` into Jenkins is accepted only for this prototype and grants high host-Docker privilege; non-root containers or socket file permissions do not isolate untrusted code that can access the daemon. This trade-off is recorded in ADR 0002
