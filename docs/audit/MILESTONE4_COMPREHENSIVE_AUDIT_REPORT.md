# Meridian — Comprehensive Code Audit หลังแก้ Milestone 4

**วันที่:** 2026-09-08 (Asia/Bangkok)  
**Commit ที่ตรวจ:** `83e45adab77825ffe6b151f4e7f3da9648db4a13`  
**ผล:** **NEEDS CHANGES** — ยังไม่ควรรับรอง M4 ว่าปิดครบทุก acceptance criteria  
**ขอบเขต:** frontend, backend, financial domain, database/seed, authentication/authorization, local deployment configuration, dependencies, tests และเอกสาร M1–M4  
**การเปลี่ยนแปลงในรอบ audit:** เพิ่มรายงานนี้ไฟล์เดียว ไม่แก้โค้ดหรือสถานะ tickets

## สรุปสำหรับผู้พัฒนา

การแก้รอบล่าสุดเพิ่ม logout retry, session request sequencing, pagehide handler, Family request cleanup และ malformed-response errors ได้จริง แต่ยังเหลือ **2 High, 6 Medium และ 2 Low** ตาม findings ด้านล่าง ไม่พบ Critical จากการตรวจนี้

ประเด็นสำคัญที่สุดคือ **เมื่อ session เปลี่ยน RM หน้าที่ mount อยู่ยังสามารถแสดงข้อมูลของ RM เดิม** และ **ระหว่าง revalidate session หรือเมื่อ revalidation ล้มเหลว ข้อมูลเดิมยังแสดงอยู่** เพราะการซ่อน UI ถูกจำกัดเฉพาะกรณีไม่มี user ใน state

`npm audit --json` ที่รันครั้งนี้สำเร็จและรายงาน 0 vulnerabilities อย่างไรก็ตามผลนี้ไม่เท่ากับผ่าน Trivy image scan หรือพิสูจน์ว่าไม่มีช่องโหว่เชิง logic

## 1. วิธีตรวจและขอบเขตหลักฐาน

ใช้ skills:

- `code-review`: แยกแกน Standards กับ Spec และให้ผู้ตรวจย่อยอ่านสองแกนอย่างอิสระ
- `security-best-practices`: ใช้ JavaScript/TypeScript, Express, Next.js และ React security references สำหรับ authentication, input, browser state และ logging
- `plan-audit`: เทียบ implementation กับ acceptance criteria ใน `tasks/milestone-4/plan.md` และ `todo.md`

ยึด source requirements ใน `docs/context/`, glossary, M4 plan/todo, verification/handover และ [review เดิม](MILESTONE4_PLAN_REVIEW.json) เป็นหลัก ไม่ใช้คะแนนหรือคำว่า zero defects เป็นหลักฐานแทนพฤติกรรมของโค้ด

Git working tree สะอาดก่อนเริ่ม และ HEAD ไม่เปลี่ยนระหว่างการตรวจ การเปรียบเทียบต้องแยกดังนี้:

| Comparison | ความหมาย |
|---|---|
| `git diff 81a88a7...HEAD` | Merge-base คือ `3fb712418aeb427180f71b3957e782962be8863d`; ครอบคลุม M4 implementation 55 files ไม่ใช่เพียง fix ล่าสุด |
| `git diff 83e45ad^ 83e45ad` | การแก้ findings ล่าสุด 9 files |
| Current-tree inspection | ตรวจ backend/schema/config ที่ไม่ได้เปลี่ยนใน fix ล่าสุดด้วย |

ผู้ตรวจ Standards ส่งข้อค้นพบหลักกลับมาก่อนหยุดเนื่องจาก usage limit; ผู้ตรวจหลักอ่านและยืนยันตำแหน่งที่นำมาใช้เอง ผู้ตรวจ Spec ส่งผลครบ ไม่ถือว่าข้อจำกัดนี้เป็นผลการรันระบบ

### ผลตรวจที่รันในรอบนี้

