# Meridian — Milestone 4 Tickets

สถานะเริ่มต้นทั้งหมดเป็น `TODO`; ใช้ `TODO → IN_PROGRESS → DONE` หรือ `BLOCKED` ปิดได้เมื่อมี verification evidence จริงเท่านั้น ข้อตกลงร่วมและคำสั่งอยู่ใน [plan.md](plan.md) ไฟล์ที่ระบุด้านล่างเป็น proposed paths ซึ่งยังไม่ได้สร้างในรอบวางแผนนี้

แต่ละ ticket ขนาด S/M ครอบคลุม code/config ไม่เกินประมาณ 5 ไฟล์ หากเริ่มทำแล้วเกินขอบเขตให้แยก follow-up ก่อนขยายงาน; การอัปเดตสถานะ/evidence ใช้ไฟล์ร่วมและทำตามลำดับ

<a id="m4-001"></a>

## M4-001 — ตรวจ M3 handoff และล็อก UI contracts

**Status:** DONE  
**Scope:** S  
**Requirements:** NFR-04; prerequisite ของ FR-01–12

**งาน:** ยืนยัน baseline ที่ frontend จะใช้ก่อนเริ่มพัฒนา โดยตรวจการแก้ audit ปัจจุบันและเก็บ response examples ที่ตรงกับ runtime

**Acceptance criteria:**

- [x] บันทึก HEAD, Git status, environment และผล root lint/typecheck/unit/integration/build; Caddy และ isolated test DB เป็น preconditions ที่ต้องตรวจจริง ไม่มี skip ที่นับเป็นผ่าน
- [x] ทำ contract checklist สำหรับ auth/list/dashboard/profile/family รวม nullability, error.requestId ที่ runtime ส่ง, decimal/date formats และ PrimaryGoal.progress; ตัวอย่างใช้ผล domain จริง ไม่คัดลอกตัวอย่างคะแนนที่ขัดสูตร
- [x] หาก prerequisite ไม่ผ่าน บันทึก failing command และ upstream M3 finding/ticket พร้อมกำหนดงานที่ถูกบล็อก; ไม่เขียนว่า M4 พร้อมจากคะแนน audit เพียงอย่างเดียว

**Verification:**

- [x] รันคำสั่ง baseline ตาม plan และเทียบ payload กับ backend response types/tests; ไม่ cleanup development DB
- [x] บันทึก evidence ใน verification record และอัปเดตสถานะตามผลจริง ใน `tasks/milestone-4/verification.md` และ `tasks/milestone-4/contract-baseline.md`
- [x] ผลการตรวจ: Quality gates ผ่าน 100% (npm audit 0, lint 0, typecheck 0, test:unit 172 passed, test:integration 78 passed, build passed)

**Dependencies:** M3-018 และ commit แก้ audit 779c907

**Files likely touched:**

- `tasks/milestone-4/verification.md`
- `tasks/milestone-4/contract-baseline.md`

<a id="m4-002"></a>

## M4-002 — สร้าง browser API client ที่มี typed contracts

**Status:** DONE  
**Scope:** M  
**Requirements:** NFR-01, NFR-04

**งาน:** เตรียม request/response boundary สำหรับ vertical slices โดยใช้ fetch ของ browser และ fixtures ที่ตรงกับ M3

**Acceptance criteria:**

- [x] มี type-only facade ของ wire types และ typed synthetic fixtures ครบ complete/incomplete/error/family; frontend build ไม่มี Prisma/Express/Zod runtime หรือ financial calculators จาก backend
- [x] API helper ใช้ relative paths, same-origin credentials, no-store, caller AbortSignal และ timeout 10 วินาที; แยก HTTP error/network/timeout/abort และรับ 204 โดยไม่ parse JSON
- [x] Tests ครอบคลุม 400/401/403/404/413/415/429 พร้อม Retry-After/500/503, malformed response และ cancellation; helper ไม่ log password/cookie/token/payload และไม่ retry POST อัตโนมัติ

**Verification:**

