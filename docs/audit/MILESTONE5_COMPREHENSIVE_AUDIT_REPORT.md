# Meridian — Current Code Audit หลังแก้ Milestone 5

วันที่ตรวจ: 2026-09-09 • ผล: **NEEDS_CHANGES**

ตรวจ source ปัจจุบันที่ commit `15e5b901392f1edb6ea1b05fc68eae19b129a5da` โดย working tree สะอาดก่อนตรวจ พบ **3 High และ 6 Medium** ส่วนใหญ่เป็นความน่าเชื่อถือของ acceptance tests และการจัดการ E2E environment ยังไม่ใช่หลักฐานว่าระบบ production ถูกเจาะหรือข้อมูลข้าม RM รั่วจริง

ใช้ skills `plan-audit` และ `security-best-practices` ตรวจ implementation เทียบแผน M5 พร้อมทบทวน domain, data, authentication, ownership, frontend lifecycle, tooling, isolation, performance และเอกสารส่งมอบ รายงานนี้แยกการอ่านโค้ดออกจากผล runtime และไม่รับรองว่าไม่มีข้อผิดพลาดอื่น

## Findings (ordered by severity)

### AUD-M5-001 — High: E2E ใช้ frontend build เก่าได้

- **หลักฐาน:** `e2e/support/stack-launcher.ts:69` ตรวจเพียงว่ามี `.next/BUILD_ID` ก่อนตัดสินใจ build; `:21` ยอมรับ APP_VERSION จาก environment โดยไม่เทียบ checkout
- **งานที่เกี่ยวข้อง:** M5-004, M5-012, M5-013
- **ผลกระทบ:** หลังแก้ frontend แล้วรัน E2E สามารถได้ผลผ่านจาก build ก่อนแก้ ขณะที่ API รายงาน SHA ปัจจุบัน การตรวจ `/health` จึงไม่ได้พิสูจน์ version ของเว็บ
- **แก้ไข:** build ใหม่ก่อน acceptance หรือใช้ fingerprint ที่รวม source/config/lockfile และตรวจ artifact provenance; ตรวจ SHA กับ checkout และบันทึก dirty state ไม่ยอมรับ arbitrary version เป็นหลักฐาน
- **เกณฑ์ปิด:** สร้าง build A แล้วเปลี่ยน source เป็น B โดยไม่ลบ `.next`; runner ต้อง rebuild หรือปฏิเสธ A และรายงาน version/fingerprint ของทั้งเว็บและ API ที่ตรวจจริง

### AUD-M5-002 — High: Race test ไม่ได้ส่ง response เก่าของ RM 1 หลังเปลี่ยนเป็น RM 2

- **หลักฐาน:** `e2e/session-lifecycle.spec.ts:36` เปลี่ยน cookie เป็น RM 2 ที่ `:58` แล้วจึง `page.goto` ที่ `:61`; route ที่ delay ใช้ `continue()` จึงเป็น request ภายใต้ session ใหม่ ไม่ใช่ response 200 ของ RM 1 ที่ค้างอยู่ ส่วน test แรกใช้ logout และ full navigation
- **งานที่เกี่ยวข้อง:** M5-010, M5-014; regression AUD-M4-001
- **ผลกระทบ:** test ผ่านได้แม้กลไกทิ้ง response เก่าเสีย เพราะ full navigation ทำลาย state เดิม และ server ตอบ 404 ให้ RM 2 อยู่แล้ว ไม่ได้พิสูจน์ keyed remount/session-generation guard
- **แก้ไข:** จับ response ที่ยืนยันว่าเป็นข้อมูล RM 1 ก่อน switch ใช้ barrier ให้ request ค้างจริง เปลี่ยน session และ revalidate ใน document เดิม แล้วปล่อย response เก่าทีหลัง
- **เกณฑ์ปิด:** พิสูจน์ document เดิมยังอยู่, response เก่ามีข้อมูล RM 1, ข้อมูลนั้นไม่ mount หลัง switch และ regression test ต้องจับการถอด guard ได้

