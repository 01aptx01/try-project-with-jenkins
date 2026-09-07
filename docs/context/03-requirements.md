# 3. Requirements and Success Criteria

## Functional requirements

| ID | Requirement |
|---|---|
| FR-01 | Login, logout, validate session และ protect authenticated routes |
| FR-02–04 | แสดง Client List, search ด้วย name/customer code และ filter Priority/Health โดยใช้พร้อมกันได้ |
| FR-05 | Morning Action Plan คำนวณ เรียง และแสดง Client ของ RM พร้อม reason และ link ไป profile |
| FR-06 | Client Profile แสดง personal data, Health, Risk Level, goals, summary, NBA และ family graph |
| FR-07–08 | คำนวณ Financial Health 0–100 แบบ deterministic พร้อม breakdown หรือ `INSUFFICIENT_DATA` |
| FR-09–10 | สร้าง NBA หลักหนึ่งรายการที่มี action, reason และ priority |
| FR-11 | แสดง Family Wealth Network จาก PostgreSQL เฉพาะ nodes/edges ที่ RM เห็นได้ |
| FR-12 | สร้าง Client Summary จากข้อมูลและ derived logic ที่กำหนด ห้ามสร้างข้อมูลใหม่ |
| FR-13–25 | Trigger Jenkins, checkout SHA, install, lint, frontend/backend/API tests, build, scan, gate, deploy, health check และ stage logging |

รายละเอียดกฎผลลัพธ์อยู่ใน [04-business-rules.md](04-business-rules.md); API อยู่ใน [05-architecture-and-data.md](05-architecture-and-data.md); pipeline อยู่ใน [06-devsecops.md](06-devsecops.md)

## Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | bcrypt password hash, expiring session, protected routes, secrets ผ่าน environment และไม่ commit `.env` |
| NFR-02 | common API response เป้าหมาย <500 ms และ page load <2 s บน prototype dataset |
| NFR-03 | failed build หรือ scan ต้องไม่แทนที่ version ที่กำลังรัน |
| NFR-04 | TypeScript, modular naming, ESLint, business logic แยกจาก controller และ environment config |
| NFR-05 | score, priority, NBA และ summary เป็น service/function ที่ทดสอบได้ |
| NFR-06–07 | UI desktop/laptop อ่านง่าย และทุก score/recommendation มีคำอธิบาย |
| NFR-08 | trace ได้จาก Git commit → Jenkins build → Docker image → running version |
| NFR-09 | รันได้ด้วย Docker Compose บน Docker Engine ที่มี configuration ครบ |
| NFR-10 | ใช้ foreign keys และ database constraints สำหรับ relation สำคัญ |

## User stories and acceptance criteria

| ID | Story | เกณฑ์รับหลัก |
|---|---|---|
| US-01 | RM login เพื่อเข้าถึงข้อมูล | credential ถูกต้องสร้าง session; ผิดได้ 401; logout clear cookie; route ป้องกันแล้วปฏิเสธ session ใช้ไม่ได้ |
| US-02 | RM ดู Morning Action Plan | มี Client, Health status, Priority, reason; HIGH ก่อน MEDIUM/LOW; click เข้าสู่ profile ได้ |
| US-03–04 | RM search/filter Client | partial, case-insensitive search; search+filter ร่วมกัน; empty state และ reset filter |
| US-05 | RM ดู Client Profile | แสดงข้อมูลครบใน FR-06; Client ไม่มีหรือไม่อยู่ในสิทธิ์ได้ 404 |
| US-06, US-15 | RM เข้าใจ Health | score 0–100 เมื่อข้อมูลครบ, total ตรง breakdown, classification ถูกต้อง และข้อมูลไม่ครบไม่แสดงคะแนนเทียม |
| US-07, US-16 | RM ดู NBA | action/reason/priority ครบ, deterministic, reason ตรง rule ที่ชนะ |
| US-08 | RM ดู Family Network | primary node, accessible related nodes และ relationship labels จาก database |
| US-09 | RM อ่าน Summary | มี Health, primary goal, main issue และ NBA โดยไม่มีข้อมูลนอก source |
| US-10 | Developer push code | target branch ส่ง webhook, Jenkins เริ่ม build และบันทึก SHA |
| US-11–14 | Developer เห็น quality/security/deployment result | tests หรือ Trivy fail แล้ว deploy skipped; stages Checkout→Verify แสดงสถานะชัด |

