# Meridian Milestone 2 Tickets

Status values: `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`. A ticket is only `DONE` when its listed verification has passing evidence.

## M2-001 — กำหนด domain contract และแก้เอกสารกฎที่ไม่ตรงกัน

**Status:** DONE

**Acceptance criteria:**
- [x] มี contracts สำหรับ evaluation input, component result, Goal result, Health result และ recommendation `{action, reason, priority, rule}`
- [x] คืนหัวข้อ BR-05 ให้หมายถึง recommendation explainability; BR-08 ยังคงหมายถึง insufficient data และเพิ่มกฎ Primary Goal ใน BR-10 พร้อมลิงก์จาก API
- [x] ระบุ required/nullable fields และชุดข้อมูลที่แต่ละ component ต้องใช้ รวมถึงกรณี field `savings` ที่เก็บใน Profile แต่ไม่ใช้ในสูตร Savings Score

**Verification:**
- [x] TypeScript check (`npm run typecheck -w @meridian/api`) passes with zero errors.
- [x] Domain contracts defined in `backend/src/domain/financial/types.ts` matching FR-07, FR-08, FR-09, FR-10, FR-12, BR-04, BR-05, BR-08, BR-10.
- [x] Business rules docs (`docs/context/04-business-rules.md` and `docs/context/05-architecture-and-data.md`) updated with explicit BR-05 explainability, BR-10 primary goal rules, and savings field clarification.

**Dependencies:** M1 schema/test harness  
**Files likely touched:**
- `backend/src/domain/financial/types.ts`
- `docs/context/04-business-rules.md`
- `docs/context/05-architecture-and-data.md`  
**Scope:** M

---

## M2-002 — สร้างตัวช่วยจำนวนเงินและวัน UTC

**Status:** DONE

**Acceptance criteria:**
- [x] อ่าน decimal string เป็นสตางค์ได้โดยไม่สูญเสียความแม่นยำ; ปฏิเสธค่าติดลบ รูปแบบผิด และค่าที่เกินขอบเขต schema
- [x] ตรวจวันที่จริง ไม่ปล่อยให้วันที่อย่าง `2026-02-30` ถูก normalize เป็นเดือนถัดไป; นับวันเหมือนกันทุก timezone รวม leap year
- [x] เปรียบเทียบเศษส่วนและปัด half-up ได้โดยไม่หารด้วยศูนย์; ไม่มี `NaN` หรือ `Infinity`

**Verification:**
- [x] Unit tests pass: `npm run test:unit -w @meridian/api -- tests/unit/financial/primitives.test.ts` (10 tests passed).
- [x] Unit cases cover `0`, `0.01`, max bounds `Decimal(18,2)`, invalid inputs, leap day (`2024-02-29`), leap century, and half-up rounding `10.005 -> 10.01`.

**Dependencies:** M2-001  
**Files likely touched:**
- `backend/src/domain/financial/money.ts`
- `backend/src/domain/financial/dates.ts`
- `backend/tests/unit/financial/primitives.test.ts`  
**Scope:** M


---

## M2-003 — คำนวณคะแนนการเงินสี่องค์ประกอบ

**Status:** DONE

**Acceptance criteria:**
- [x] คะแนนตรงตารางทุกระดับ รวมเครื่องหมาย `<`, `≤`, `>` และ `≥` โดยเปรียบเทียบค่าก่อนจัดรูปแบบแสดงผล
- [x] ตัวหารไม่เป็นบวกหรือข้อมูลขาดทำให้เฉพาะ component ที่พึ่งข้อมูลนั้นเป็น `null`; components อื่นยังคำนวณได้
- [x] Savings คำนวณจาก `(income − expense) / income`; expense มากกว่า income ได้คะแนน 0 และ field `financialProfile.savings` ไม่เปลี่ยนคะแนน