- [x] frontend focused tests `tests/api-client.test.ts` (15 passed), lint/typecheck/build ผ่าน 100%; ตรวจ import graph ของ client boundary ยืนยันไม่มี runtime leak จาก backend
- [x] บันทึก evidence ใน verification record (`tasks/milestone-4/verification.md`) และอัปเดตสถานะตามผลจริง

**Dependencies:** M4-001

**Files likely touched:**

- `frontend/lib/api-contracts.ts`
- `frontend/lib/api-client.ts`
- `frontend/tests/fixtures/api.ts`
- `frontend/tests/api-client.test.ts`

<a id="m4-003"></a>

## M4-003 — สร้าง Login form ที่ใช้ session cookie

**Status:** DONE  
**Scope:** M  
**Requirements:** FR-01, US-01, NFR-01, NFR-06

**งาน:** ให้ RM ลงชื่อเข้าใช้ด้วย API จริงและเห็นข้อผิดพลาดที่แก้ไขได้

**Acceptance criteria:**

- [x] /login มี email/password labels, required validation และ autocomplete ที่เหมาะสม; ส่ง JSON ไป /api/auth/login ไม่ trim password และไม่บันทึก credential ลง browser storage
- [x] เมื่อ pending ป้องกัน submit ซ้ำ; success ไป /dashboard; 401 แสดง credential error, 429 แสดงเวลารอตาม Retry-After และ disable ชั่วคราว (fallback 60 วินาทีเมื่อ header ใช้ไม่ได้), 403/503/network แสดงข้อความที่ตรงสาเหตุ
- [x] Tests ตรวจ success/error/pending และไม่มี JWT ใน UI/storage; keyboard submit และ error announcement ใช้งานได้

**Verification:**

- [x] focused tests `tests/login.test.tsx` (6 passed); ตรวจสอบ credentials ไม่ถูก trim และไม่หลุดรอดสู่ browser storage
- [x] บันทึก evidence ใน verification record (`tasks/milestone-4/verification.md`) และอัปเดตสถานะตามผลจริง

**Dependencies:** M4-002

**Files likely touched:**

- `frontend/app/login/page.tsx`
- `frontend/components/login-form.tsx`
- `frontend/tests/login.test.tsx`

---

## Checkpoint A — API client และ Login

- [x] Contract baseline ผ่าน; Login แสดง success/failure ผ่าน tests และ browser; frontend checks/build ผ่าน
- [x] ทบทวนผลและ blockers ก่อนงานที่พึ่งพา; ผ่านการตรวจประเมินความมั่นคงปลอดภัยและ zero bundle leak เรียบร้อยแล้ว

<a id="m4-004"></a>

## M4-004 — สร้าง session shell และ protected navigation

**Status:** DONE  
**Scope:** M  
**Requirements:** FR-01, US-01, NFR-01, NFR-06

**งาน:** เปิดพื้นที่ RM หลัง /auth/me ยืนยันสำเร็จ พร้อม navigation และ logout ขั้นพื้นฐาน

**Acceptance criteria:**

- [x] Session provider มี checking/authenticated/unauthenticated/error states; /dashboard, /clients และ /clients/[id] ไม่ mount sensitive content ระหว่าง checking; direct link และ / redirect เข้าสู่ flow เดียวกัน
- [x] แสดงชื่อ RM, Dashboard/Clients navigation และ Logout; 401 ไป /login, 503/network มี Retry โดยไม่วน redirect; logout รอ 204 แล้ว clear state และ replace ไป login
- [x] Tests ตรวจ direct protected navigation, session checking, success, 401, 503 และ logout failure; ปรับ test หน้าแรกให้ตรง routing ใหม่

**Verification:**

- [x] focused tests `tests/session-shell.test.tsx` (4 passed) และ `tests/home.test.tsx` (1 passed); frontend build เพื่อยืนยัน route groups ผ่าน 100%
- [x] บันทึก evidence ใน verification record (`tasks/milestone-4/verification.md`) และอัปเดตสถานะตามผลจริง

**Dependencies:** M4-003

**Files likely touched:**

- `frontend/components/session-provider.tsx`
- `frontend/app/(authenticated)/layout.tsx`
- `frontend/app/page.tsx`
- `frontend/tests/session-shell.test.tsx`
- `frontend/tests/home.test.tsx`