### AUD-M5-003 — High: Pagination fixture ที่อ้างว่า HIGH กลับเป็น MEDIUM

- **หลักฐาน:** `e2e/support/fixtures.ts:172` สร้าง Client และ FinancialProfile แต่ไม่สร้าง Goal รวมถึง `boundaryHighClient` ที่ `:207`; `backend/src/domain/financial/goals.ts` คืน score null เมื่อไม่มี Goal และ `recommendation.ts` ให้ INSUFFICIENT_DATA เป็น MEDIUM ก่อนกฎอื่น
- **งานที่เกี่ยวข้อง:** M5-003, M5-007, M5-014
- **ผลกระทบ:** `e2e/client-directory.spec.ts:48` ตรวจว่าชื่อ ZetaLastHigh อยู่หน้าแรก แต่ไม่ตรวจ Priority ของแถวนั้น จึงปิดเกณฑ์ HIGH อยู่ท้ายข้อมูลไม่ได้ การตั้ง riskLevel HIGH ไม่ได้กำหนด NBA Priority
- **แก้ไข:** เพิ่ม Goal ที่ valid ให้ fixture ที่ต้องการข้อมูลครบ และ assert health COMPLETE กับ recommendation HIGH ก่อนตรวจลำดับ; ใช้ fixtures ที่คาดผลทุกหน้าได้แน่นอน
- **เกณฑ์ปิด:** boundary Client เป็น HIGH จริง ตรวจลำดับ HIGH → MEDIUM → LOW และ customerCode ทั้งชุดก่อนแบ่งหน้า รวม total และตัวกรองทั้ง List และ Dashboard

### AUD-M5-004 — Medium: Cleanup ไม่รักษา ownership ของ container

- **หลักฐาน:** `e2e/support/stack-launcher.ts:278` stop Caddy เมื่อ runner สร้างเอง **หรือ** พบว่ารันอยู่เดิม; `:163` บันทึกว่าเริ่ม postgres-e2e แต่ stopE2EStack ไม่หยุด service นี้
- **งานที่เกี่ยวข้อง:** M5-004, M5-013
- **ผลกระทบ:** teardown หยุด Caddy ที่ผู้ใช้เปิดไว้ และทิ้ง database container ที่เริ่มเอง ขัดข้อตกลง cleanup เฉพาะ resources ของ run นี้
- **แก้ไข:** เก็บ container identity/project และสถานะก่อน run ใช้ ownership ledger ใน success/failure/cancellation; หากเลือกคง database ไว้ต้องบันทึกนโยบายให้ชัด ไม่ใช้ชื่อ substring เป็น ownership
- **เกณฑ์ปิด:** ทดสอบ pre-existing stack และ stack ที่ runner เริ่มเอง รวม setup ล้มเหลวกลางทาง; resource เดิมต้องไม่ถูก stop และ resource ของ run ถูกจัดการตามนโยบาย

### AUD-M5-005 — Medium: Quality gates ไม่ครอบคลุม E2E code

- **หลักฐาน:** root `package.json` เรียก lint เฉพาะ frontend/backend; `backend/tsconfig.json` และ `frontend/tsconfig.json` ไม่ครอบคลุม root E2E suite/config
- **งานที่เกี่ยวข้อง:** M5-005, M5-013
- **ผลตรวจจริง:** ESLint ของ `e2e/` และ `playwright.config.ts` exit 1 พบ 5 errors: `auth.spec.ts:15,152`, `session-lifecycle.spec.ts:171,173`, `support/stack-launcher.ts:98` ทั้งหมดเป็น explicit any
- **ผลกระทบ:** root lint ผ่านได้ทั้งที่ acceptance tooling ผิดมาตรฐานที่ repository กำหนด และ Playwright discovery ไม่ใช่ TypeScript typecheck
- **แก้ไข/เกณฑ์ปิด:** เพิ่ม lint และ dedicated noEmit tsconfig สำหรับ E2E เข้า root gates แก้ errors และพิสูจน์ว่า deliberate type/lint error ใน E2E ทำให้ gate ล้มเหลว