**Verification:**
- [x] Unit tests pass: `npm run test:unit -w @meridian/api -- tests/unit/financial/components.test.ts` (9 tests passed).
- [x] Table-driven tests verify below/at/above thresholds: Liquidity 1/3/6 months, Debt 20/40/60%, Savings 0/10/20%, Investment 0/10/20%.

**Dependencies:** M2-002  
**Files likely touched:**
- `backend/src/domain/financial/components.ts`
- `backend/tests/unit/financial/components.test.ts`  
**Scope:** M

---

## Checkpoint A — Foundation & Primitives
- [x] Contracts and money/date primitives verified.
- [x] Four financial components pass table-driven tests without database.


---

## M2-004 — คำนวณ Goal progress และ Goals Score

**Status:** DONE

**Acceptance criteria:**
- [x] ตรวจ target amount, current amount และช่วงวันก่อนคำนวณ; ก่อนหรือเท่ากับ start date ให้ expected amount 0, progress 1 และไม่ล่าช้า
- [x] หลังเริ่มใช้สัดส่วนวัน; เมื่อถึง/เลยกำหนดใช้ target amount เต็มจำนวน จำกัด progress ที่ 0–1 โดยไม่ปัด expected amount ก่อนเปรียบเทียบ
- [x] เฉลี่ยทุก Goal และปัดคะแนนสุดท้ายสองตำแหน่ง; ไม่มี Goal หรือมี Goal ผิดแม้หนึ่งรายการทำให้ Goals component เป็น `null` โดยไม่ทิ้งรายการนั้นออก

**Verification:**
- [x] Unit tests pass: `npm run test:unit -w @meridian/api -- tests/unit/financial/goals.test.ts` (11 tests passed).
- [x] Covers before-start, on-start zero balance, in-progress, on target date, overdue, exceeded goal, multiple goals, half-up rounding (10.005 -> 10.01), and valid/invalid mixed goals.

**Dependencies:** M2-002  
**Files likely touched:**
- `backend/src/domain/financial/goals.ts`
- `backend/tests/unit/financial/goals.test.ts`  
**Scope:** M


---

## M2-005 — รวม Health Score และ insufficient-data result

**Status:** DONE

**Acceptance criteria:**
- [x] ข้อมูลครบคืน `COMPLETE`, score เท่าผลรวม breakdown และ classification ตาม `<60`, `<80`, ที่เหลือ `GOOD`
- [x] ข้อมูลไม่ครบคืน score/classification เป็น `null`, status `INSUFFICIENT_DATA` และคง breakdown ส่วนที่คำนวณได้ โดยไม่ปรับน้ำหนักใหม่
- [x] `missingFields` ระบุทุกต้นเหตุที่ทำให้ component เป็น `null`, ไม่มีรายการซ้ำ และเรียงแบบแน่นอน; Profile หาย/Goals ว่างระบุที่ระดับ container

**Verification:**
- [x] Unit tests pass: `npm run test:unit -w @meridian/api -- tests/unit/financial/health.test.ts` (6 tests passed).
- [x] Verifies classifications at boundaries 59.99 (AT_RISK), 60 (MODERATE), 79.99 (MODERATE), 80 (GOOD), missing profile, missing fields, zero denominators, and container-level missing fields.

**Dependencies:** M2-003, M2-004  
**Files likely touched:**
- `backend/src/domain/financial/health.ts`
- `backend/tests/unit/financial/health.test.ts`  
**Scope:** M


---

## M2-006 — เลือก Primary Goal แบบ deterministic

**Status:** DONE

**Acceptance criteria:**
- [x] เลือก valid Goal ที่ยังไม่สำเร็จและ target date เร็วที่สุด; วันเสมอกันใช้ ID เรียงแบบแน่นอน
- [x] หาก valid Goals สำเร็จหมด เลือกวันครบกำหนดเร็วที่สุด; ไม่มี valid Goal คืน `null`
- [x] Goal ผิดถูกตัดออกเฉพาะการเลือก Primary Goal แต่ยังทำให้ Goals Score ไม่เพียงพอตาม M2-004