<a id="m4-005"></a>

## M4-005 — แสดง Client List จาก API

**Status:** DONE  
**Scope:** M  
**Requirements:** FR-02, FR-06 navigation, NFR-06

**งาน:** ให้ RM ดูรายการ Client ที่มีสิทธิ์พร้อม Health, Risk Level และ Priority

**Acceptance criteria:**

- [x] /clients fetch GET /api/clients และแสดง customerCode/displayName/riskLevel/health/recommendation.priority กับ link Profile โดยคงลำดับที่ API ส่ง; ไม่ดึง Profile เพิ่มราย Client
- [x] Loading, empty, error+Retry และ incomplete health แยกกัน; null score ไม่แสดง 0 และไม่คงแถวของผลเก่าเมื่อ request ใหม่ล้มเหลว
- [x] Table/list มีชื่อคอลัมน์และข้อความ priority ที่อ่านได้โดยไม่พึ่งสี; จำนวนรวมใช้ total จาก API

**Verification:**

- [x] focused tests `tests/client-list.test.tsx` (5 passed) ใช้ complete/incomplete/empty/503 fixtures และตรวจจำนวน requests
- [x] บันทึก evidence ใน verification record (`tasks/milestone-4/verification.md`) และอัปเดตสถานะตามผลจริง

**Dependencies:** M4-004

**Files likely touched:**

- `frontend/app/(authenticated)/clients/page.tsx`
- `frontend/components/client-list.tsx`
- `frontend/components/priority-badge.tsx`
- `frontend/tests/client-list.test.tsx`

<a id="m4-006"></a>

## M4-006 — เพิ่ม Client search และ filters

**Status:** DONE  
**Scope:** M  
**Requirements:** FR-03, FR-04, US-03, US-04, NFR-06

**งาน:** ค้นชื่อหรือรหัสและใช้ filters ร่วมกันจาก server โดยไม่กรองเฉพาะข้อมูลหน้าที่เปิดอยู่

**Acceptance criteria:**

- [x] Search submit ด้วย button/Enter และ filters ส่ง query ร่วมกัน; ใช้ HIGH/MEDIUM/LOW และ GOOD/MODERATE/AT_RISK/INSUFFICIENT_DATA ตาม contract พร้อม All
- [x] Query ที่ apply อยู่แสดงใน URL; filter/search change reset page=1; Reset ล้าง search/filters/page/pageSize กลับ default; invalid enums/query ถูก normalize ก่อน fetch
- [x] Tests ตรวจ combined query, whitespace/Thai/English input, empty result/reset และ late response ของ query เก่าที่ต้องไม่ทับผลใหม่

**Verification:**

- [x] focused tests tests/client-filters.test.tsx (10 tests passed); ตรวจ browser URL และ Network ว่าส่ง search/filter ให้ API
- [x] บันทึก evidence ใน verification record (`tasks/milestone-4/verification.md`) และอัปเดตสถานะตามผลจริง

**Dependencies:** M4-005

**Files likely touched:**

- `frontend/components/client-filters.tsx`
- `frontend/lib/client-query.ts`
- `frontend/app/(authenticated)/clients/page.tsx`
- `frontend/tests/client-filters.test.tsx`

### Checkpoint B — Session และ Client search

- [x] Protected routes ไม่แสดงข้อมูลก่อน /me; List และ combined filters ใช้งานได้; frontend suite/build ผ่าน
- [x] ทบทวนผลและ blockers ก่อนงานที่พึ่งพา; ไม่ใช้จำนวน tests หรือคะแนน audit แทน acceptance evidence

<a id="m4-007"></a>

## M4-007 — เพิ่ม Pagination และ browser history

**Status:** DONE  
**Scope:** M  
**Requirements:** FR-02, FR-04, BR-09, US-03, US-04

**งาน:** ให้เปิดทุกหน้าของผลที่กรองแล้วและกลับมา query เดิมได้

**Acceptance criteria:**