| Check | ผลจริง |
|---|---|
| Git HEAD/status/diff และอ่าน source/tests/docs | ทำแล้ว |
| `npm audit --json` | PASS: 0 vulnerabilities; dependency metadata รวม 483 entries |
| การเรียก registry ครั้งแรก | ล้มเหลวจาก network access ใน sandbox; retry หลังได้รับอนุมัติสำเร็จ |
| Unit/component/integration tests | **ไม่ได้รันใหม่ในรอบนี้** |
| Lint/typecheck/build/clean checkout | **ไม่ได้รันใหม่ในรอบนี้** |
| Live browser, BFCache, multi-tab, accessibility/zoom | **ไม่ได้รันใหม่ในรอบนี้** |
| Trivy, Jenkins, production TLS และ load test | **ไม่ได้รัน** |

ตาม [plan-audit SKILL.md](C:/Users/teera/.agents/skills/plan-audit/SKILL.md) ข้อ “Do **not** run tests here unless the user explicitly asks; this is an inspection pass.” รอบนี้จึงตรวจ source และ coverage ของ tests พร้อมแยกผลเก่าที่เอกสารกล่าวอ้างออกจากผลรันใหม่ การไม่รัน tests ไม่ใช่ข้อสรุปว่า tests ล้มเหลว

`verification.md:612-617` ระบุ frontend 122 และ workspace 293 tests ผ่าน พร้อม lint/typecheck/build ผ่าน ข้อมูลนี้เป็น **คำรายงานของการพัฒนารอบก่อน** ซึ่งยังไม่ได้ยืนยันซ้ำใน audit นี้

## 2. Findings — เรียงตาม severity

### AUD-M4-001 — High: RM เปลี่ยน แต่ข้อมูล Client ในหน้าที่เปิดอยู่ไม่ถูกล้าง

**ตำแหน่ง:** `frontend/components/session-provider.tsx:106-111,447-458`; `frontend/components/client-list-view.tsx:48-68,100-107`; `frontend/components/morning-action-plan.tsx:44-58`; `frontend/hooks/use-client-profile.ts:95-105`  
**อ้างอิง:** M4-015, FR-01, NFR-01; ทั้ง Standards และ Spec

Provider เปลี่ยน `user`, bump generation และล้าง module Family cache เมื่อ `/me` คืน RM ใหม่ แต่ protected children ไม่มี identity key และยัง mount อยู่ List/Profile/Dashboard เก็บ payload ใน component state ของตนเอง ส่วน effects โหลดใหม่ตาม query หรือ clientId ไม่ได้ตาม identity ของ RM

**เส้นทางที่มีปัญหา:** เปิดข้อมูล Client A → cookie เปลี่ยนเป็น RM B ในอีกแท็บ → กลับแท็บเดิมให้ `/me` คืน B → header เปลี่ยนเป็น B แต่ตาราง/Profile A ยังอยู่ นอกจากนี้ List และ Dashboard ไม่ลงทะเบียน cancellation กับ session lifecycle และไม่ตรวจ captured generation จึงยังเสี่ยงรับผลที่เริ่มภายใต้ RM เดิม

**ผลกระทบ:** ข้อมูลที่โหลดก่อนหน้านี้อาจแสดงแก่ผู้ใช้ session ใหม่ เป็นปัญหา frontend privacy แม้ backend ownership ของ request ใหม่จะตรวจถูกต้อง

**แก้ไข:** ล้างหรือ remount sensitive subtree ตาม validated identity/session generation และทำให้ data requests ทุกประเภทรับรู้ session invalidation ไม่ใช่เพียง hooks ของ Profile/Family

**เกณฑ์ปิด:** test ด้วย SessionProvider ร่วมกับ List/Profile จริงที่มีข้อมูล A แล้วเปลี่ยน `/me` เป็น B ต้องไม่มีชื่อ/ยอดเงิน A ใน DOM และ delayed List/Dashboard response ของ A ต้องถูกละทิ้ง; ตรวจ multi-tab flow จริงเพิ่มเติม

### AUD-M4-002 — High: แสดงข้อมูลเดิมขณะตรวจ session ใหม่และหลังตรวจไม่สำเร็จ

**ตำแหน่ง:** `frontend/components/session-provider.tsx:91-92,127-142,366,422`  
**อ้างอิง:** M4-004, M4-015; ทั้ง Standards และ Spec

