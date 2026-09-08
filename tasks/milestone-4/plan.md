# Meridian — Milestone 4: Dashboard, Profile and Family views

## เป้าหมายและฐานที่ใช้วางแผน

ให้ RM ใช้งาน Login → Morning Action Plan / Client List → Profile → Family Graph ได้ผ่าน origin เดียว โดยแสดงข้อมูลและผลคำนวณที่ M3 API ส่งมา เอกสารนี้ใช้ skill `planning-and-task-breakdown` และแบ่งงานเป็น slices ขนาด S/M ที่ตรวจรับแยกกันได้

- วันที่วางแผน: 2026-09-08
- Git baseline: `c9906e931fa6c426fed6c5971750481fba9f5aa5`; working tree สะอาดก่อนเริ่ม
- Frontend ปัจจุบัน: `frontend/app/page.tsx` เป็นหน้า Meridian, มี App Router, TypeScript, Vitest, React Testing Library และ jsdom แล้ว
- M3 tickets ระบุ DONE และมี commit แก้ audit `779c907`; [audit ปัจจุบัน](../../docs/audit/MILESTONE3_COMPREHENSIVE_AUDIT_REPORT.md) อ้างหลักฐานที่ commit นั้น การวางแผนครั้งนี้ไม่ได้รัน tests ซ้ำและไม่รับรองคะแนน/ความครบถ้วนจากรายงานโดยอัตโนมัติ
- รักษาแผน M1–M3 ตามรูปแบบโฟลเดอร์ milestone ที่ใช้อยู่แล้ว; [todo.md](todo.md) เป็นแหล่งสถานะ M4 เพียงแห่งเดียว ทุก ticket เริ่ม `TODO`

### แหล่งอ้างอิงหลัก

