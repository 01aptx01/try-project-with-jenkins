# Meridian Context

Meridian เป็นระบบต้นแบบสำหรับ Relationship Manager (RM) เพื่อจัดลำดับและทำความเข้าใจ Client ด้วยข้อมูลทางการเงินสังเคราะห์ และใช้เป็น workload สำหรับสาธิต DevSecOps CI/CD

## Language

**Relationship Manager (RM)**:
ผู้ใช้ระบบที่รับผิดชอบ Client ของตน และเข้าถึงได้เฉพาะข้อมูลที่ระบบกำหนดว่าอยู่ในความดูแลของตน
_Avoid_: Advisor, employee, account manager

**Client**:
บุคคลที่มีข้อมูลความสัมพันธ์และการเงินอยู่ในระบบ โดยมี RM เจ้าของหนึ่งคนใน MVP
_Avoid_: Customer, user, account

**Financial Health**:
ผลประเมินเชิงกฎของข้อมูลการเงินของ Client เป็นคะแนน 0–100 หรือสถานะข้อมูลไม่เพียงพอ ไม่ใช่คำแนะนำทางการเงิน
_Avoid_: Credit score, risk score

**Risk Level**:
คุณลักษณะความเสี่ยงที่บันทึกไว้ในข้อมูล Client แยกจาก Financial Health และ Priority
_Avoid_: Health category, action priority

**Priority**:
ระดับความเร่งด่วนของสิ่งที่ RM ควรตรวจสอบก่อน: `HIGH`, `MEDIUM` หรือ `LOW`
_Avoid_: Risk level, health classification

**Next Best Action (NBA)**:
คำแนะนำเชิงกฎเพียงหนึ่งรายการที่ระบบเลือกให้ Client พร้อม action, reason และ priority
_Avoid_: Financial advice, action list

**Morning Action Plan**:
รายการ Client ของ RM ที่เรียงลำดับจาก Priority พร้อมเหตุผลและ NBA หลัก เพื่อใช้เริ่มต้นวันทำงาน
_Avoid_: Dashboard score

**Family Wealth Network**:
กราฟที่แสดง Client หลัก สมาชิกครอบครัวที่ RM มีสิทธิ์เห็น และชนิดความสัมพันธ์
_Avoid_: Household, external graph

**Seed Data**:
ข้อมูลสังเคราะห์ที่เตรียมซ้ำได้สำหรับ demo และการทดสอบ ไม่ใช่ข้อมูลจริง
_Avoid_: Production data
