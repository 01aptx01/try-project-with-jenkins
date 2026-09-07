# 4. Business Rules

กฎในเอกสารนี้เป็น deterministic prototype rules สำหรับข้อมูลสังเคราะห์ ไม่ใช่มาตรฐานการเงินหรือคำแนะนำทางการเงิน ทุกการคำนวณในคำขอเดียวใช้ “วันนี้” เป็นวัน UTC เดียวกัน

## ID mapping

หัวข้อเดิม BR-01 ถึง BR-07 ยังรักษาความหมายเดิมไว้ในเอกสารนี้: score range, classification, priority, liquidity rule, recommendation explainability, summary source และ deployment gate ส่วนกฎที่เพิ่มจากการปรับสเปกคือ BR-08 Insufficient Data, BR-09 Derived-result data flow และ BR-10 Primary Goal/Family Network

## BR-01: Health Score Range

Financial Health Score ที่ complete อยู่ในช่วง 0–100

## BR-02: Health Classification

Financial Health เป็น `GOOD` เมื่อ score ตั้งแต่ 80, `MODERATE` เมื่อ 60–79.99 และ `AT_RISK` เมื่อต่ำกว่า 60

## BR-03: Priority Classification

Priority เป็น `HIGH`, `MEDIUM` หรือ `LOW` และต้องมี reason อย่างน้อยหนึ่งรายการ Risk Level คือข้อมูล Client ที่บันทึกไว้ ไม่ใช่ผลจาก Health หรือ Priority

### Health Score Calculation

Financial Health เป็นผลรวม 100 คะแนนจาก five components ด้านล่าง หากมีข้อมูลจำเป็นครบ

| Component | Input และกฎ | Max |
|---|---|---:|
| Liquidity | `liquid_assets / monthly_expense` เดือน: ≥6 = 25, ≥3 = 18, ≥1 = 8, <1 = 0 | 25 |
| Debt | `total_debt / total_assets`: ≤20% = 25, ≤40% = 18, ≤60% = 8, >60% = 0 | 25 |
| Savings | `(monthly_income - monthly_expense) / monthly_income`: ≥20% = 20, ≥10% = 14, >0 = 7, ≤0 = 0 | 20 |
| Goals | `15 × average(capped goal progress)` | 15 |
| Investment | `investments / total_assets`: ≥20% = 15, ≥10% = 10, >0 = 5, ≤0 = 0 | 15 |

ตรวจ `targetAmount > 0` และ `targetDate > startDate` ก่อนคำนวณ มิฉะนั้น Goal เป็นข้อมูลไม่เพียงพอ ใช้ `asOfDate` วัน UTC เดียวตลอด evaluation เมื่อ `asOfDate <= startDate` ให้ `expectedAmount = 0`, `cappedGoalProgress = 1`, `isBehind = false` และห้ามหาร เมื่ออยู่หลังวันเริ่มแต่ก่อนวันครบกำหนด ให้ `expectedAmount = targetAmount × elapsedDays / totalDays` จำกัดระหว่าง 0 และ target amount, `cappedGoalProgress = min(1, max(0, currentAmount / expectedAmount))`, `isBehind = currentAmount < expectedAmount` เมื่อถึงหรือหลัง `targetDate` ใช้ `expectedAmount = targetAmount` และ `isBehind = currentAmount < targetAmount` ปัดเฉพาะคะแนน Goals ขั้นสุดท้ายแบบ half-up เป็นทศนิยมสองตำแหน่งก่อนรวม

component ที่เป็น table score เป็นจำนวนเต็ม ตัวอย่าง ณ `2026-09-08`: Goal เริ่ม `2026-09-08`, เป้าหมาย 12,000, ยอดปัจจุบัน 0 และครบกำหนด `2027-09-08` ต้องคืน `expectedAmount = 0`, `cappedGoalProgress = 1`, `isBehind = false` จึงไม่มีเส้นทางที่ให้ `NaN` หรือ `Infinity`

## BR-08: Insufficient data

หากไม่มี Financial Profile, ไม่มี Goal, หรือมีตัวหารไม่เป็นบวก (`monthly_expense`, `monthly_income`, `total_assets`, `target_amount`, หรือช่วงวัน Goal) ให้ response เป็น `INSUFFICIENT_DATA` Goal ที่ผิดเพียงรายการเดียวทำให้ component Goals และ score รวมเป็น `null`; ระบบห้ามตัด Goal นั้นออกเพื่อเพิ่มคะแนน ส่วน component อื่นที่ข้อมูลครบยังแสดงค่าของตนได้ ตัวอย่าง response:

```json
{
  "score": null,
  "classification": null,
  "status": "INSUFFICIENT_DATA",
  "missingFields": [
    "financialProfile.monthlyIncome",
    "financialProfile.monthlyExpense",
    "goals[goal-7].targetDate"
  ],
  "breakdown": { "liquidity": null, "debt": 18, "savings": null, "goals": null, "investment": 10 }
}
```

ส่วนที่ข้อมูลครบอาจคำนวณได้ แต่ไม่มี score รวมและต้องไม่ normalize น้ำหนักใหม่

## BR-04: Priority and emergency liquidity rule

ตรวจตามลำดับต่อไปนี้แล้วหยุดที่กฎแรกที่เข้าเงื่อนไข เพื่อคืน NBA เพียงหนึ่งรายการและ Priority เดียวกัน:

| ลำดับ | เงื่อนไข | NBA | Priority |
|---:|---|---|---|
| 1 | ข้อมูลไม่เพียงพอ | `Review Client Data` | MEDIUM |
| 2 | liquidity months <3 | `Review Emergency Fund` | HIGH |
| 3 | debt ratio >60% | `Review Debt Position` | HIGH |
| 4 | อย่างน้อยหนึ่ง Goal ล่าช้า และวันถึง/ผ่าน target date ≤365 | `Review Goal Funding` | MEDIUM |
| 5 | Health <60 | `Schedule Financial Health Review` | MEDIUM |
| 6 | ไม่มีข้อข้างต้น | `Routine Financial Review` | LOW |

เหตุผลต้องแสดงค่าหรือสถานะที่ทำให้กฎเข้าเงื่อนไข เช่น “Current liquidity covers 2.3 months of estimated expenses.” Goal “ล่าช้า” คือ `current_amount < expected_amount` ณ วัน UTC นั้น กฎ 4 ครอบคลุมเป้าหมายที่เลยกำหนดแล้วด้วย

## BR-09: Derived Client Results

Morning Action Plan ต้องคำนวณ Health/NBA ชุดเดียวกับ Client Profile และ Summary, จำกัดเฉพาะ Client ของ RM, เรียง `HIGH → MEDIUM → LOW → customer_code` และส่ง reason ของกฎที่เลือก ตรรกะเดียวกันใช้หลัง search/filter โดย search ไม่เปลี่ยนค่า Priority

Client List และ Morning Action Plan ใช้ flow เดียว: ตรวจ RM → load owned Client พร้อม Financial Profile/Goals แบบ batch → evaluate → filter → sort → นับ `total` → paginate Search ชื่อและ `customerCode` แบบ partial/case-insensitive ทำหลังจำกัด RM และก่อน evaluation ได้ ห้ามใช้ database pagination ก่อน filter/sort ด้วย derived Priority หรือ Health สำหรับ seed 30 Client ให้คำนวณในหน่วยความจำ; หากขนาดข้อมูลเพิ่ม ต้องออกแบบ query/materialization ใหม่ก่อนขยาย `total` คือจำนวนหลังใช้ทุก filter ก่อนแบ่งหน้า และหน้าที่เกินผลลัพธ์คืน `items: []`

## BR-06: Client Summary

Summary สร้างจาก template เท่านั้น ประกอบด้วย Health หรือ insufficient-data status, primary goal, main issue จาก NBA reason และ NBA action ห้ามประกอบชื่อ เหตุการณ์ สินทรัพย์ หรือคำแนะนำที่ไม่มีใน database หรือผลลัพธ์กฎ

## BR-10: Primary Goal and Family Wealth Network

Client หลักเป็น primary node; edge มี relationship type (`SPOUSE`, `PARENT`, `CHILD`, `SIBLING`) ค่าที่เกี่ยวข้องต้องเป็น Client ที่ RM เดียวกันเป็นเจ้าของก่อนแสดง node และ edge หาก related Client อยู่ต่าง RM ให้ไม่ส่งข้อมูลหรือ edge นั้นออกมา Graph จำกัด member ที่สัมพันธ์โดยตรงหนึ่ง hop Query ต้องตรวจทั้ง `clientId = :id` และ `relatedClientId = :id` แล้วตรวจ ownership ของ Client หลักและปลายทั้งสองก่อนคืนผล เก็บ relation หนึ่งแถวต่อ canonical pair, ห้าม self relation และห้ามคู่ที่ขัดแย้งกัน; `SPOUSE`/`SIBLING` เป็น symmetric, `PARENT` แปล parent → child และ `CHILD` แปล child → parent

## BR-07: Deployment gate

deployment เกิดได้ต่อเมื่อ lint, tests, Docker build และ Trivy ผ่านเท่านั้น หาก Trivy พบ vulnerability ระดับ HIGH หรือ CRITICAL ไม่ว่าจะมี fix หรือไม่มี รวมถึง scan command error ให้ pipeline fail และ deploy skipped
