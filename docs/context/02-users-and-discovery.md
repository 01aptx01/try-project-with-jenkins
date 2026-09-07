# 2. Users and Problem Discovery

## Problems to solve

| พื้นที่ | ปัญหา | ผลลัพธ์ของ MVP |
|---|---|---|
| Information fragmentation | RM ต้องประกอบข้อมูล Client จากหลายแหล่ง | Client Profile เดียวรวมข้อมูลสำคัญ |
| Prioritization | เวลาจำกัดและอาจพลาด Client ที่มีปัญหา | Morning Action Plan ที่เรียง Priority พร้อมเหตุผล |
| Decision support | คะแนนอย่างเดียวไม่บอกสิ่งที่ควร review | NBA หลักแบบ deterministic พร้อม reason |
| Explainability | ผู้ใช้เชื่อผลลัพธ์ที่ไม่มีเหตุผลได้ยาก | breakdown, classification และ rule reason |
| Family context | ความสัมพันธ์สำคัญไม่เห็นในมุมรายบุคคล | Family Wealth Network ที่มองเห็นได้ตามสิทธิ์ |
| Delivery quality | build/test/deploy แบบ manual ไม่ repeatable | pipeline ที่หยุดเมื่อ quality หรือ security gate ไม่ผ่าน |

## Stakeholders

| Stakeholder | ความต้องการหลัก |
|---|---|
| Relationship Manager | รู้ว่าควรดู Client ใดก่อน เข้าใจเหตุผล และค้นข้อมูลเร็ว |
| Wealth Client | ข้อมูลถูกจำกัดอย่างเหมาะสม และ RM ยังเป็นผู้ตัดสินใจ |
| Product Owner / Management | ขอบเขตทำได้จริงและสาธิตคุณค่าระบบได้ |
| Developer | feedback เร็ว, test ที่ชัดเจน และ deploy ซ้ำได้ |
| DevOps / Administrator | configuration แยกจาก code, logs และ health ที่ตรวจได้ |
| Security / Compliance | ไม่มี plaintext password หรือ committed secret, protected API และ image scan |

## How might we

| Product question | MVP answer |
|---|---|
| ช่วย RM ระบุ Client ที่ต้องดูโดยไม่เปิดทีละคนได้อย่างไร | Morning Action Plan ที่ใช้ Priority/NBA rule ชุดเดียวกับ Profile |
| รวมข้อมูลสำคัญโดยไม่ทำระบบใหญ่เกิน scope ได้อย่างไร | Profile snapshot, goals, summary และ one-hop family graph |
| ให้ recommendation ที่เข้าใจได้โดยไม่ใช้ AI ได้อย่างไร | deterministic rule, reason และ source metric |
| ทำให้คะแนนตรวจสอบได้อย่างไร | fixed components, explicit boundaries และ insufficient-data contract |
| ป้องกัน broken/vulnerable build ได้อย่างไร | PR validation และ main deployment gate ตาม [06](06-devsecops.md) |

## Personas

### Narin Wongchai — Relationship Manager

RM ที่ดูแล Client หลายราย มีทักษะดิจิทัลระดับกลาง ใช้ desktop/laptop ต้องการเปิดระบบแล้วรู้ว่า “วันนี้ต้องดูใคร ทำไม และควร review เรื่องใด” Pain points คือข้อมูลมาก เวลาจำกัด ตัวเลขไม่มี action และครอบครัวมองเห็นยาก

### Beam — Full-stack Developer

ต้องการให้ push ที่ผ่านเกณฑ์เข้าสู่ deployment อย่างสม่ำเสมอ และต้องเห็น stage ที่ fail ชัดเจน Pain points คือ manual test/deploy, environment mismatch, ลืม scan และตามหา commit ที่รันอยู่ได้ยาก

## Journey after product

| Stage | User action | System response |
|---|---|---|
| Login | กรอก credential | สร้าง secure session แล้วไป Dashboard |
| Morning review | เปิด Dashboard | แสดง Client ของ RM ที่เรียง Priority พร้อม reason |
| Search/filter | ระบุชื่อ, customer code หรือ filter | แสดงเฉพาะผลที่ตรงและอยู่ในสิทธิ์ |
| Understand | เปิด Client Profile | รวมข้อมูลส่วนบุคคล Health goals NBA summary และ family |
| Evaluate | เปิด Health Card | แสดง score หรือข้อมูลไม่เพียงพอ พร้อม breakdown |
| Decide | อ่าน NBA | แสดง action, reason และ priority เพียงรายการเดียว |
| Prepare | อ่าน Summary / graph | สรุปจากข้อมูลจริงและแสดง relationship ที่เข้าถึงได้ |

ระบบไม่ส่งข้อความหาลูกค้า ไม่ให้คำแนะนำการเงินจริง และไม่ทำ action ภายนอกระบบ