เงื่อนไข loading และ connection-error UI มี `&& !user` ดังนั้นเมื่อเคย authenticated แล้ว `refreshSession()` ที่เริ่มจาก visibilitychange จะไม่ซ่อน children ขณะรอ และถ้าได้ 503/network error ก็ไม่แสดง Retry banner เพราะ user เดิมยังอยู่ AppShell ไม่ได้นำ sessionError ไปจัดการแทน

**ผลกระทบ:** ข้อมูลที่ยังไม่ได้ยืนยันสิทธิ์สำหรับ session ปัจจุบันแสดงต่อไป และผู้ใช้ไม่มี recovery UI ตามที่ตกลงไว้

**แก้ไข:** แยก last known identity ออกจาก verified-current-session state; gate ข้อมูลทุกครั้งที่ต้อง revalidate และแสดง retry แม้เคยมี user โดยไม่ตีความ 503 เป็น 401

**เกณฑ์ปิด:** initial 200 → visibilitychange → deferred `/me` ต้องซ่อนข้อมูล; 503 ต้องมี Retry; retry 200 จึงคืน view โดยไม่ redirect login เมื่อเป็นเพียง dependency failure

### AUD-M4-003 — Medium: Family cache ยังอยู่หลัง unmount และการยกเลิกยังไม่มี invalidation ครบ

**ตำแหน่ง:** `frontend/hooks/use-family-graph.ts:12-17,53-58,82-90,150-155`  
**อ้างอิง:** M4-013, M4-015; Spec

Cache เปลี่ยนจาก Map มาเก็บหนึ่ง Client แต่ยังเป็น module state และ cleanup เพียง abort controller ไม่ล้าง cache ตามข้อตกลง “จน refresh หรือ unmount” การกลับ Client เดิมหลังออกหน้าอาจใช้ผลเดิมโดยไม่มี request ใหม่ การเขียน cache หลัง resolve ยังอาศัย sequence/clientId/generation โดย cleanup ไม่เพิ่ม sequence หรือเช็ก signal จึงควรครอบคลุมผลที่ settle หลัง cancellation ด้วย

**แก้ไข:** กำหนด lifetime ตาม hook/current view หรือ invalidate cache/request sequence เมื่อ unmount/เปลี่ยน Client โดยระวังไม่ล้าง cache ของ instance อื่นผิดตัว

**เกณฑ์ปิด:** A success → unmount → remount A ต้อง fetch ใหม่; response ของ instance ที่ยกเลิกห้ามเขียน module cache; ทดสอบ collapse/reopen และ A→B→A แยกจากกัน

### AUD-M4-004 — Medium: MIME validator ยอมรับ structured JSON แต่ body parser ไม่รับชนิดเดียวกัน

**ตำแหน่ง:** `backend/src/middleware/request-parser.ts:29-32`; `backend/src/app.ts:46`  
**อ้างอิง:** M3-002 และ API input contract; Standards/API consistency

Validator ยอมรับ `application/*+json` แต่ `express.json({limit:"16kb"})` ไม่ได้กำหนด type ให้ตรงกัน ตัวอย่าง `application/vnd.meridian+json` จึงผ่าน validator แต่ body ไม่ถูก parse ตามที่ route คาด และ login schema อาจคืน 400 แทนการประมวลผล JSON ที่ประกาศว่ารองรับ

**แก้ไข:** ตั้ง media types ของ validator และ parser เป็นชุดเดียวกัน หรือจำกัด contract เป็น `application/json` อย่างชัดเจน

**เกณฑ์ปิด:** request body เดียวกันกับ JSON, JSON+charset และ structured suffix ที่ประกาศรองรับต้องผ่าน parser และ validation อย่างสอดคล้อง; lookalike MIME ยังคืน 415 รอบนี้ข้อค้นพบเป็น inspection ไม่ใช่ผล replay HTTP

### AUD-M4-005 — Medium: Browser logout ยังรับ 200 JSON เป็นการยืนยันว่า cookie ถูกล้าง

**ตำแหน่ง:** `frontend/lib/api-client.ts:119-127,187-207`; `frontend/components/session-provider.tsx:231-236`  
**อ้างอิง:** M4-002, M4-004; Standards/contract