**Verification:**
- [x] Unit tests pass: `npm run test:unit -w @meridian/api -- tests/unit/financial/primary-goal.test.ts` (6 tests passed).
- [x] Tests cover no goals, all completed, tie on target date, input ordering permutation, and valid/invalid mixed goals.

**Dependencies:** M2-004  
**Files likely touched:**
- `backend/src/domain/financial/primary-goal.ts`
- `backend/tests/unit/financial/primary-goal.test.ts`  
**Scope:** S

---

## Checkpoint B — Health & Primary Goal
- [x] Consistent Health and Primary Goal results verified.
- [x] Incomplete data, pre-start goals, and overdue goals tested.


---

## M2-007 — เลือก NBA และ Priority เพียงหนึ่งรายการ

**Status:** DONE

**Acceptance criteria:**
- [x] ใช้ลำดับ insufficient → liquidity <3 → debt >60% → Goal ล่าช้าและ days remaining ≤365 → Health <60 → routine
- [x] คืน recommendation object เดียว; rule IDs ใช้ `BR-04.1` ถึง `BR-04.6` และ Priority ตามตาราง โดย insufficient data เป็น MEDIUM ตามข้อตกลงต้นแบบ
- [x] ตรวจ Goal ล่าช้าจากทุก Goal ไม่ใช่เฉพาะ Primary Goal; หากมีหลายรายการเข้าเงื่อนไขให้เหตุผลอ้างรายการที่ target date เร็วสุด แล้วใช้ ID ตัดสิน

**Verification:**
- [x] Unit tests pass: `npm run test:unit -w @meridian/api -- tests/unit/financial/recommendation.test.ts` (13 tests passed).
- [x] Tests cover all 6 rules, precedence when multiple match, boundary liquidity = 3.0, debt = 60%, Health = 60, and Goal remaining days 366/365/0/-1.

**Dependencies:** M2-005, M2-006  
**Files likely touched:**
- `backend/src/domain/financial/recommendation.ts`
- `backend/tests/unit/financial/recommendation.test.ts`  
**Scope:** M


---

## M2-008 — สร้าง Summary จากผล evaluation

**Status:** DONE

**Acceptance criteria:**
- [x] Summary มีสถานะ Health, Primary Goal เมื่อมี, ประเด็นจาก NBA reason และ action เดียวกับ recommendation
- [x] รองรับ incomplete data และไม่มี Primary Goal โดยไม่แต่งข้อมูลขึ้นและไม่แสดง `undefined` หรือ `null` เป็นข้อความ
- [x] Summary formatter ไม่เรียกคำนวณ Health/NBA ซ้ำ ไม่ query database และไม่อ่านเวลาปัจจุบัน

**Verification:**
- [x] Unit tests pass: `npm run test:unit -w @meridian/api -- tests/unit/financial/summary.test.ts` (6 tests passed).
- [x] Assertions verify key contents and data source across all 6 NBA types and incomplete scenarios without depending purely on brittle snapshots.

**Dependencies:** M2-007  
**Files likely touched:**
- `backend/src/domain/financial/summary.ts`
- `backend/tests/unit/financial/summary.test.ts`  
**Scope:** S


---

## M2-009 — รวม evaluation entrypoint และ Priority comparator

**Status:** DONE

**Acceptance criteria:**
- [x] `evaluateClient(input, asOfDate)` คืน `{health, primaryGoal, recommendation, summary, asOfDate}` จาก evaluation เดียว
- [x] ผลเหมือนเดิมเมื่อ input/วันเหมือนเดิม ไม่แก้ไข input และไม่มี database/network/clock side effects; ไม่จับ system error แล้วคืนข้อมูลไม่เพียงพอ
- [x] Comparator เรียง HIGH → MEDIUM → LOW แล้ว `customerCode` แบบ ordinal ที่ไม่ขึ้นกับ locale; ยังไม่เพิ่ม ownership, filtering หรือ pagination