### AUD-M5-006 — Medium: หลักฐาน BFCache ยังเป็นเพียง Back navigation

- **หลักฐาน:** `e2e/session-lifecycle.spec.ts:171` เก็บ `__pageshowPersisted` แต่ไม่อ่านหรือ assert; `:182` กด Back แล้วตรวจปลายทาง login เท่านั้น
- **งานที่เกี่ยวข้อง:** M5-010, M5-014
- **ผลกระทบ:** ผ่านได้โดย browser ไม่เคย restore จาก BFCache และไม่ตรวจช่วงก่อน revalidation จบ จึงยังปิด privacy regression นี้ไม่ได้
- **แก้ไข/เกณฑ์ปิด:** ยืนยัน `pageshow.persisted === true` ใน scenario ที่รองรับ พร้อมหน่วง `/auth/me` แล้วตรวจ sensitive DOM ระหว่างรอ; หาก environment ไม่เข้า BFCache ให้บันทึก blocked/not-covered และแยก deterministic lifecycle test ออกจาก browser proof

### AUD-M5-007 — Medium: Usability และ performance claims กว้างกว่าวิธีตรวจ

- **หลักฐาน:** `e2e/usability-performance.spec.ts:20` ใช้ viewport 640×480 แทน browser zoom; keyboard test จบที่ Priority filter (`:90`); launcher `:174` รัน backend source ผ่าน tsx และ NODE_ENV development
- **งานที่เกี่ยวข้อง:** M5-012, M5-014
- **ผลกระทบ:** ยังไม่รองรับข้อความ full keyboard traversal/zoom 200% และเกณฑ์ใน `tasks/milestone-5/todo.md` ที่ระบุ Next.js + Express production build
- **สิ่งที่แก้แล้ว:** มี 30 samples ต่อ flow และ warm-up 5 รอบทั้ง API/page ตาม source; ไม่ต้องย้อนกลับไป finding เดิมว่ามีเพียง 10 samples
- **แก้ไข/เกณฑ์ปิด:** ตรวจ zoom จริงหรือจำกัด claim ว่า reflow emulation; เพิ่ม keyboard flows ถึง pagination, Profile, Family, Retry และ focus behavior; ใช้ compiled backend ที่เหมาะกับ local HTTP หรือปรับข้อตกลงและรายงานว่าเป็น mixed-build local measurement ก่อนรับรองผล

### AUD-M5-008 — Medium: Limiter test ไม่ยืนยันขอบเขต 5/60 หรือการแยก IP

- **หลักฐาน:** `e2e/auth.spec.ts:149` หยุด loop เมื่อเจอ 429 ครั้งแรกและยอมรับผลได้ตั้งแต่ request แรก ไม่มีการตั้งต้น window ที่สะอาด; suite ก่อนหน้ามี login requests ใช้ memory store เดียวกัน
- **งานที่เกี่ยวข้อง:** M5-006, M5-013
- **ผลกระทบ:** limiter ที่บล็อกทุก request ก็ผ่าน test นี้ได้ และผลนี้ยังยืนยันไม่ได้ว่า Caddy ส่ง IP ที่ถูกต้องหรือป้องกัน forwarded-header spoofing
- **แก้ไข/เกณฑ์ปิด:** แยก window/instance อย่างชัดเจนโดยไม่ลดนโยบายจริง ตรวจ requests 1–5 และครั้งที่ 6 แบบ exact พร้อม Retry-After, การฟื้นหลัง window, IP อิสระ และ spoofing ผ่าน topology ที่ระบุ; อ้าง integration evidence แยกหากไม่ได้พิสูจน์ใน E2E

