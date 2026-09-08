# Meridian Milestone 5 — Plan Reviewer Report

**วันที่:** 2026-09-09  
**Reviewed HEAD:** `cf36075f4f0096f57475488caa85728aa44e108a`  
**Baseline:** `c4528cffafaa08a48504024d1c31a0b37bd39bc2`  
**Verdict:** **needs_changes**  
**ขอบเขต:** งาน M5-001–014, E2E runner/specs, API test wiring และ acceptance evidence  
**Skill:** `plan-reviewer`; รายงานนี้เป็น local review ไม่ได้ claim หรือ submit gate ใน PlanWeave runtime

```json
{
  "reviewBlockRef": "M5#R-FINAL",
  "taskId": "M5",
  "verdict": "needs_changes"
}
```

## สรุป

มี Playwright suite และ isolated services จริง แต่ยังยืนยัน M5 ว่า DONE ครบไม่ได้ พบ **4 P1 และ 5 P2** โดยปัญหาหลักคือ fresh-database startup, ความตรงกันระหว่าง source/build ที่ทดสอบ, การเปลี่ยน security settings ใน E2E และหลักฐาน clean-checkout ที่อ้าง commit ก่อนมี implementation ของ M5

การ discover tests สำเร็จ: **29 tests ใน 9 files** ไม่ใช่ 8 files ตาม verification record ผลนี้เป็นเพียง test discovery ไม่ใช่ผล execute tests

## Findings

[P1] **M5-R01 — Launcher ไม่ apply migrations ก่อน reset/seed database ว่าง** — `e2e/support/stack-launcher.ts:53-61`, `e2e/support/seed-e2e.ts:18-28`; M5-003/004/013. Launcher สั่ง Compose up แล้วเรียก resetE2EDatabase ซึ่งเริ่ม deleteMany ทันที ไม่มีขั้น database readiness retry และไม่มี migration deploy ใน startup path เมื่อใช้ volume ใหม่ที่ไม่มี tables จะไม่เริ่มได้ แม้ environment ที่มี schema อยู่แล้วจะผ่าน แก้ลำดับให้ตรวจ database readiness/identity → apply committed migrations → seed ก่อนเปิด API โดยทุก failure ต้อง cleanup resources ของ run นี้ **เกณฑ์ปิด:** fresh isolated E2E volume เปิดได้โดยไม่ใช้ manual migration และ run ซ้ำได้; wrong target ถูกปฏิเสธก่อน mutation

[P1] **M5-R02 — Runner ไม่พิสูจน์ว่า frontend ที่รับ traffic คือ build ของ checkout ปัจจุบัน** — `e2e/support/stack-launcher.ts:16-20,68-110,125-143`; M5-004/005/013. Runner ใช้ next start กับ .next ที่มีอยู่ โดยไม่ build หรือ validate build SHA; readiness ตรวจ version เฉพาะ API และตรวจเว็บเพียง HTTP success นอกจากนี้ไม่มี port-ownership preflight/child-exit gate จึงอาจยอมรับ server เก่าที่ฟังอยู่หาก child ใหม่ bind ไม่ได้ Git lookup ล้มเหลวยัง fallback เป็น SHA เก่า ทำให้หลักฐานผ่านไม่ยืนยัน current implementation **แก้:** build ก่อน suite หรือ validate build manifest ที่ผูก SHA/source fingerprint; fail เมื่ออ่าน SHA ไม่ได้หรือ ports ถูกครอบครอง; readiness ต้องยืนยัน instance ของ run นี้และ child ยังมีชีวิต **เกณฑ์ปิด:** stale .next, occupied port และ invalid Git context ต้อง fail อย่างชัดเจน ไม่ผ่านด้วย server เก่า

[P1] **M5-R03 — E2E เปลี่ยน login limiter เป็น 1,000 ครั้ง** — `backend/src/e2e-server.ts:28-32`; M5-006 และข้อตกลงไม่เปลี่ยน limiter เพื่อให้ suite ผ่าน. Server ที่ browser ทดสอบ inject `max:1000` แทน 5 ต่อ 60 วินาที แม้ Supertest จะตรวจค่า default ถูกต้อง ก็ไม่พิสูจน์ limiter ของ live Caddy stack เดียวกัน **แก้:** รักษา policy จริง จัด lifecycle ของ isolated API/limiter state หรือจังหวะ login ของ tests ให้ไม่ชน budget และมี negative test ผ่าน Caddy จริง **เกณฑ์ปิด:** 5 attempts ภายใน window เดียวผ่านขั้น limiter และครั้งที่ 6 ได้ 429 พร้อม Retry-After; normal suite รันได้ด้วยค่าเดียวกับแอป