- [Roadmap — Milestone 4](../../docs/context/08-delivery-roadmap.md#milestone-4--dashboard-profile-and-family-views)
- [Requirements และราย ID](../../docs/context/03-requirements.md#requirement-traceability)
- [Business rules](../../docs/context/04-business-rules.md)
- [Architecture/API](../../docs/context/05-architecture-and-data.md)
- [Testing strategy](../../docs/context/07-testing.md#frontend-tests)
- [Glossary](../../CONTEXT.md)
- [M3 handover](../milestone-3/handover.md) และ [M3 tickets](../milestone-3/todo.md)
- Wire types: [API contracts](../../backend/src/contracts/api.ts), [financial types](../../backend/src/domain/financial/types.ts), [Family controller](../../backend/src/controllers/family.controller.ts)

## ขอบเขต

ส่งมอบ Login/session UI, navigation, Client List พร้อม search/filter/pagination, Morning Action Plan, Profile snapshot, financial/goals panels, Health breakdown, NBA/Summary และ one-hop Family Graph พร้อม loading/empty/error/incomplete states และ desktop/laptop usability

ไม่มี CRUD Client/Goal, การส่งข้อความถึง Client, AI summary, การคำนวณคะแนนบน browser, recursive family traversal, refresh token, Jenkins หรือ production deployment งาน integration/ownership รวมระบบใน M5 และ pipeline/Trivy/TLS ใน M6 ยังมีเกณฑ์ตรวจรับของตนเอง Automated browser E2E ยังคง optional ตาม testing strategy; M4 ใช้ component tests ร่วมกับ manual browser smoke ผ่าน Caddy

## ข้อตกลงในการพัฒนา

### Routing และ session

ใช้ `/login`, `/dashboard`, `/clients`, `/clients/[id]`; route group `(authenticated)` จัด shell โดยไม่เปลี่ยน URL ส่วน `/` ส่งไป Dashboard ซึ่งจะตรวจ session ก่อนเปิดข้อมูล

Browser fetch relative `/api/*` ผ่าน Caddy ไป Express โดยตรง ไม่เพิ่ม Next.js proxy API หรือ server actions สำหรับ authentication ใช้ client-side session provider ที่เรียก `GET /api/auth/me` และไม่ mount หน้าที่มีข้อมูล RM จนตรวจสำเร็จ Backend ยังคงเป็นผู้บังคับ authorization ทุก request

Fetch ใช้ same-origin cookie, `cache: "no-store"`, AbortSignal และ timeout 10 วินาทีเป็นค่าเริ่มต้นที่ปรับได้; browser สร้าง Origin header ของ POST เอง ห้ามอ่าน/เก็บ JWT, password หรือ Client payload ใน localStorage/sessionStorage/query string และไม่เพิ่ม service-worker cache ข้อมูลส่วนบุคคล

Login สำเร็จไป `/dashboard` โดยไม่ใช้ redirect URL จากภายนอก; `401` จาก login แสดง credential error ส่วน `401` จาก protected fetch ต้องยกเลิก requests และล้างข้อมูล RM ก่อนกลับ login `403` เป็น Origin/security failure และ `503` เป็น dependency failure ไม่ถือเป็น session หมดอายุ Logout สำเร็จเฉพาะหลัง `204`; หาก network ล้มเหลวให้ซ่อนข้อมูลและแสดง retry โดยไม่กล่าวว่า cookie ถูกลบแล้ว

### Wire contracts และ ownership

เพิ่ม `frontend/lib/api-contracts.ts` เป็น type-only facade ที่ re-export เฉพาะ response types จาก backend และเพิ่ม optional `requestId` สำหรับ error ที่ runtime ส่งจริง ห้าม import Express, Prisma, Zod runtime หรือ financial calculators เข้า client bundle; M4-002 ต้องพิสูจน์ด้วย typecheck/build และ typed fixtures หากพบข้อจำกัด build ให้แก้เฉพาะ type boundary โดยไม่คัดลอก business logic

ใช้ responses ตาม shape จริง:
- Login `{user}`, me `{id,name,role}`, logout `204`
- Client List `{items,page,pageSize,total}` ไม่มี `asOfDate`
- Morning Action Plan มี fields เดียวกับ list และ `asOfDate`
- Profile มี `client,financialProfile,goals,primaryGoal,health,recommendation,summary,asOfDate`
- Family มี `nodes,edges`; edge ใช้ `source,target,relationshipType` ไม่สมมติว่า source เป็น primary เสมอ

UI ไม่ส่ง rmId เพื่อเลือกเจ้าของและไม่กรองข้อมูลข้าม RM แทน backend Tests ของ graph ใช้ผล API ที่ถูกกรองแล้วร่วมกับหลักฐาน API isolation จาก M3; การซ่อนข้อมูลใน component ไม่ถือเป็นหลักฐาน server authorization

### Data flow และ race conditions

Client List ใช้ URL query `search,priority,health,page,pageSize` เป็น committed state; search ใช้ form submit/Enter เพื่อไม่ยิงทุก keystroke Filter เปลี่ยนแล้ว apply ทันทีและ reset page เป็น 1; Reset ล้างทุก query และคืน pageSize 20 ให้ browser Back/Forward กู้สถานะเดิม

ส่งค่าตาม API enums, omit ค่า All/ข้อความว่าง, page เริ่ม 1 และ pageSize default 20 มีตัวเลือก 20/50/100; invalid URL query ถูก normalize เป็น default และแก้ URL ก่อน fetch ผล total/order/pagination มาจาก API ไม่ sort/filter เฉพาะหน้าซ้ำ ป้องกัน response เก่าทับ query ใหม่ด้วย abort และ request identity

Profile ใช้ snapshot หนึ่งคำขอต่อการโหลด/refresh ที่สำเร็จ ไม่เรียก health/recommendations/summary แยกเพื่อประกอบหน้า (React development remount อาจทำให้เริ่ม request ที่ถูก abort ได้) เปลี่ยน Client ต้องล้าง snapshot/Family เดิมทันทีและไม่รับ response เก่าที่มาช้า

### Presentation

UI labels/navigation เป็น English; เอกสารเป็นไทย; ชื่อ Client, recommendation reason และ summary แสดงตาม payload โดยไม่แปลหรือแต่งใหม่ ใช้คำ Client, Health, Risk Level, Priority และ NBA ตาม glossary และไม่รวม Risk Level เข้ากับ Health

ใช้ CSS/CSS modules กับ semantic HTML ที่มีอยู่ ไม่เพิ่ม UI framework หรือ graph engine โดยไม่มีความจำเป็น Family ใช้ SVG layout แบบ one-hop ที่กำหนดตำแหน่งแน่นอน พร้อม HTML relationship list สำหรับ keyboard/screen reader; งานนี้ไม่ต้องมี drag, zoom หรือ automatic layout

จำนวนเงินเป็น decimal string: format ด้วยการจัดกลุ่มหลักโดยไม่แปลงจำนวนเต็มทั้งหมดเป็น floating-point; `null` แสดง Not available แยกจากศูนย์ ไม่เติม currency symbol เมื่อ contract ไม่ระบุหน่วย วันที่ `YYYY-MM-DD` แสดงโดยไม่แปลง timezone ส่วน `primaryGoal.progress` หมายถึง on-track progress เทียบ expected amount ไม่ใช่เปอร์เซ็นต์เงินสะสมต่อ target

Profile ที่ incomplete ต้องแสดง missingFields และ breakdown ที่คำนวณได้ ไม่แปลงเป็นคะแนน 0 ส่วน `404` ใช้ข้อความ Client not found เหมือนกันทั้งไม่มีและอยู่นอกสิทธิ์; error ไม่แสดงชื่อ/ยอดเงินจาก Client เดิม

### Verification และหลักฐาน

แต่ละ ticket มี component/unit test ของพฤติกรรมที่เพิ่ม และใช้ `npm run test:unit -w @meridian/web -- tests/<file>.test.tsx` (ใช้ `.test.ts` สำหรับ helper) ตาม paths ที่ ticket ระบุ พร้อม frontend lint/typecheck/build ตามความเกี่ยวข้อง Checkpoint รัน frontend suite และ build รวมเพื่อจับ regression

M4-001 และ M4-017 ใช้ root `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run build` ตาม environment instructions ปัจจุบัน เริ่ม test DB และ Caddy ก่อน integration; live tests อาจเปิด API port 3001 จึงหยุดเฉพาะ development API process ของงานนี้ก่อนรัน แล้วเริ่มใหม่สำหรับ manual smoke ห้ามหยุด Node processes อื่นเหมารวม

Manual smoke ใช้ `http://localhost:<CADDY_PORT>` และ `APP_ORIGIN` ที่ตรงกัน ไม่เปิด `:3000` เป็น acceptance origin; ใช้ normal seed ใน development แบบ idempotent และ anomaly/cross-RM fixtures เฉพาะ isolated test database เมื่อจำเป็น ห้าม reset development data

สถานะ `TODO → IN_PROGRESS → DONE` หรือ `BLOCKED`; DONE ต้องมี date/SHA/environment/commands/result และ evidence path Checkpoints เป็นจุดทบทวน ไม่ใช่ milestone ใหม่และไม่ต้องขออนุมัติซ้ำระหว่างงานที่ผู้ใช้อนุญาตแล้ว

## ลำดับ tickets และ dependencies

| Ticket | ผลส่งมอบ | Dependencies |
|---|---|---|
| [M4-001](todo.md#m4-001) | ตรวจ M3 handoff และ UI contract baseline | M3-018 และ commit แก้ audit |
| [M4-002](todo.md#m4-002) | Browser API client และ typed test fixtures | M4-001 |
| [M4-003](todo.md#m4-003) | Login ที่เชื่อม API | M4-002 |
| [M4-004](todo.md#m4-004) | Session shell และ protected navigation | M4-003 |
| [M4-005](todo.md#m4-005) | Client List view | M4-004 |
| [M4-006](todo.md#m4-006) | Search และ filters | M4-005 |
| [M4-007](todo.md#m4-007) | Pagination และ URL history | M4-006 |
| [M4-008](todo.md#m4-008) | Morning Action Plan | M4-007 |
| [M4-009](todo.md#m4-009) | Profile snapshot route | M4-004 |
| [M4-010](todo.md#m4-010) | Financial Profile และ Goals | M4-009 |
| [M4-011](todo.md#m4-011) | Explainable Health panel | M4-009 |
| [M4-012](todo.md#m4-012) | NBA และ Summary | M4-009, M4-011 |
| [M4-013](todo.md#m4-013) | Lazy Family loading | M4-009 |
| [M4-014](todo.md#m4-014) | One-hop graph และ accessible relationships | M4-013 |
| [M4-015](todo.md#m4-015) | Session expiry / RM switch privacy | M4-008, M4-010, M4-012, M4-014 |
| [M4-016](todo.md#m4-016) | Desktop/laptop usability และ accessibility | M4-015 |
| [M4-017](todo.md#m4-017) | Acceptance evidence และส่งต่อ M5 | M4-016 และ tickets ก่อนหน้าครบ |

Default ทำตามลำดับเลขเพื่อง่ายต่อการ review; M4-009 เริ่มหลัง M4-004 ได้ และ panels M4-010/011/013 พัฒนาแยกกันได้เมื่อ snapshot props นิ่ง งานแก้ shared components, session provider, fixture file, root lockfile และ page composition ต้องเรียงต่อกัน

Checkpoints A หลัง 001–003, B หลัง 004–006, C หลัง 007–009, D หลัง 010–012, E หลัง 013–015 และ F หลัง 016–017

## Requirement mapping

| ID | Tickets ที่รับผิดชอบใน M4 |
|---|---|
| FR-01 / US-01 | 003, 004, 015 |
| FR-02 | 005, 007 |
| FR-03 / US-03 | 006 |
| FR-04 / US-04 | 006, 007 |
| FR-05 / US-02 | 008 |
| FR-06 / US-05 | 009, 010, 011, 012, 013, 014 |
| FR-07 / US-06 | 011 (แสดงผลสูตรที่ M2 เป็นเจ้าของ) |
| FR-08 / US-15 | 011 |
| FR-09 / US-07 | 008, 012 (แสดง NBA จาก API) |
| FR-10 / US-16 | 012 |
| FR-11 / US-08 | 013, 014 |
| FR-12 / US-09 | 012 |
| NFR-01 | 002, 003, 004, 015 (frontend session behavior) |
| NFR-04 | 002, 017 |
| NFR-06 | 005–016 |
| NFR-07 | 010, 011, 012 |
| BR-08 | 010, 011, 012 (incomplete state) |
| BR-09 | 005–009 (derived list flow และ snapshot) |
| BR-10 | 010, 013, 014 (Primary Goal และ Family) |

ตารางนี้เป็น coverage ที่วางแผนไว้ ไม่ใช่หลักฐานว่าข้อกำหนดทั้งข้อผ่านแล้ว การยืนยัน NFR-02 ด้วย performance measurement และ NFR ด้าน infrastructure ยังอยู่ M5/M6 ตาม roadmap

## ความเสี่ยงและวิธีจัดการ

| ประเด็น | วิธีจัดการ / เจ้าของ |
|---|---|
| Audit/handover มีคำรับรองเกินหลักฐาน | 001 ตรวจ current commands และ contract จริง; พบ regression ให้บันทึก upstream blocker โดยไม่ปิดเอง |
| Contract types ต่างจากตัวอย่าง JSON | 001/002 ยึด response/runtime ที่ตรวจแล้วและบันทึก discrepancy; fixtures ต้องมี type checking |
| Late response แสดงข้อมูล Client/RM เดิม | 002/009/013 abort+identity; 015 session generation และ clear state |
| Browser history หรือ BFCache คืนข้อมูลหลัง logout | 015 revalidate ก่อนแสดงหลังกลับหน้า/เปลี่ยน identity; manual multi-tab check |
| Graph labels กลับด้าน | 014 ใช้บทบาท source ต่อ target และ fixtures primary เป็นทั้งสองด้าน |
| Null/decimal/date แสดงผิดความหมาย | 010/011 แยก formatter กับ business calculation และทดสอบ boundary display |
| Root lockfile หรือ shared fixture ถูกแก้ชนกัน | ทำตามลำดับ ไม่เพิ่ม dependencies โดยไม่ตรวจของเดิม |
| M4 ขยายเป็น M5/M6 | 017 ส่ง coverage gaps ต่อ M5 และระบุ production/performance evidence ที่ยังไม่รัน |

## เกณฑ์จบ Milestone 4

RM ใช้ flow หลักผ่าน Caddy ได้; tests ยืนยัน loading/empty/error/incomplete, search/filter/pagination, Profile snapshot consistency และ Family visibility; UI ใช้ keyboard และอ่านบน desktop/laptop ได้; session expiry/logout ไม่ทิ้งข้อมูล RM เดิม; frontend/root checks ที่เกี่ยวข้องผ่านพร้อมหลักฐานที่ทำซ้ำได้

ผลส่งมอบของการวางแผนครั้งนี้คือ plan และ tickets เท่านั้น ยังไม่มีการพัฒนา M4 หรือผลทดสอบระบบในรอบนี้