### AUD-M5-009 — Medium: E2E host ports เปิดทุก interface ขัดกับ local isolation ที่ระบุ

- **หลักฐาน:** `backend/src/e2e-server.ts:39` listen `0.0.0.0`; launcher `:203` ใช้ Next `-H 0.0.0.0` แต่แผนหัวข้อ 2.1 ระบุ loopback 3100/3101
- **งานที่เกี่ยวข้อง:** M5-004, M5-006
- **ผลกระทบ:** เมื่อ host firewall อนุญาต เครื่องอื่นอาจเข้าถึง E2E API ที่ใช้ข้อมูลสังเคราะห์และ credentials สำหรับทดสอบโดยตรง การ bind Caddy port เป็น loopback ไม่ได้จำกัด Node ports
- **แก้ไข:** ระบุ topology ที่ container Caddy เข้าถึง host ได้จริงพร้อม firewall/interface restriction หรือย้ายแอปเข้า private network; ไม่แก้เป็น loopback โดยไม่ตรวจว่า host.docker.internal ยังเข้าถึง upstream ได้
- **เกณฑ์ปิด:** Caddy ใช้งานได้ ขณะที่เครื่องอื่นเข้าพอร์ต upstream ไม่ได้ พร้อมปรับแผนให้ตรง topology จริง; production isolation ยังต้องตรวจใน M6

## Plan Gaps Summary

| Tickets | ผลตรวจ source / ส่วนที่ยังขาด |
|---|---|
| M5-001–002 | มี baseline และ matrix; การปิดงานต้องอิงหลักฐานหลังแก้ findings ข้างต้น |
| M5-003 | มี DB URL/identity guard และ migrate ก่อน reset; pagination fixture ยังผิด scenario (003) |
| M5-004–005 | มี port/readiness checks และ Playwright configuration; provenance, cleanup, network และ tooling ยังไม่ครบ (001,004,005,009) |
| M5-006 | มี login/logout และใช้ limiter ค่า default จริงแล้ว; exact boundary/IP proof ยังขาด (008) |
| M5-007 | implementation sort ก่อน paginate ถูกทิศทาง; E2E oracle ยังไม่พิสูจน์ high-at-tail (003) |
| M5-008–009 | มี Profile snapshot/Family tests และ ownership filtering ใน source; ยังไม่รันยืนยันใหม่รอบนี้ |
| M5-010 | มี session generation/key และ cache clear ใน source; race/BFCache evidence ยังไม่ตรง scenario (002,006) |
| M5-011 | เพิ่ม real database stop/start พร้อม finally แล้ว; UI fault injection เป็นอีกชนิดของหลักฐาน |
| M5-012 | sample/warm-up แก้แล้ว แต่ build และ usability claims ยังต้องปรับ (007) |
| M5-013–014 | ยังไม่ควรยืนยัน COMPLETED 100% ก่อนปิดรายการข้างต้นและเก็บ verification ใหม่ |

## Test Coverage Gaps

ต้องเพิ่มหรือปรับ test สำหรับ stale build, container ownership, high-priority fixture ที่ข้อมูลครบ, mounted RM switch พร้อม response เก่า, BFCache restore จริง, limiter exact boundary/IP, keyboard flows และ zoom รวมถึง root E2E quality gates ตาม acceptance ใน findings

Dashboard test ปัจจุบันตรวจเพียงแถวแรกที่มี HIGH หรือ AT RISK ไม่ได้เปรียบเทียบ customerCode tie-break ทั้งชุด (`e2e/morning-action-plan.spec.ts:11`) ส่วน search/filter test ตรวจ URL แต่ไม่ได้ assert ผล combined filters ทุกตัว อย่าใช้ชื่อ test ที่กว้างเป็นหลักฐานแทน assertions ทั้งนี้ unit/integration tests อาจครอบคลุมกฎบางส่วนอยู่แล้ว ต้องเชื่อมหลักฐานตามชั้นการทดสอบ ไม่สรุปว่าไม่มี coverage ทั้งระบบ