- [x] Pagination ใช้ page/pageSize/total จาก API; default 20 และเลือก 20/50/100, disable Next/Previous ตามขอบเขต; page ที่เกินผลแสดง empty พร้อมกลับหน้าแรก ไม่เปลี่ยน total เป็นศูนย์เอง
- [x] Back/Forward และ link กลับจาก Profile คืน query/page เดิม; ไม่มี client-side re-sort/re-filter หรือแบ่งหน้าซ้ำ; invalid page/pageSize normalize ก่อน request
- [x] Tests ใช้ dataset fixture มากกว่า 20 แถวและ HIGH ที่อยู่ท้ายข้อมูลต้นทางเพื่อยืนยันว่าแสดงตาม server page; ตรวจ page-size change, total หลัง filter, history และ response race

**Verification:**

- [x] focused tests tests/client-pagination.test.tsx (6 passed) และ browser Back/Forward; frontend checks
- [x] บันทึก evidence ใน verification record (`tasks/milestone-4/verification.md`) และอัปเดตสถานะตามผลจริง

**Dependencies:** M4-006

**Files likely touched:**

- `frontend/components/pagination.tsx`
- `frontend/lib/client-query.ts`
- `frontend/app/(authenticated)/clients/page.tsx`
- `frontend/tests/client-pagination.test.tsx`

<a id="m4-008"></a>

## M4-008 — สร้าง Morning Action Plan

**Status:** DONE  
**Scope:** M  
**Requirements:** FR-05, FR-09, US-02, NFR-06

**งาน:** ให้ RM เห็น Client ที่ควร review พร้อมเหตุผลของ NBA เมื่อเปิด Dashboard

**Acceptance criteria:**

- [x] /dashboard ใช้ /api/dashboard/morning-action-plan แสดงชื่อ/รหัส, Health, Priority, action/reason และ asOfDate; ไม่คำนวณหรือเรียงใหม่บน frontend และไม่สร้าง recent-event signals
- [x] ใช้ pagination เพื่อเข้าถึงทุก Client พร้อม link ไป Profile; loading/empty/error/incomplete แยกกัน และไม่สร้าง KPI รวมจากข้อมูลเพียงหน้าเดียว
- [x] Tests ยืนยัน HIGH→MEDIUM→LOW และ customerCode tie ตาม response, pagination, asOfDate และการ reuse recommendation เดียวกับ fixtures ของ Profile

**Verification:**

- [x] focused tests tests/morning-action-plan.test.tsx (5 passed); manual เปิด Dashboard ผ่าน Caddy และเปลี่ยนหน้า
- [x] บันทึก evidence ใน verification record (`tasks/milestone-4/verification.md`) และอัปเดตสถานะตามผลจริง

**Dependencies:** M4-007

**Files likely touched:**

- `frontend/app/(authenticated)/dashboard/page.tsx`
- `frontend/components/morning-action-plan.tsx`
- `frontend/tests/morning-action-plan.test.tsx`

<a id="m4-009"></a>

## M4-009 — สร้าง Client Profile จาก snapshot เดียว

**Status:** DONE  
**Scope:** M  
**Requirements:** FR-06, US-05, BR-09

**งาน:** เปิดรายละเอียด Client ด้วยหนึ่ง snapshot request และส่ง payload ชุดเดียวกันให้ panels

**Acceptance criteria:**

- [x] /clients/[id] โหลด /api/clients/:id แล้วแสดง personal data, Risk Level และ asOfDate; ไม่เรียก health/recommendations/summary sub-endpoints เพิ่มเพื่อประกอบหน้า
- [x] Financial Profile/primaryGoal ที่ null ยังเป็น success; malformed ID/404/error มี state ของตน และ missing/not-owned ใช้ Client not found เหมือนกัน
- [x] เมื่อ route ID เปลี่ยนหรือออกจากหน้าให้ abort และ clear snapshot; late response ของ Client A ห้ามแสดงใน Client B และ Family ยังไม่ถูก fetch ก่อนเปิด

**Verification:**

- [x] focused tests tests/client-profile.test.tsx (4 passed) ยืนยัน fetch paths/count และ out-of-order responses; frontend build
- [x] บันทึก evidence ใน verification record (`tasks/milestone-4/verification.md`) และอัปเดตสถานะตามผลจริง