[P1] **M5-R04 — Final verification ไม่ผูกกับ implementation ที่อ้างว่าผ่าน** — `tasks/milestone-5/verification.md:308-327`; M5-013/014. Clean-checkout evidence ระบุ tested SHA `c4528cf` ซึ่งเป็น baseline ก่อน commit M5 และยังไม่มี E2E suite นี้ใน checkout นั้น จึงอ้างว่า clean checkout ของ SHA นั้นรัน M5 ครบไม่ได้ หากรันกับ uncommitted changes ต้องบันทึก source/diff identity แทนการกล่าวว่า clean SHA นอกจากนี้บันทึก sentinel query ใช้ table `RelationshipManager` แต่ Prisma model map RM ไป `users`, และ suite ระบุ 8 files แต่ discovery พบ 9 **แก้:** รันจาก committed M5 checkout จริงและบันทึก commands/exit codes/log artifacts ทั้งสองรอบ; ใช้ sentinel ที่ตรง schema พร้อมค่าก่อนและหลัง ไม่ใช่เพียงจำนวน RM **เกณฑ์ปิด:** evidence ทุกชุดย้อนกลับไปยัง source ที่มี tests นั้นจริงและตรวจซ้ำตามขั้นตอนได้ ไม่มีตัวเลข/คำสั่งที่อธิบายกับ repo ไม่ได้

[P2] **M5-R05 — Stack cleanup และ readiness timeout ยังไม่ครอบคลุมทุก failure** — `e2e/support/stack-launcher.ts:25-46,48-146,150-181`; M5-004/011/013. Startup ไม่มี try/finally ครอบคลุม reset, spawn และ Compose ทุกขั้น; cleanup เรียก kill แต่ไม่ await process exit และ stop caddy-e2e โดยไม่บันทึกว่า service นั้นเป็นของ run นี้ ขณะที่ postgres-e2e ที่ runner เปิดยังอยู่ fetch ใน polling ไม่มี per-request timeout จึงอาจเกิน deadline ถ้า connection/body ค้าง **แก้:** tracked resource ownership, outer failure cleanup, bounded fetch, await shutdown และไม่หยุด resources ที่มีมาก่อนโดยไม่มีสิทธิ์ **เกณฑ์ปิด:** จงใจ fail หลังแต่ละ startup step และยกเลิก suite แล้วไม่มี child processes ของ run ค้าง; services ที่มีอยู่ก่อนยังอยู่และ readiness มีเวลาสูงสุดจริง

[P2] **M5-R06 — ไม่มี real database outage/recovery test ตาม ticket** — `e2e/failure-recovery.spec.ts:47-147`; M5-011. Cases ปัจจุบันใช้ page.route.fulfill เพื่อส่ง 503 ซึ่งตรวจ UI ได้ แต่ไม่ได้หยุด PostgreSQL หรือพิสูจน์ว่า /health และ authenticated API คืน 503 จาก dependency จริงแล้วฟื้นเป็น 200 ได้ ทั้งสองประเภทจำเป็นต้องแยกตามแผน **แก้:** เพิ่ม isolated database stop/start case พร้อม finally restoration และตรวจ readiness/API recovery; คง fault-injection cases แต่ตั้งชื่อ/หลักฐานว่า simulated **เกณฑ์ปิด:** มีผลจริง 200→DB unavailable→503→DB ready→200 บน E2E stack โดยไม่แตะ dev/integration DB

[P2] **M5-R07 — Session/BFCache tests ยังไม่กระตุ้นกรณีที่เคยมี bug** — `e2e/session-lifecycle.spec.ts:9-42,125-155`; M5-010. RM-switch case logout แล้ว login และ page.goto ใหม่ จึงทิ้งหน้าเดิมอยู่แล้ว ไม่พิสูจน์ state ของ List/Profile/Family ที่ยัง mount เมื่อ /me เปลี่ยน identity และไม่มี delayed responses ที่ควบคุมลำดับ ส่วน Back test ไม่ตรวจ pageshow.persisted จึงพิสูจน์ Back-navigation protection ได้ แต่ยังไม่พิสูจน์ BFCache **แก้:** เปลี่ยน session ใน shared context/อีกแท็บขณะหน้าหลักยังเปิดและมี pending request ตรวจว่า DOM เก่าถูกล้าง; บันทึก persisted event สำหรับ BFCache และระบุ unverified เมื่อไม่เกิดจริง **เกณฑ์ปิด:** ตรวจ loaded และ delayed data ทุก view ตาม M5-010 และไม่ใช้ Back test ธรรมดาแทน BFCache evidence