## ขอบเขตที่ทบทวนและสิ่งที่พบ

| ด้าน | หลักฐาน / ข้อจำกัด |
|---|---|
| Financial rules | `goals.ts` ตรวจวันที่/ตัวหารก่อนคำนวณ มี pre-start branch, exact rational aggregation และ half-up; `recommendation.ts` ให้ insufficient data มาก่อนกฎอื่น ไม่พบข้อผิดพลาดใหม่ที่ยืนยันได้ในส่วนที่อ่าน |
| Search / filter / pagination | `client-list.service.ts` จำกัด RM ผ่าน repository → search → evaluate → filter → sort → total → slice; โหลด relations แบบ batch ไม่มี query ต่อ Client ใน service loop |
| Schema / data isolation | Prisma ใช้ Decimal(18,2), date-only, relations/indexes; E2E guard ตรวจ URL และ current_database ก่อน reset; FK ไม่ใช่ RM authorization |
| Authentication / CSRF | JWT HS256, issuer/audience และ TTL 3600; cookie HttpOnly/Lax/Secure ตาม environment; Origin guard ตรวจ exact match; production config ปฏิเสธ default secret |
| Ownership / Family | Client repository ใช้ id + rmId; Family controller ตรวจ primary ownership และกรอง relative ที่ต่าง RM ก่อนส่ง nodes/edges; query ทั้งสองด้านแบบ 1-hop |
| Frontend privacy | SessionProvider มี generation, abort, keyed subtree และซ่อนเนื้อหาระหว่าง revalidation; browser proof ยังมี 002/006 |
| Errors / readiness | no-store middleware, error envelope, readiness timeout; real outage test เพิ่มแล้ว แต่ไม่ได้รันซ้ำใน audit นี้ |
| Maintainability | แยก controllers/repositories/domain และมี typed contracts; root E2E tooling ขาด coverage ตาม 005 |
| Performance / accessibility | มี local sampling code; ไม่ใช่ VM/load test หรือ WCAG certification; ดู 007 |
| DevSecOps / dependencies | production CI, Trivy/image scan, TLS, host hardening, peak RAM/OOM และ deploy verification เป็นงาน M6; ไม่ได้สแกน dependency advisories ใหม่ในรอบนี้ จึงไม่รับรองว่าไม่มีช่องโหว่ล่าสุด |

## ทบทวนการแก้ข้อค้นพบจากรายงานก่อน

อ้าง [MILESTONE5_PLAN_REVIEW_REPORT.md](MILESTONE5_PLAN_REVIEW_REPORT.md) โดยสถานะต่อไปนี้หมายถึง source inspection เท่านั้น

| ประเด็นก่อนหน้า | สถานะปัจจุบัน |
|---|---|
| Migration ก่อน seed | เพิ่ม `applyE2EMigrations` และเรียกหลังตรวจ DB identity แล้ว |
| Build provenance | ยังเปิด: AUD-M5-001 |
| Limiter max 1000 | ถอด override แล้ว; test exact policy ยังเปิด: AUD-M5-008 |
| SHA / test count | SHA `4b6a580caece607e72c12a142be7dda8cf037464` มีจริง; diff ถึง HEAD มีเฉพาะเอกสาร 2 ไฟล์ ไม่ใช่ source drift; discovery พบ 32 tests / 9 files ตรงจำนวนใหม่ |
| Cleanup / HTTP timeout | เพิ่ม startup try/catch และ fetch timeout แล้ว; resource ownership ยังเปิด: AUD-M5-004 |
| Real database outage | มี stop/start postgres-e2e และ finally recovery แล้ว |
| RM switch / BFCache | ยังเปิด: AUD-M5-002 และ 006 |
| Performance samples | แก้ 30 samples และ warm-up แล้ว; usability/build claims ยังเปิด: AUD-M5-007 |
| Fixture / ordering assertions | ยังพบ scenario mismatch ใหม่ชัดเจน: AUD-M5-003 |