**Dependencies:** M4-004

**Files likely touched:**

- `frontend/app/(authenticated)/clients/[id]/page.tsx`
- `frontend/components/client-profile.tsx`
- `frontend/hooks/use-client-profile.ts`
- `frontend/tests/client-profile.test.tsx`

### Checkpoint C — Dashboard และ Profile snapshot

- [x] Pagination/history ถูกต้อง; Dashboard link ไป Profile ได้; Profile ใช้ snapshot request และไม่ preload Family; frontend suite/build ผ่าน
- [x] ทบทวนผลและ blockers ก่อนงานที่พึ่งพา; ไม่ใช้จำนวน tests หรือคะแนน audit แทน acceptance evidence

<a id="m4-010"></a>

## M4-010 — แสดง Financial Profile และ Goals

**Status:** TODO  
**Scope:** M  
**Requirements:** FR-06, US-05, NFR-07, BR-10

**งาน:** แสดงข้อมูลการเงินและ Goal โดยรักษาความหมายของ decimal strings, null และ date-only

**Acceptance criteria:**

- [ ] แสดง monthlyIncome/monthlyExpense/liquidAssets/totalAssets/totalDebt/savings/investments; zero ต่างจาก null และ financialProfile=null; format decimal string อย่างไม่สูญเสียความแม่นยำและไม่เดาหน่วยเงิน
- [ ] แสดง goals ที่ API ส่งพร้อม startDate/targetDate/currentAmount/targetAmount และเลือก primaryGoal จาก snapshot เท่านั้น; ไม่มี goals/primaryGoal=null มีข้อความที่เหมาะสม
- [ ] Primary goal แสดง expectedAmount, progress, isBehind/isCompleted ตาม payload; progress ใช้ชื่อ On-track progress ไม่ใช่ Goal completion และไม่คำนวณวัน/สูตร Health ใหม่ใน browser

**Verification:**

- [ ] focused tests tests/financial-details.test.tsx ครอบคลุมเงินขนาดใหญ่ ศูนย์ null วันที่ข้าม timezone และ Goal ก่อนเริ่ม/ครบกำหนด/เสร็จตาม fixtures
- [ ] บันทึก evidence ใน verification record และอัปเดตสถานะตามผลจริง

**Dependencies:** M4-009

**Files likely touched:**

- `frontend/components/financial-details.tsx`
- `frontend/lib/display-format.ts`
- `frontend/components/client-profile.tsx`
- `frontend/tests/financial-details.test.tsx`

<a id="m4-011"></a>

## M4-011 — แสดง Health พร้อม breakdown และ missing data

**Status:** TODO  
**Scope:** M  
**Requirements:** FR-07, FR-08, US-06, US-15, NFR-07, BR-08

**งาน:** ให้ RM เข้าใจคะแนนและข้อมูลที่ทำให้คำนวณไม่ได้จาก HealthResult

**Acceptance criteria:**

- [ ] COMPLETE แสดง score/classification และ Liquidity/Debt/Savings/Goals/Investment breakdown ตาม payload โดยไม่รวม/จัดกลุ่มคะแนนซ้ำเพื่อแทน backend
- [ ] INSUFFICIENT_DATA แสดงสถานะ, missingFields ทั้งหมด และ component ที่ยังคำนวณได้; null แสดง Not available, 0 แสดง 0; unknown missing-field path ยังอ่านได้ไม่ถูกทิ้ง
- [ ] Tests ตรวจ 0/59.99/60/79.99/80/100 และ partial/null breakdown จาก typed fixtures; classification/breakdown labels มีข้อความไม่พึ่งสีและ error response ไม่กลายเป็น insufficient state

**Verification:**

- [ ] focused tests tests/health-panel.test.tsx; ตรวจ screenshot หรือ browser ที่ complete/incomplete จาก fixture environment
- [ ] บันทึก evidence ใน verification record และอัปเดตสถานะตามผลจริง

**Dependencies:** M4-009

**Files likely touched:**

- `frontend/components/health-panel.tsx`
- `frontend/components/client-profile.tsx`
- `frontend/tests/health-panel.test.tsx`