[P2] **M5-R08 — Performance/zoom evidence ไม่ตรงวิธีวัดที่ตกลง** — `e2e/usability-performance.spec.ts:29-33,68-78,95-99,133-150`; M5-012. APIs เก็บ 30 samples แต่ page navigation เก็บ 10 และไม่มี page warm-up 5 รอบ ขณะที่ report samplesCount=30 ใช้ร่วมกันทั้งหมด “200% Zoom Emulation” เป็นเพียง viewport 640×480 และตรวจแค่ /clients จึงไม่ใช่ browser zoom จริงของทุก view Keyboard case เริ่มด้วย direct focus และเดินเพียงสอง controls **แก้:** เก็บ sample count/warm-up แยก metric ให้ตรงแผน, เก็บ raw measurements; เรียก viewport case ว่า reflow และเพิ่ม manual/browser zoom evidence ของหน้าที่กำหนด พร้อม keyboard flow ครบ **เกณฑ์ปิด:** 30 samples ต่อ flow หลัง warm-up5 และรายงาน zoom/reflow ตามสิ่งที่ตรวจจริง ไม่เหมารวมผลเดียวกับทุกหน้า

[P2] **M5-R09 — Acceptance matrix และ tickets มี contract drift/coverage เกิน assertions** — `tasks/milestone-5/todo.md` หัวข้อ M5-007, `tasks/milestone-5/acceptance-matrix.md` หัวข้อ Audit Findings Mapping และ `e2e/client-profile.spec.ts:45-90`; M5-002/007/008/014. Ticket ใช้ Health `NEUTRAL` แทน `MODERATE` และกล่าวว่าเรียงตามวันที่/urgency หลัง Priority แทน customerCode ตามกฎเดิม Matrix ยังลดความหมาย AUD-M4-007 จาก final-evidence gap เหลือการขาดตัวอย่าง UUID และอ้าง UUID c000... ซึ่งไม่ใช่ seed UUID ปัจจุบันที่ helper สร้างเป็น 00000000-0000-4000-8000-... Profile test ตรวจการมองเห็น breakdown และ summary length มากกว่าตรวจค่าคะแนน/primary goal/Health–NBA–Summary consistency ตามที่ matrix อ้าง **แก้:** คืน contract และ finding meaning ตาม source หลัก; map ไป assertion จริงและเพิ่ม expected values จาก independent fixture หรือชี้ backend test ที่ตรวจค่าจริงอย่างเจาะจง **เกณฑ์ปิด:** ทุก PASS มี assertion ที่พิสูจน์ requirement นั้นจริงและไม่มี enum/order/UUID ขัด source

## สถานะที่แนะนำต่อ tickets

| Tickets | ผล review |
|---|---|
| M5-001 | Baseline record มี แต่ใช้แทน final M5 execution ไม่ได้ |
| M5-002 | needs_changes: contract/coverage mapping |
| M5-003–005 | needs_changes: migrations, fresh startup, current build, ownership/cleanup |
| M5-006 | needs_changes: live limiter policy ต่างจากแอป |
| M5-007–009 | มี E2E paths จริง; mapping/financial oracle ต้องเสริมก่อนรับรองครบ |
| M5-010 | needs_changes: mounted state race และ BFCache proof |
| M5-011 | needs_changes: real dependency recovery |
| M5-012 | needs_changes: sample methodology และ usability evidence |
| M5-013–014 | needs_changes: final tested source/clean checkout/traceability |

ตารางนี้เป็น feedback ไม่ได้แก้สถานะ DONE ในไฟล์งานของผู้พัฒนา แก้ runner/fidelity ก่อนรันใหม่ จากนั้นเพิ่ม missing scenarios และอัปเดต verification/matrix ด้วยผลจริง

## Verification

- อ่าน `C:/Users/teera/.agents/skills/plan-reviewer/SKILL.md`
- ตรวจ Git HEAD `cf36075f4f0096f57475488caa85728aa44e108a`, log และ working tree สะอาดก่อนสร้างรายงาน
- อ่าน M5 plan/todo/verification/acceptance-matrix, Playwright configuration, global setup/teardown, E2E stack launcher, DB guards/reset/fixtures, e2e-server และ scenario sources ที่อ้างใน findings
- เทียบ seed UUID generator ใน `backend/src/seed/catalogue.ts:25` กับเอกสาร และตรวจ schema/command wiring ที่เกี่ยวข้อง
- รัน `npx playwright test --list`: exit 0, **29 tests ใน 9 files**; คำสั่งนี้ discover tests เท่านั้น ไม่ได้รัน global setup หรือ browser suite
- ไม่รัน full E2E เพราะ startup มี reset database และ service lifecycle; รอบ review นี้ไม่มีการเปลี่ยน database, start/stop infrastructure หรือซ่อม runtime
- ไม่รัน lint/typecheck/build/integration/npm audit ใหม่ จึงไม่รับรองผลเดิมว่าเป็นผลของ HEAD ปัจจุบัน
- Findings เป็น source/evidence review ไม่ใช่การกล่าวว่าทุก test ล้มเหลวจริง และไม่ได้สรุปว่าหลักฐานเดิมถูกสร้างอย่างไรเมื่อไม่มี logs รองรับ
- เขียนรายงานไฟล์เดียว ไม่แก้ implementation, plan, tickets หรือ acceptance criteria