## Notes / Risks

- `tasks/milestone-5/verification.md:329` ใช้จำนวน RM = 2 เพื่อกล่าวว่า development database ไม่เปลี่ยน หลักฐาน count ตรวจการเปลี่ยนค่าในแถวหรือข้อมูล Client/financial ไม่ได้ ควรใช้ sentinel identity/value หรือ checksum ของข้อมูลที่กำหนดก่อนและหลังโดยไม่บันทึกข้อมูลละเอียดอ่อน
- ข้อความ ACCEPTED/COMPLETED 100% ใน plan/handover เป็นคำกล่าวของเอกสารเดิม รายงานนี้ไม่รับรองตามนั้น และไม่แก้สถานะ tickets โดยพลการ
- `failure-recovery.spec.ts` เรียก waitForE2EDatabase หลัง restart แต่ไม่ disconnect client ที่ได้กลับ ควรปิด connection ใน finally เพื่อให้ resource lifecycle ชัดเจน
- launcher ตั้ง E2E_DATABASE_URL ของ child API เป็นค่า default ตายตัว ขณะที่ guard/seed รับ environment override ได้ ควรใช้ validated URL เดียวตลอด run เพื่อไม่ให้ custom test credentials ใช้ได้เฉพาะ seed แต่ API เริ่มไม่ได้
- readiness timeout จำกัดเวลาตอบ HTTP แต่ไม่ได้ยกเลิก query ที่กำลังทำงาน ต้องวัด pool/resource behavior เมื่อ outage ยาวในขั้น runtime verification
- ข้อมูลทั้งหมดเป็น synthetic prototype; local HTTP และ deferred production TLS ไม่ถูกนับเป็นช่องโหว่โดยตัวมันเอง

## Evidence — สิ่งที่ตรวจจริงในรอบนี้

| การตรวจ | ผลจริง |
|---|---|
| `git status --short` ก่อน audit | ไม่มีการเปลี่ยนแปลง |
| `git rev-parse HEAD` | `15e5b901392f1edb6ea1b05fc68eae19b129a5da` |
| `git diff --stat cf36075 HEAD` | ทบทวน patch หลัง review ก่อนหน้า: 19 ไฟล์ |
| `git diff --stat 4b6a580 HEAD` | เปลี่ยน handover และ verification เท่านั้น อย่างละ 1 บรรทัด |
| `node node_modules/@playwright/test/cli.js test --list` | Exit 0; **32 tests ใน 9 files**; เป็น discovery ไม่ได้ execute tests |
| `node node_modules/eslint/bin/eslint.js e2e playwright.config.ts --config eslint.config.mjs` | Exit 1; **5 errors, 0 warnings** |
| Unit / integration / E2E runtime, benchmark, npm audit, Trivy | **ไม่ได้รันใหม่** ใน audit นี้; ไม่ยกผลเก่าเป็นผลตรวจปัจจุบัน |

การไม่รัน test suite เป็นไปตาม [plan-audit SKILL.md](C:/Users/teera/.agents/skills/plan-audit/SKILL.md): “Do **not** run tests here unless the user explicitly asks; this is an inspection pass.” คำขอนี้เป็นการ audit จึงใช้ source inspection, discovery และ static lint โดยไม่ reset database หรือหยุด containers

ลำดับแก้ที่เสนอ: 001–003 ก่อน จากนั้น 004–009 ปรับ matrix/verification ให้ตรงหลักฐาน แล้วจึงรัน acceptance จาก checkout/artifacts ที่ตรวจ provenance ได้ รายงานนี้เพิ่มเอกสารไฟล์เดียว ไม่แก้ application code หรือ deploy ระบบ