<a id="m4-012"></a>

## M4-012 — แสดง NBA และ Summary จาก snapshot

**Status:** TODO  
**Scope:** M  
**Requirements:** FR-09, FR-10, FR-12, US-07, US-09, US-16, BR-05, BR-06

**งาน:** รวม action/reason/priority/rule กับ Summary ที่อธิบาย Client โดยใช้ response เดิม

**Acceptance criteria:**

- [ ] NBA แสดงหนึ่ง object เท่านั้น มี action/reason/priority/rule และใช้ Priority badge เดิม; รวม Review Client Data MEDIUM ที่ backend เลือกเมื่อ incomplete
- [ ] Summary แสดง string จาก snapshot เป็น text และใช้ primaryGoal/Health/NBA ใน snapshot เดียวกัน; ไม่ parse text เพื่อสร้าง recommendation ใหม่ ไม่ใช้ HTML injection
- [ ] Tests ครอบคลุมทุก recommendation action, insufficient และข้อความพิเศษ; payload เดียวกันให้ action/reason ที่ตรงใน Dashboard/Profile/Summary และไม่มี sub-endpoint fetch เพิ่ม

**Verification:**

- [ ] focused tests tests/recommendation-summary.test.tsx ร่วมกับ morning/profile tests; assertion ค่าเดียวกันใน shared fixture
- [ ] บันทึก evidence ใน verification record และอัปเดตสถานะตามผลจริง

**Dependencies:** M4-009, M4-011

**Files likely touched:**

- `frontend/components/recommendation-card.tsx`
- `frontend/components/summary-panel.tsx`
- `frontend/components/client-profile.tsx`
- `frontend/tests/recommendation-summary.test.tsx`

### Checkpoint D — Financial explanation

- [ ] Profile แสดงข้อมูลการเงิน/Goals/Health/NBA/Summary จาก payload เดียว; complete/incomplete อ่านได้; frontend suite/build ผ่าน
- [ ] ทบทวนผลและ blockers ก่อนงานที่พึ่งพา; ไม่ใช้จำนวน tests หรือคะแนน audit แทน acceptance evidence

<a id="m4-013"></a>

## M4-013 — โหลด Family เฉพาะเมื่อเปิดดู

**Status:** TODO  
**Scope:** M  
**Requirements:** FR-06, FR-11, US-08, BR-10

**งาน:** เปิด Family section แยกจาก Profile เพื่อไม่ถ่วง snapshot และจัด state ของ graph เป็นอิสระ

**Acceptance criteria:**

- [ ] มีปุ่ม/section Family Network ที่เรียก /api/clients/:id/family ครั้งแรกเมื่อเปิด; Profile ไม่ถูก refetch เมื่อเปิด graph และไม่ fetch recursive/per-node endpoints
- [ ] Graph มี loading/error+Retry และ primary-only/no-visible-relatives state; 401 ส่งให้ session flow, 404 ไม่คงข้อมูล Family เก่า, graph failure ไม่ทำให้ snapshot ส่วนอื่นหาย
- [ ] Cache เฉพาะ memory ของ current Client/current session; ID หรือ session เปลี่ยนต้อง clear/abort และปฏิเสธ late response; เปิดซ้ำหลัง success ใช้ผลเดิมจน refresh หรือ unmount

**Verification:**

- [ ] focused tests tests/family-section.test.tsx ตรวจ lazy request count, retries, route switch และ no relatives
- [ ] บันทึก evidence ใน verification record และอัปเดตสถานะตามผลจริง

**Dependencies:** M4-009

**Files likely touched:**

- `frontend/components/family-section.tsx`
- `frontend/hooks/use-family-graph.ts`
- `frontend/components/client-profile.tsx`
- `frontend/tests/family-section.test.tsx`

<a id="m4-014"></a>

## M4-014 — แสดง one-hop Family Graph ที่อ่านได้

**Status:** TODO  
**Scope:** M  
**Requirements:** FR-11, US-08, NFR-06, BR-10

**งาน:** วาด nodes/edges จาก API พร้อม relationship list ที่เข้าถึงด้วย keyboard ได้

