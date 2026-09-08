# Meridian Milestone 4 — UI Wire Contract Baseline

**สร้างเมื่อ:** 2026-09-08  
**อ้างอิง Runtime Commit:** `c9906e9`  
**สถานะ:** Locked & Verified against Backend API Runtime (`@meridian/api`)

เอกสารนี้รวบรวม Wire Contracts, Types, Formats, Nullability, และ Error Response Envelopes ที่ Frontend (`@meridian/web`) จะใช้เชื่อมต่อกับ Backend API ผ่าน Caddy Reverse Proxy (`/api/*`)

---

## 1. Common Standards & Formats

1. **Currency & Decimal Values:**
   - ส่งเป็น String ทศนิยม 2 ตำแหน่งเสมอ เช่น `"150000.00"`, `"0.00"`
   - ห้ามแปลงเป็น floating-point number ในการแสดงผลหรือจัดกลุ่มหลัก เพื่อป้องกัน rounding errors
   - กรณีไม่มีข้อมูล (Nullability): ส่ง `null` อย่างชัดเจน (ห้ามแปลง `null` เป็น `"0.00"` หรือ `"0"`)

2. **Dates:**
   - ส่งเป็น ISO-8601 Date String รูปแบบ `YYYY-MM-DD` (UTC) เช่น `"2026-09-08"`
   - Frontend แสดงผลตรงตามสตริง ไม่แปลง Timezone

3. **Error Envelope:**
   - ทุก Endpoint คืน Error โครงสร้างเดียวกันตาม RFC 7807 variant:
   ```json
   {
     "error": {
       "code": "UNAUTHORIZED",
       "message": "Authentication required",
       "requestId": "2b9798ce-be79-4071-ab16-0c98d6d52791",
       "details": null
     }
   }
   ```
   - HTTP Status Codes:
     - `400 BAD_REQUEST`: Zod parsing failure, invalid UUID, invalid query parameters
     - `401 UNAUTHORIZED`: ไม่มี Session Cookie, Session หมดอายุ, หรือ Credential ไม่ถูกต้อง
     - `403 FORBIDDEN`: Origin check failure บน state-changing methods (`POST`)
     - `404 NOT_FOUND`: ไม่พบ Route หรือ Client ไม่ได้อยู่ใต้ความดูแลของ RM ปัจจุบัน
     - `413 PAYLOAD_TOO_LARGE`: Request body เกิน 16 KiB
     - `415 UNSUPPORTED_MEDIA_TYPE`: Content-Type ไม่ใช่ `application/json`
     - `429 TOO_MANY_REQUESTS`: ล็อกอินล้มเหลวเกิน 5 ครั้งภายใน 15 นาที (พร้อม Header `Retry-After`)
     - `500 INTERNAL_ERROR`: ข้อผิดพลาดภายในระบบ (ไม่ส่ง Stack Trace หรือ SQL Details)
     - `503 DEPENDENCY_UNAVAILABLE`: ฐานข้อมูลขัดข้อง, Timeout, หรือ Prisma pool timeout (`P2024`)

---

## 2. Authentication Contracts

### 2.1 `POST /api/auth/login`
- **Request Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "email": "rm1@meridian.local",
    "password": "Password123!"
  }
  ```
  *(หมายเหตุ: รหัสผ่านไม่ถูก trim และยาวไม่เกิน 72 UTF-8 bytes)*
- **Response Headers:** `Set-Cookie: meridian_session=<JWT>; Path=/; HttpOnly; SameSite=Lax`
- **Response Body (HTTP 200):**
  ```json
  {
    "user": {
      "id": "11111111-1111-1111-1111-111111111111",
      "name": "Sarah Jenkins",
      "role": "RM"
    }
  }
  ```

### 2.2 `POST /api/auth/logout`
- **Request Headers:** `Origin: http://localhost:8081`
- **Response (HTTP 204):** No Content (Cookie `meridian_session` ถูก clear)

### 2.3 `GET /api/auth/me`
- **Response (HTTP 200):**
  ```json
  {
    "id": "11111111-1111-1111-1111-111111111111",
    "name": "Sarah Jenkins",
    "role": "RM"
  }
  ```

---

## 3. Client List & Dashboard Contracts

### 3.1 `GET /api/clients`
- **Query Parameters:**
  - `search` (optional string): ค้นหาชื่อ-นามสกุล หรือ Customer Code แบบ case-insensitive
  - `priority` (optional enum): `"HIGH"` | `"MEDIUM"` | `"LOW"`
  - `health` (optional enum): `"GOOD"` | `"MODERATE"` | `"AT_RISK"` | `"INSUFFICIENT_DATA"`
  - `page` (optional integer, min 1, default 1)
  - `pageSize` (optional integer, min 1, max 100, default 20)
