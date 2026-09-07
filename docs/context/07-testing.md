# 7. Testing Strategy

## Test layers

| Layer | Tool | เป้าหมาย |
|---|---|---|
| Backend unit | Vitest | Health, Priority, NBA, Summary และ helper date/math |
| API integration | Supertest + test database | auth, ownership, contract, validation และ error responses |
| Frontend component | Vitest + React Testing Library | Login, Client List, Health card, Priority badge และ NBA card |
| Pipeline | Jenkins/demo fixtures | gates, stage order, image SHA และ deployment verification |

E2E เป็น optional Future Work ไม่ใช่ gate ของ MVP

## Unit tests for business rules

| Area | Cases |
|---|---|
| Liquidity | 0, 1, 3 และ 6 months; boundaries ต้องได้ 0/8/18/25 ตามลำดับ |
| Debt | 20%, 40%, 60% และค่ามากกว่า 60%; total assets 0 ต้อง insufficient |
| Savings | 0%, >0%, 10%, 20%, income 0 และ expense สูงกว่า income |
| Investment | 0%, >0%, 10%, 20% และ total assets 0 |
| Goals | ก่อน start date, start date ที่ยอดเป็น 0, target date, เลยกำหนด, current amount เกิน target, ไม่มี goals และ target date ไม่หลัง start date; ยืนยันว่าไม่มี `NaN`/`Infinity` |
| Total | total เท่าผลรวม component, Goals ปัดสองตำแหน่ง, classifications 59.99/60/79.99/80 |
| Insufficient | profile หายและ field/denominator ที่จำเป็นขาด; total/classification เป็น null และ missingFields/breakdown ถูกต้อง |
| NBA precedence | insufficient > liquidity <3 > debt >60% > urgent late goal > health <60 > routine; หลายเงื่อนไขต้องเลือกกฎแรก |
| Sorting | HIGH/MEDIUM/LOW แล้ว `customer_code`; same priority ต้อง deterministic |
| Summary | text ใช้ Health, primary goal, NBA reason/action เดียวกับ recommendation และไม่มี fabricated field |

## API tests

- Login สำเร็จ set HttpOnly cookie โดย response ไม่มี JWT; credential ผิดได้ `401`; logout clear cookie; session หมดอายุหรือ signature ผิดได้ `401`; 6 requests จาก verified IP เดียวใน 60 วินาทีได้ `429` พร้อม `Retry-After`
- ทุก endpoint ที่ต้องป้องกันปฏิเสธ request ไม่มี cookie; POST ที่ Origin ขาด, เป็น `null` หรือไม่ตรงใน production configuration ได้ `403`; proxy configuration ไม่ยอมให้ client spoof forwarded IP
- RM A เห็น Client ของ A ได้ แต่ list/search/filter ไม่คืน Client B; request detail, health, NBA, summary หรือ family ของ Client B ได้ `404`
- Client List รองรับ partial case-insensitive name/customer code, search+filter, empty state, default 20 และ pageSize สูงกว่า 100 ได้ `400`
- filters validate enum, client ไม่พบได้ `404`, Health incomplete ได้ nullable contract, Family ไม่คืน node/edge ข้าม RM
- `/health` unauthenticated ส่ง 200 และ version SHA ที่ pipeline deploy; database ไม่พร้อมได้ `503`; SHA ไม่ตรงกับ build ทำให้ Verify fail
- Profile snapshot มี `client`, `financialProfile`, `goals`, `primaryGoal`, `health`, `recommendation`, `summary`, `asOfDate`; endpoints ย่อยคืน derived result ชุดเดียวกัน และ Family Graph โหลดแยก

## Frontend tests

- Login Form แสดง validation/error และนำไป Dashboard เมื่อ authenticated
- Client List แสดง loading, empty state, search/filter/reset และ priority order ที่ API ส่งมา
- Health Score Card แสดง total/breakdown/classification เมื่อ complete หรือ `Insufficient data` กับ missing data เมื่อ incomplete
- Priority Badge และ NBA Card แสดง action, priority และ reason; Profile และ Summary แสดง NBA เดียวกัน
- Family Graph แสดง primary node, accessible one-hop nodes และ relationship labels จากทั้งสองทิศทาง โดยไม่ส่ง edge/node ข้าม RM

## Pipeline verification

ใช้ commits/fixtures ที่ควบคุมผลได้เพื่อยืนยัน PR ไม่ deploy, main valid build deploy, lint/test failure, image build success, Trivy HIGH/CRITICAL block, Trivy execution error block, migration failure, wrong SHA, successful deploy และ health failure Jenkins output ต้องพิสูจน์ stages ที่ fail/skip ตาม [06-devsecops.md](06-devsecops.md)

## Seed and fixture tests

Normal seed ต้องสร้าง RM 2 คนและ Client 30 คนที่มี Health data/Goal valid ครบและครอบคลุมทุก NBA/Priority scenario โดยรันซ้ำแบบ idempotent ได้ Fixture tests แยกต่างหากใช้ Profile/Goal ที่ไม่สมบูรณ์และ cross-RM family relation เพื่อทดสอบ error/visibility; fixture เหล่านี้ต้องไม่ทำให้ normal seed ขัดกับข้อกำหนดข้อมูลครบ

## Test evidence

เอกสารนี้เป็นแผนทดสอบ ไม่อ้างว่า tests ได้รันแล้ว ผลจริงต้องบันทึกวันที่, commit SHA, command, status และลิงก์ Jenkins build ในรายงาน demo