**Acceptance criteria:**

- [ ] แสดง PRIMARY กับ RELATED nodes และ edges ที่ API ส่งเท่านั้น; source/target อ้าง node ที่มีอยู่, deduplicate ด้วย IDs และไม่เพิ่มชื่อ/จำนวนสมาชิกที่ backend ไม่เปิดเผย
- [ ] Relationship type หมายถึง source ต่อ target; primary เป็น target ต้องแสดงกลับ PARENT↔CHILD อย่างถูกต้อง ส่วน SPOUSE/SIBLING คงเดิม; ไม่สรุปความสัมพันธ์ทอดถัดไป
- [ ] SVG มีคำอธิบายและ HTML relationship list เป็นทางเลือกที่มีข้อมูลเท่ากัน; related node links เปิด Profile ได้ด้วย keyboard, labels ยาวไม่ทับกัน และ primary-only graph อ่านได้

**Verification:**

- [ ] focused tests tests/family-graph.test.tsx มี primary ทั้งสองด้าน, duplicate/dangling edge input safety และ filtered cross-RM fixture; manual keyboard; เชื่อม API isolation evidence ของ M3 โดยไม่อ้างว่า mock พิสูจน์ backend
- [ ] บันทึก evidence ใน verification record และอัปเดตสถานะตามผลจริง

**Dependencies:** M4-013

**Files likely touched:**

- `frontend/components/family-graph.tsx`
- `frontend/components/family-graph.module.css`
- `frontend/components/family-section.tsx`
- `frontend/tests/family-graph.test.tsx`

<a id="m4-015"></a>

## M4-015 — ป้องกันข้อมูล RM เดิมหลัง session เปลี่ยน

**Status:** TODO  
**Scope:** M  
**Requirements:** FR-01, NFR-01, US-01, US-05, US-08

**งาน:** ปิดช่อง lifecycle ระหว่าง expired session, logout, browser history และการเข้าใช้ด้วย RM อีกคน

**Acceptance criteria:**

- [ ] Protected 401 ล้าง state และยกเลิก pending list/profile/family requests ก่อนกลับ login; ใช้ session generation ปฏิเสธ response ของ RM ก่อนหน้า; login 401 ไม่เข้าวงจร global redirect
- [ ] ล้างหรือซ่อน sensitive view เมื่อ pagehide ก่อน BFCache เก็บหน้า; เมื่อ pageshow/history หรือแท็บกลับ active ให้ revalidate /me ก่อนแสดงข้อมูล; logout อีกแท็บแจ้ง invalidation ด้วย event ที่ไม่มีข้อมูล Client/token และไม่มี persistent payload cache
- [ ] Tests สลับ RM A→logout→RM B พร้อม delayed response, logout network fail และ simultaneous 401; manual browser Back/Forward/multi-tab ต้องไม่แสดงข้อมูล A หลัง identity ของ B ยืนยันแล้ว

**Verification:**

- [ ] focused tests tests/session-lifecycle.test.tsx ใช้ controlled promises/events; manual สองแท็บผ่าน Caddy; บันทึกข้อจำกัดเวลาตรวจ session ขณะ inactive
- [ ] บันทึก evidence ใน verification record และอัปเดตสถานะตามผลจริง

**Dependencies:** M4-008, M4-010, M4-012, M4-014

**Files likely touched:**

- `frontend/components/session-provider.tsx`
- `frontend/lib/api-client.ts`
- `frontend/hooks/use-client-profile.ts`
- `frontend/hooks/use-family-graph.ts`
- `frontend/tests/session-lifecycle.test.tsx`

### Checkpoint E — Family และ session lifecycle

- [ ] Graph แสดงทิศทางถูกต้องและโหลดแยก; session/RM switch ไม่รับผลเก่า; component suites และ manual browser privacy checks ผ่าน
- [ ] ทบทวนผลและ blockers ก่อนงานที่พึ่งพา; ไม่ใช้จำนวน tests หรือคะแนน audit แทน acceptance evidence

<a id="m4-016"></a>

## M4-016 — ตรวจ desktop/laptop usability และ accessibility