การแก้ล่าสุดจำกัด 204 ให้ logout ได้แล้ว แต่ทาง `response.ok` ทั่วไปยังยอมรับ `200 {}` จาก logout และ resolve สำเร็จ ทำให้ provider broadcast logout/redirect โดยไม่ได้รับ 204 ตามที่ contract กำหนด Backend ปัจจุบันส่ง 204 ถูกต้อง ปัญหานี้เป็นการป้องกัน protocol drift/fault ของ consumer

**แก้ไข:** กำหนด expected status ของ endpoint; logout ต้อง reject non-204 และเข้าสู่ retry state

**เกณฑ์ปิด:** logout 200 JSON → INVALID_RESPONSE/Sign Out Incomplete โดยไม่มี broadcast; logout 204 → terminate session ตามเดิม

### AUD-M4-006 — Medium: UI เติมหน่วยบาททั้งที่ wire contract ไม่ระบุ currency

**ตำแหน่ง:** `frontend/lib/display-format.ts:41`; consumers ใน `frontend/components/financial-details.tsx`  
**อ้างอิง:** M4-010 และ Presentation ใน M4 plan; Spec

Formatter เติม `฿` ให้ทุกจำนวนเงิน ขัดกับแผนที่ระบุ “ไม่เติม currency symbol เมื่อ contract ไม่ระบุหน่วย” ทำให้ UI เพิ่มความหมายทางข้อมูลเอง แม้การจัดกลุ่มหลักด้วย string จะรักษาความแม่นยำได้ดี

**แก้ไข:** แสดง decimal ที่จัดรูปแบบโดยไม่มี symbol หรือเพิ่ม currency contract ที่ตกลงและส่งจาก source จริงก่อนใช้หน่วยเงิน

**เกณฑ์ปิด:** typed fixture ที่ไม่มี currency ต้องไม่มี symbol; zero/null/จำนวนใหญ่ยังแยกถูกต้อง และแก้ tests ที่รับรอง symbol โดยไม่มี contract ด้วย

### AUD-M4-007 — Medium: ปิด M4 ทั้งที่ manual/clean-checkout acceptance ยังถูกเลื่อนไป M5

**ตำแหน่ง:** `tasks/milestone-4/todo.md:516-534`; `tasks/milestone-4/verification.md:586-619`; `tasks/milestone-4/handover.md:95-109`  
**อ้างอิง:** M4-017; Spec/evidence

Verification ยังคงติ๊ก Checkpoint F และสรุป PASSED/COMPLETED พร้อม zero deferred items แต่ส่วนแก้ M4-R07 ระบุว่าจอง live multi-browser acceptance ไว้ M5 ไม่มี final clean-checkout/browser record ที่ผูก full tested SHA และผลแต่ละ case ครบตามเกณฑ์ M4

Handover ยังเพิ่ม production orchestration/TLS/CI/CD เป็นงาน M5 ทั้งที่ roadmap ให้ M6 รับผิดชอบ และใช้ “arbitrary/unknown UUID” เป็นทางเลือกของ cross-RM case ซึ่งไม่พิสูจน์ว่า Client ที่มีอยู่ของ RM อื่นถูกป้องกัน

**แก้ไข:** แยก component verification ออกจาก final acceptance, ระบุ pending checks ตามจริง หรือทำ checks ที่ตกลงแล้วให้ครบ; ใช้ UUID ที่ยืนยันว่ามีอยู่ของ RM B ใน negative case และคืน scope M5/M6 ตาม roadmap

**เกณฑ์ปิด:** record มี date/full SHA/environment/commands/outcomes/artifacts สำหรับ clean checkout, Caddy cookie/Origin, cross-RM, expired session และ BFCache; ไม่อ้าง zero defects/closed เมื่อยังมี acceptance pending

### AUD-M4-008 — Medium: Health ที่คำนวณไม่ได้ถูกประกาศเป็นศูนย์แก่ assistive technology

**ตำแหน่ง:** `frontend/components/health-panel.tsx:205-210`  
**อ้างอิง:** M4-011, M4-016, US-15, NFR-06/07; Standards/accessibility

Progressbar ใช้ `aria-valuenow={rawVal ?? 0}` ทำให้ component ที่เป็น null ถูกส่งเป็นค่าศูนย์ใน accessibility tree แม้ข้อความข้าง ๆ จะบอก Not available ขัดความหมาย insufficient data และหลักที่ null ไม่เท่ากับ 0