## Definition of done

ฟีเจอร์เสร็จเมื่อ requirement ผ่าน self/code review, lint, unit test, API/component test, Docker build, Trivy policy, deployment และ health check ตามความเกี่ยวข้องของฟีเจอร์

## Project success criteria

Product success คือ RM login, ค้นหา/กรอง, เปิด profile, เข้าใจ score/NBA/summary/family ได้ครบด้วย seed data ส่วน CI/CD success คือสาธิต successful pipeline, test failure และ security-gate failure ได้ พร้อม trace commit และ health check หลัง deploy

## Requirement traceability

### Functional requirements

| ID | Acceptance focus |
|---|---|
| FR-01 | Login sets secure cookie, logout clears it, expired/invalid session gets 401 |
| FR-02 | List returns only owned Client fields and total after filters |
| FR-03 | Partial, case-insensitive name/customerCode search works with filters |
| FR-04 | Priority/Health filter validates enum and reset restores all owned Client |
| FR-05 | Morning Action Plan uses the derived-result flow and deterministic order |
| FR-06 | Profile snapshot contains data and one consistent evaluation |
| FR-07 | Health is deterministic, 0–100 when complete, null when incomplete |
| FR-08 | Breakdown sums to score and exposes missing component data |
| FR-09 | NBA returns one action, reason, priority and rule |
| FR-10 | No NBA is returned without the rule reason that selected it |
| FR-11 | One-hop Family graph filters both nodes and edges by RM ownership |
| FR-12 | Summary is template output from the same evaluation and source data |
| FR-13 | Webhook verifies signature and branch before triggering the appropriate pipeline |
| FR-14 | Jenkins records the exact triggering commit SHA |
| FR-15 | Dependency installation uses lockfiles and `npm ci` |
| FR-16 | Lint failure stops the relevant pipeline |
| FR-17 | Frontend, backend unit and backend API tests run before deploy |
| FR-18 | Any test failure makes downstream build/deploy stages skipped |
| FR-19 | Frontend/API images build with the recorded SHA |
| FR-20 | Image tag and running health version use the same SHA |
| FR-21 | Trivy scans both images for HIGH and CRITICAL findings |
| FR-22 | Finding or scanner error blocks deployment |
| FR-23 | Only a validated main build runs Compose deployment |
| FR-24 | Health checks API/database readiness, version and proxied web response |
| FR-25 | Jenkins records Success, Failed or Skipped for every stage |

### Non-functional requirements

| ID | Acceptance focus |
|---|---|
| NFR-01 | Cookie/session, secret, Origin and limiter rules in [05](05-architecture-and-data.md) are followed |
| NFR-02 | API/page targets are measured and recorded under the baseline in [06](06-devsecops.md) |
| NFR-03 | Failed validation leaves the currently running application unchanged |
| NFR-04 | TypeScript, modular services, lint and environment configuration are used |
| NFR-05 | Domain services can be unit tested without controller/database dependencies |
| NFR-06 | Desktop/laptop UI has clear navigation, loading and empty states |
| NFR-07 | Health and NBA expose the source component/rule and reason |
| NFR-08 | Commit, build, image and health version are traceable |
| NFR-09 | Compose runs with documented host configuration |
| NFR-10 | Relations and financial constraints are validated in schema and seed |

### User-story acceptance matrix

| ID | Acceptance focus |
|---|---|
| US-01 | Valid login, invalid credential, logout and expired session cases |
| US-02 | Ordered morning cards link to an owned Profile |
| US-03 | Search returns a matching Client or a clear empty result |
| US-04 | Search/filter combine and reset correctly |
| US-05 | Profile success uses a snapshot; missing/not-owned Client returns 404 |
| US-06 | Health boundaries and incomplete-data response are visible |
| US-07 | NBA precedence chooses one deterministic result |
| US-08 | Family graph has primary/accessibly related nodes and labeled edges |
| US-09 | Summary contains health, goal, issue and same NBA |
| US-10 | Target branch webhook starts the correct Jenkins run with SHA |
| US-11 | Lint/test failure prevents deploy |
| US-12 | HIGH/CRITICAL finding or scan failure prevents deploy |
| US-13 | Valid main build deploys and completes verification |
| US-14 | Build dashboard identifies failed/skipped stage |
| US-15 | Health card explains all components or missing data |
| US-16 | Recommendation card shows action, priority, reason and rule |