- **Response (HTTP 200):**
  ```json
  {
    "items": [
      {
        "id": "22222222-2222-2222-2222-222222222001",
        "customerCode": "C-001",
        "displayName": "Somchai Prasert",
        "riskLevel": "HIGH",
        "health": {
          "score": 68,
          "classification": "MODERATE",
          "status": "COMPLETE",
          "missingFields": [],
          "breakdown": {
            "liquidity": 15,
            "debt": 18,
            "savings": 10,
            "goals": 15,
            "investment": 10
          }
        },
        "recommendation": {
          "action": "Review Emergency Fund",
          "reason": "Emergency reserves are below 3 months of expenses",
          "priority": "HIGH",
          "rule": "BR-04.2"
        }
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 15
  }
  ```

### 3.2 `GET /api/dashboard/morning-action-plan`
- **Response (HTTP 200):**
  ```json
  {
    "items": [
      {
        "id": "22222222-2222-2222-2222-222222222001",
        "customerCode": "C-001",
        "displayName": "Somchai Prasert",
        "riskLevel": "HIGH",
        "health": { ... },
        "recommendation": { ... }
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 15,
    "asOfDate": "2026-09-08"
  }
  ```
  *(หมายเหตุ: ลำดับถูกจัดเรียงตาม Priority: HIGH $\rightarrow$ MEDIUM $\rightarrow$ LOW และเรียงตาม Customer Code)*

---

## 4. Client Profile Snapshot & Sub-Endpoints

### 4.1 `GET /api/clients/:id` (Full Profile Snapshot)
- **Response (HTTP 200):**
  ```json
  {
    "client": {
      "id": "22222222-2222-2222-2222-222222222001",
      "customerCode": "C-001",
      "firstName": "Somchai",
      "lastName": "Prasert",
      "displayName": "Somchai Prasert",
      "riskLevel": "HIGH",
      "age": 45,
      "occupation": "Business Owner"
    },
    "financialProfile": {
      "id": "33333333-3333-3333-3333-333333333001",
      "monthlyIncome": "150000.00",
      "monthlyExpense": "95000.00",
      "liquidAssets": "200000.00",
      "totalAssets": "5500000.00",
      "totalDebt": "2100000.00",
      "savings": "350000.00",
      "investments": "1500000.00"
    },
    "goals": [
      {
        "id": "44444444-4444-4444-4444-444444444001",
        "goalType": "RETIREMENT",
        "targetAmount": "10000000.00",
        "currentAmount": "2500000.00",
        "startDate": "2020-01-01",
        "targetDate": "2035-12-31"
      }
    ],
    "primaryGoal": {
      "id": "44444444-4444-4444-4444-444444444001",
      "goalType": "RETIREMENT",
      "targetAmount": "10000000.00",
      "currentAmount": "2500000.00",
      "startDate": "2020-01-01",
      "targetDate": "2035-12-31",
      "expectedAmount": "4218750.00",
      "progress": 0.59,
      "isBehind": true,
      "isCompleted": false
    },
    "health": {
      "score": 68,
      "classification": "MODERATE",
      "status": "COMPLETE",
      "missingFields": [],
      "breakdown": {
        "liquidity": 15,
        "debt": 18,
        "savings": 10,
        "goals": 15,
        "investment": 10
      }
    },
    "recommendation": {
      "action": "Review Emergency Fund",
      "reason": "Emergency reserves are below 3 months of expenses",
      "priority": "HIGH",
      "rule": "BR-04.2"
    },
    "summary": "Somchai Prasert has a Moderate financial health score of 68/100. The primary area requiring immediate attention is liquidity, with current reserves below recommended emergency thresholds.",
    "asOfDate": "2026-09-08"
  }
  ```

#### กรณี Incomplete Data (Financial Profile หายหรือข้อมูลไม่ครบ):
- `health.score`: `null` (ห้ามแปลงเป็น `0`)
- `health.classification`: `null`
- `health.status`: `"INSUFFICIENT_DATA"`
- `health.missingFields`: รายการฟิลด์ที่ขาด เช่น `["monthlyIncome", "monthlyExpense"]`
- `health.breakdown`: ฟิลด์ที่คำนวณไม่ได้เป็น `null`

### 4.2 `GET /api/clients/:id/family` (One-hop Family Graph)
- **Response (HTTP 200):**
  ```json
  {
    "nodes": [
      {
        "id": "22222222-2222-2222-2222-222222222001",
        "label": "Somchai Prasert",
        "type": "PRIMARY"
      },
      {
        "id": "22222222-2222-2222-2222-222222222002",
        "label": "Wandee Prasert",
        "type": "RELATED"
      }
    ],
    "edges": [
      {
        "id": "55555555-5555-5555-5555-555555555001",
        "source": "22222222-2222-2222-2222-222222222001",
        "target": "22222222-2222-2222-2222-222222222002",
        "relationshipType": "SPOUSE"
      }
    ]
  }
  ```
  *(หมายเหตุ: ความสัมพันธ์จำกัดเฉพาะบุคคลที่อยู่ภายใต้การดูแลของ RM เดียวกันเท่านั้น)*