**Status:** TODO  
**Scope:** M  
**Requirements:** NFR-06, NFR-07; UI acceptance ของ US-01–09

**งาน:** เก็บรายละเอียดการอ่านและการใช้งานข้ามหน้าหลัง flow ครบ โดยไม่เพิ่ม product features

**Acceptance criteria:**

- [ ] ตรวจที่ viewport 1280×720 และ 1440×900 พร้อม zoom 200%; navigation/form/cards อ่านได้ ไม่มีหน้าล้นแนวนอนโดยไม่ตั้งใจ และ graph/table ที่จำเป็นต้องเลื่อนมี container กับ accessible alternative
- [ ] Keyboard เข้าถึง navigation, filters, pagination, Profile links, Family toggle และ retry ได้; focus visible/order สมเหตุผล มี labels/headings และ aria-live ของ loading/errors โดยไม่ใช้สีเป็นตัวบอกสถานะเพียงอย่างเดียว
- [ ] มี verification matrix ทุกหน้าสำหรับ loading/empty/error/incomplete ที่เกี่ยวข้อง; ตรวจ contrast ของข้อความหลัก/controls และไม่อ้าง WCAG certification จาก component tests

**Verification:**

- [ ] focused tests tests/ui-accessibility.test.tsx และ manual keyboard/zoom/viewport พร้อม evidence; frontend lint/typecheck/unit/build
- [ ] บันทึก evidence ใน verification record และอัปเดตสถานะตามผลจริง

**Dependencies:** M4-015

**Files likely touched:**

- `frontend/app/globals.css`
- `frontend/app/layout.tsx`
- `frontend/components/family-graph.module.css`
- `frontend/tests/ui-accessibility.test.tsx`
- `tasks/milestone-4/verification.md`

<a id="m4-017"></a>

## M4-017 — ตรวจรับ M4 และส่งต่อ M5

**Status:** TODO  
**Scope:** M  
**Requirements:** FR-01–12 เฉพาะ UI; NFR-04, NFR-06; handover ไป M5

**งาน:** รวมหลักฐาน UI และการใช้งานจริงที่ commit เดียวกัน พร้อมระบุช่องว่างที่ต้องยืนยันใน M5

**Acceptance criteria:**

- [ ] README อธิบาย development origin/APP_ORIGIN, db seed แบบ idempotent, test DB, การรัน frontend/backend/proxy และ commands โดยใช้ชื่อ scripts จริง; clean-checkout root checks ผ่าน ไม่มี secrets หรือ generated outputs ใน diff
- [ ] Manual browser smoke ผ่าน Caddy ครบ login→dashboard→search/filter/page→profile→family→logout; ใช้ normal seed 2 RM/30 Clients และ anomaly/cross-RM fixtures เฉพาะ isolated test environment พร้อมยืนยัน 404/expired session/incomplete display
- [ ] Verification/handover บันทึก date/full SHA/environment/commands/results และ evidence ต่อ FR/US/ticket; ไม่ปิด ticket ด้วย mock tests อย่างเดียวสำหรับ browser-cookie/Origin/ownership และไม่อ้างผ่าน M5/M6/performance/automated E2E ที่ยังไม่ทำ

**Verification:**

- [ ] root lint/typecheck/test:unit/test:integration/build ตาม plan; manual smoke และ links/diff check; ถ้า command fail ให้บันทึก BLOCKED พร้อมสาเหตุจริง
- [ ] บันทึก evidence ใน verification record และอัปเดตสถานะตามผลจริง

**Dependencies:** M4-016 และ M4-001–015 DONE

**Files likely touched:**

- `README.md`
- `tasks/milestone-4/verification.md`
- `tasks/milestone-4/handover.md`
- `tasks/milestone-4/todo.md`

### Checkpoint F — Milestone 4 acceptance

- [ ] M4-001–017 มี evidence; root checks และ Caddy smoke ผ่าน; requirements mapping และ M5 handover มีผลจริงและข้อจำกัด
- [ ] ทบทวนผลและ blockers ก่อนงานที่พึ่งพา; ไม่ใช้จำนวน tests หรือคะแนน audit แทน acceptance evidence