**แก้ไข:** ไม่ใช้ determinate numeric progressbar เมื่อข้อมูลไม่พอ หรือให้ accessible text ระบุ unavailable โดยไม่ประกาศ numeric zero

**เกณฑ์ปิด:** null component ไม่มี numeric value 0 ใน accessible semantics; score 0 จริงยังประกาศ 0; ตรวจทั้ง DOM assertions และ screen reader/accessible tree ตามความเหมาะสม

### AUD-M4-009 — Low: Abort/timeout ระหว่างอ่าน response body ถูกเปลี่ยนเป็น INVALID_RESPONSE

**ตำแหน่ง:** `frontend/lib/api-client.ts:195-214`  
**อ้างอิง:** M4-002; Standards/error classification

Catch ของ `response.json()` เปลี่ยนทุก error เป็น ApiClientError(INVALID_RESPONSE) ก่อน outer catch ตรวจ timeout/caller abort ทำให้ยกเลิกระหว่าง body stream สูญเสีย isAbort/isTimeout ต่างจากยกเลิกก่อน headers

**แก้ไข:** แยก abort/timeout ออกจาก JSON syntax failure ก่อน wrap เป็น protocol error

**เกณฑ์ปิด:** response ที่คืน headers แล้วค้าง body: caller abort ต้องเป็น isAbort และ timeout ต้องเป็น isTimeout; JSON เสียจริงยังเป็น INVALID_RESPONSE

### AUD-M4-010 — Low: Shutdown deadline ถูกยกเลิกก่อน disconnect database เสร็จ

**ตำแหน่ง:** `backend/src/server.ts:88-104`  
**อ้างอิง:** M1 lifecycle / operational reliability; Standards

Callback ของ server.close ล้าง forceTimeout ก่อน await prisma.$disconnect หาก disconnect ค้าง process ไม่มี deadline 5 วินาทีตามที่ตั้งใจไว้ ทำให้ restart/deploy อาจต้องพึ่ง external kill timeout

**แก้ไข:** คง force timer จน shutdown ทุก dependency เสร็จ หรือกำหนด bounded disconnect แยก

**เกณฑ์ปิด:** จำลอง disconnect ที่ไม่ resolve แล้ว process shutdown ยังมีขอบเขตเวลา พร้อมรักษา exit status; ไม่จำเป็นต้องทำ destructive process test บน development instance

## 3. Standards review

จากการตรวจ source พบข้อค้นพบในแกน Standards ได้แก่ AUD-M4-001, 002, 004, 005, 008, 009 และ 010 รวม **7 รายการ**; severity สูงสุด High จาก session privacy

จุดที่สอดคล้องกับมาตรฐาน:

- Backend แยก routes/controllers/services/repositories; financial domain ไม่ต้องพึ่ง HTTP/database เพื่อคำนวณ
- RM ownership อยู่ใน repository/controller ของ API ไม่ได้อาศัยการซ่อน UI
- ใช้ JWT algorithm allowlist HS256, issuer/audience และ user existence/role lookup; cookie เป็น HttpOnly และ production Secure
- Exact Origin guard ครอบคลุม mutation methods; API มี no-store และ Helmet
- Prisma ใช้ Decimal/date-only, FK/indexes และ migrations สำหรับ constraints; normal seed เป็น transaction และตรวจ catalogue ก่อน persist
- Frontend ไม่ import runtime Express/Prisma เข้า bundle และ Summary ใช้ text rendering; ไม่พบ unsafe HTML sink จากการค้นที่ตรวจ
- Decimal display จัดกลุ่มหลักแบบ string ไม่แปลงจำนวนเงินทั้งหมดเป็น floating-point

Heuristics ที่ควรติดตามแต่ไม่จัดเป็น blocker: session-provider มีหลาย responsibility และ presentation จำนวนมากในไฟล์เดียว; API contracts ฝั่ง frontend เป็น definitions ซ้ำแทน type-only re-export จึงเสี่ยง drift หาก schema เปลี่ยน ควรมี shared contract/type parity check ก่อนเพิ่ม fields ไม่ถือว่าการมีไฟล์ใหญ่หรือ interface ซ้ำเพียงอย่างเดียวเป็น defect ที่พิสูจน์แล้ว