**Verification:**
- [x] Unit tests pass: `npm run test:unit -w @meridian/api -- tests/unit/financial/evaluate-client.test.ts` (7 tests passed).
- [x] Tests verify idempotency, input immutability, goal order independence, customer code tie-break, and stable priority sorting.

**Dependencies:** M2-005–008  
**Files likely touched:**
- `backend/src/domain/financial/evaluate-client.ts`
- `backend/src/domain/financial/index.ts`
- `backend/tests/unit/financial/evaluate-client.test.ts`  
**Scope:** M

---

## Checkpoint C — Integrated Evaluation & Priority
- [x] Single entrypoint produces consistent Health, Primary Goal, NBA, and Summary.
- [x] Deterministic priority comparator verified and ready for Milestone 3.


---

## M2-010 — ตรวจรับ boundary matrix และส่งต่อ M3

**Status:** DONE

**Acceptance criteria:**
- [x] Matrix ครอบคลุมทุก threshold, date edge, missing field, invalid Goal, rounding, precedence และ tie-break พร้อม expected results ที่ไม่เรียก production function มาสร้างคำตอบ
- [x] มีตัวอย่างครบตั้งแต่ input ถึง Summary และมี scenario สำหรับ NBA ทั้งหกแบบ โดยระบุว่าเป็น unit fixtures ไม่ใช่ normal seed
- [x] บันทึก commit/environment/commands/results จริง พร้อมข้อจำกัด; M2 ยังไม่อ้างว่า ownership, API contract, UI หรือ deployment ผ่านแล้ว
- [x] ตัวอย่างตรวจรับที่ต้องมี: income `1000.00`, expense `800.00`, liquid assets `4800.00`, total assets `10000.00`, debt `2000.00`, investments `2000.00`; Goal target `1000.00`, current `667.00` และครบกำหนดตรง `asOfDate` โดยเริ่มก่อนหน้านั้นอย่างถูกต้อง -> ผลต้องเป็น breakdown `25 + 25 + 20 + 10.01 + 15 = 95.01`, classification `GOOD` แต่ NBA เป็น `Review Goal Funding`, Priority `MEDIUM` เพราะ Goal ยังล่าช้า

**Verification:**
- [x] Unit tests pass: `npm run test:unit -w @meridian/api -- tests/unit/financial/matrix.test.ts` (8 tests passed).
- [x] All 9 financial unit test files pass: 82 financial unit tests (primitives: 11, components: 9, goals: 14, health: 6, primary-goal: 6, recommendation: 15, summary: 6, evaluate-client: 7, matrix: 8) with 0 database dependencies. Includes exact rational half-up rounding (0.14 for 9/1000, 0.00 for 0.01/10^15), early asOfDate validation, single-pass goals evaluation across Health and NBA, near-boundary non-contradictory recommendation messages, and health classification boundary checks including 79.99 MODERATE.
- [x] All workspaces pass quality checks on 2026-09-08:
  - `npm run test:unit`: 15 test files, 97 unit tests passed across `@meridian/api` (96 tests) and `@meridian/web` (1 test).
  - `npm run lint`: 0 ESLint errors across workspaces.
  - `npm run typecheck`: 0 TypeScript compiler errors across workspaces with strict settings.
  - `npm run build`: both `@meridian/api` (TypeScript) and `@meridian/web` (Next.js Turbopack) built cleanly.
- [x] Environment: Windows host, Node `v25.2.1`, npm `11.6.2`, Vitest `v3.2.7`.
- [x] Boundary scope verified: M2 delivers pure financial calculation functions. RM ownership authorization, Express endpoints, PostgreSQL queries, pagination, normal seed, and UI views remain deferred to Milestone 3.

**Dependencies:** M2-001–009  
**Files likely touched:**
- `backend/tests/unit/financial/matrix.test.ts`
- `tasks/milestone-2/todo.md`  
**Scope:** M