## 4. Spec review และ Plan Gaps Summary

ข้อค้นพบในแกน Spec ได้แก่ AUD-M4-001, 002, 003, 006 และ 007 รวม **5 รายการ**; severity สูงสุด High จาก session identity/revalidation รายการบางข้ออยู่ทั้งสองแกนจึงไม่บวกจำนวนสองแกนเป็นจำนวน findings รวม

| Tickets | สถานะจาก inspection | ช่องว่าง |
|---|---|---|
| M4-001 | หลักฐาน baseline มี แต่ไม่ใช่ current execution | ไม่ยืนยัน root checks ล่าสุดด้วยการอ่านรายงานอย่างเดียว |
| M4-002 | Partial | expected logout status และ abort ระหว่าง body parse |
| M4-003 | ไม่พบ blocker ใหม่ใน flow ที่อ่าน | live cookie/Origin acceptance ยังต้องมีผลจริง |
| M4-004 | Partial | revalidation ขณะมี user ไม่ซ่อนข้อมูล/ไม่มี Retry banner |
| M4-005–008 | UI paths มี | List/Dashboard ไม่ผูก session invalidation ครบ |
| M4-009 | Snapshot path มี | loaded state ไม่ถูก reset เมื่อ RM เปลี่ยนแต่ Client ID เดิม |
| M4-010 | Partial | เติม currency โดยไม่มี contract |
| M4-011 | Partial | nullable component ถูกสื่อเป็น zero ใน ARIA |
| M4-012 | ไม่พบ blocker ใหม่ใน rendering ที่อ่าน | มี Summary/NBA จาก snapshot; ยังไม่ใช่ผล end-to-end ใหม่ |
| M4-013–014 | Partial | Family cache lifetime; graph directions/layout code มีแต่ไม่ตรวจ browser รอบนี้ |
| M4-015 | ยังปิดไม่ได้ | identity switch, revalidation privacy และ tests ของ mounted data |
| M4-016 | Partial evidence | static accessibility coverage ไม่เท่ากับ keyboard/zoom/screen-reader proof |
| M4-017 | ยังปิดไม่ได้ | final clean-checkout/Caddy/manual evidence และ scope mapping |

### สถานะ findings จาก review เดิม

| Finding เดิม | ผล inspection หลังแก้ |
|---|---|
| M4-R01 | Network-failed logout มี retry แล้ว; ยังต้องเข้มงวด expected 204 ตาม AUD-M4-005 |
| M4-R02 | getMe sequence/generation guards เพิ่มแล้ว; loaded data across identity ยังมี AUD-M4-001 |
| M4-R03 | Initial /me 503 มี retry; เมื่อมี user เดิมยังมี AUD-M4-002 |
| M4-R04 | pagehide handler เพิ่มแล้ว; ยังไม่มี live browser proof ว่า DOM ถูกปิดก่อน BFCache snapshot ทุกกรณี |
| M4-R05 | เพิ่ม abort/sequence และ single-client cache; lifetime ยัง partial ตาม AUD-M4-003 |
| M4-R06 | HTML 200/malformed JSON/GET 204 ถูกจัด error แล้ว; body-stream abort และ expected logout status ยังไม่ครบ |
| M4-R07 | ยังเปิดตาม AUD-M4-007; เปลี่ยนเอกสารเป็น defer ไม่ใช่ทำ acceptance เดิมสำเร็จ |
| M4-R08 | UUID link/port/summary ดีขึ้น; cross-RM example และ M5/M6 scope ยังต้องปรับ |

## 5. Test Coverage Gaps

ลำดับเพิ่ม regression tests ที่ให้หลักฐานตรงกับความเสี่ยง:

1. Mount SessionProvider กับ ClientList/Profile ที่โหลดข้อมูล A แล้วเปลี่ยน /me เป็น B: ตรวจ payload ใน DOM ไม่ใช่ตรวจชื่อ user/generation เท่านั้น
2. List/Dashboard response ที่มาหลัง session invalidation ต้องไม่ commit state
3. เคย login สำเร็จแล้ว revalidate pending/503 ต้องซ่อนข้อมูลและมี Retry
4. Family success→unmount→remount และ response หลัง unmount ไม่ปน cache
5. JSON suffix content-type วิ่งผ่านทั้ง validator/parser/controller
6. Logout 200 JSON ต้องไม่ broadcast success; logout 204 ต้องผ่าน
7. Abort/timeout หลัง response headers แต่ก่อน body เสร็จ
8. Health null accessibility ต่างจาก numeric zero
9. Currency formatting ตาม contract และ bounded shutdown
10. Live Caddy multi-tab/RM switch/BFCache, clean-checkout และ viewport/zoom outcomes ที่มี tested SHA

Tests ที่เพิ่มใน fix ล่าสุดครอบคลุม production getMe sequencing, logout retry, initial /me503, pagehide event, Family out-of-order และ JSON syntax failures มากขึ้น แต่การมี test name ตรง finding ยังไม่พิสูจน์ nested component state หรือ browser lifecycle ที่ไม่ได้ถูก mount ใน test

## 6. พื้นที่อื่นที่ตรวจและข้อจำกัด

| มิติ | ข้อสังเกต |
|---|---|
| Financial rules | อ่าน Goal date validation, before-start branch, rational comparisons, final rounding, insufficient aggregation และ NBA precedence; ไม่พบ blocker ใหม่ในเส้นทางที่ตรวจ ไม่ได้รัน boundary suite ซ้ำ |
| Database integrity | มี schema/migrations และ seed validation; ไม่ได้ apply migrations หรือเปลี่ยนข้อมูล |
| Authentication | Cookie/JWT/Origin design สอดคล้องขอบเขตส่วนใหญ่; no refresh/revocation เป็นข้อเลือกที่ตกลงไว้ ไม่ใช่ finding ใหม่ |
| Authorization | Repository ใช้ rmId และ Family ตรวจ related ownership; ไม่พบหลักฐาน backend IDOR ใหม่ แต่ frontend state privacy เป็นคนละ boundary |
| Dependency security | npm registry audit 0 ณ เวลาตรวจ; ไม่ครอบคลุม image OS packages, unknown advisories หรือ design flaws |
| Performance | Batch loading และ in-memory filtering เหมาะกับ seed ขนาด 30 ตามแผน; ไม่มี latency/peak RAM/OOM measurement ใหม่ |
| Accessibility | Semantic headings, focus styling, text badges และ alternative relationship list มี; พบ nullable ARIA issue; ไม่รับรอง WCAG conformance ทั้งระบบ |
| Operations | Compose เป็น local PostgreSQL/Caddy, ports ของ containers bind loopback; API bind ทุก interface เพื่อ host/container topology ต้องตรวจ firewall/production exposure ใน M6 |
| Logging/secrets | ไม่พิมพ์ .env ระหว่าง audit; ไม่พบ tracked .env จาก worktree inventory การมี default synthetic credentials ไม่ใช่ credential leak ของ production; raw-error sanitization ยังควรใช้ allowlist ในขั้น hardening |
| DevSecOps | Jenkins/production container pipeline เป็น M6; ไม่ถือว่าขาดใน M4 เป็น implementation defect แต่ห้ามย้าย scope โดยไม่บันทึก |

## 7. แผนปิดประเด็น

1. แก้ AUD-M4-001/002 ก่อน เพื่อป้องกัน state ข้าม RM และกั้นข้อมูลระหว่าง revalidation
2. แก้ Family lifecycle และ API expected-status/media-type contracts
3. แก้ currency/ARIA semantics และเพิ่ม regression tests ที่ใช้ components จริงร่วมกัน
4. รัน root checks และ live browser acceptance ที่กำหนดไว้ พร้อม evidence ของ tested SHA
5. ปรับ verification/handover และคง M5/M6 scope ตาม roadmap; ปิดแต่ละ finding เมื่อมีผลตรวจของกรณีที่ระบุ

รายงานนี้ไม่แก้ code/tests/plan และไม่ยืนยัน application tests ที่ไม่ได้รัน ผลตรวจครั้งนี้เพียงพอที่จะระบุข้อแก้ไขที่ทำได้จริง แต่ไม่ใช่ใบรับรองความปลอดภัยหรือความพร้อม production

