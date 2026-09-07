# Meridian — Documentation Index

เอกสารในโฟลเดอร์นี้เป็นแหล่งอ้างอิงหลักฉบับปัจจุบันของ Meridian สำหรับทั้งการนำเสนอโครงงานและการพัฒนาระบบ เนื้อหาใช้ภาษาไทย โดยคงชื่อเทคนิค, API และข้อความ UI เป็นภาษาอังกฤษ

ไฟล์ [../../meridian_project_context.md](../../meridian_project_context.md) คือเอกสารต้นฉบับก่อนการจัดโครงสร้างและยังเก็บไว้ครบถ้วน ห้ามแก้ข้อกำหนดจากเอกสารย่อยแล้วนำกลับไปทับไฟล์ต้นฉบับโดยไม่มีการทบทวน

## เส้นทางอ่าน

ผู้ประเมินควรเริ่มจาก [01-project-overview.md](01-project-overview.md) แล้วอ่าน [02-users-and-discovery.md](02-users-and-discovery.md), [03-requirements.md](03-requirements.md), [05-architecture-and-data.md](05-architecture-and-data.md) และ [06-devsecops.md](06-devsecops.md)

ผู้พัฒนาควรอ่าน [CONTEXT.md](../../CONTEXT.md), [03-requirements.md](03-requirements.md), [04-business-rules.md](04-business-rules.md), [05-architecture-and-data.md](05-architecture-and-data.md) และ [07-testing.md](07-testing.md) ตามลำดับ

## เอกสาร

| เอกสาร | หน้าที่ |
|---|---|
| [01-project-overview.md](01-project-overview.md) | วิสัยทัศน์ ขอบเขต ข้อจำกัด และตำแหน่งของโครงงาน |
| [02-users-and-discovery.md](02-users-and-discovery.md) | ปัญหา ผู้มีส่วนได้ส่วนเสีย Personas และ journey |
| [03-requirements.md](03-requirements.md) | FR/NFR/US/DoD และเกณฑ์สำเร็จ |
| [04-business-rules.md](04-business-rules.md) | สูตรคะแนน Priority, NBA, Summary และ Family Graph |
| [05-architecture-and-data.md](05-architecture-and-data.md) | สถาปัตยกรรม ฐานข้อมูล API และ session |
| [06-devsecops.md](06-devsecops.md) | Git, Jenkins, Docker, Trivy และ deployment |
| [07-testing.md](07-testing.md) | กลยุทธ์และกรณีทดสอบ |
| [08-delivery-roadmap.md](08-delivery-roadmap.md) | โครงสร้าง repository, seed data และแผนส่งมอบ |

## ตารางเทียบหัวข้อจากต้นฉบับ

| หัวข้อเดิม | ปลายทางปัจจุบัน | สถานะ |
|---:|---|---|
| 1 Project Overview | [01: vision](01-project-overview.md#product-and-engineering-vision) | สรุป |
| 2 Vision and Objectives | [01: vision](01-project-overview.md#product-and-engineering-vision) | สรุป |
| 3 Project Scope | [01: MVP](01-project-overview.md#mvp-in-scope) | ปรับ |
| 4 Problem Discovery | [02: problems](02-users-and-discovery.md#problems-to-solve) | สรุป |
| 5 Problem Statement | [02: problems](02-users-and-discovery.md#problems-to-solve) | สรุป |
| 6 How Might We | [02: questions](02-users-and-discovery.md#how-might-we) | สรุป |
| 7 Stakeholder Analysis | [02: stakeholders](02-users-and-discovery.md#stakeholders) | สรุป |
| 8 Personas | [02: personas](02-users-and-discovery.md#personas) | สรุป |
| 9 Customer Journey | [02: journey](02-users-and-discovery.md#journey-after-product) | สรุป |
| 10 Functional Requirements | [03: FR](03-requirements.md#functional-requirements) | ปรับ |
| 11 Non-Functional Requirements | [03: NFR](03-requirements.md#non-functional-requirements) | ปรับ |
| 12 Constraints | [01: constraints](01-project-overview.md#constraints) | ปรับ |
| 13 Business Rules | [04: rules](04-business-rules.md#4-business-rules) | ปรับ |
| 14 User Stories | [03: stories](03-requirements.md#user-stories-and-acceptance-criteria) | ปรับ |
| 15 System Modules | [03: traceability](03-requirements.md#requirement-traceability) | สรุป |
| 16 Technology Stack | [05: technology](05-architecture-and-data.md#technology-choices) | สรุป |
| 17 System Architecture | [05: architecture](05-architecture-and-data.md#architecture) | ปรับ |
| 18 Database Design | [05: data](05-architecture-and-data.md#data-model) | ปรับ |
| 19 API Design | [05: API](05-architecture-and-data.md#api-contract) | ปรับ |
| 20 Authentication Flow | [05: auth](05-architecture-and-data.md#authentication-and-session) | ปรับ |
| 21 Financial Health Score | [04: BR-01](04-business-rules.md#br-01-health-score-range) | ปรับ |
| 22 Morning Action Plan | [04: BR-09](04-business-rules.md#br-09-derived-client-results) | ปรับ |
| 23 Next Best Action | [04: BR-04](04-business-rules.md#br-04-priority-and-emergency-liquidity-rule) | ปรับ |
| 24 Client Summary | [04: BR-06](04-business-rules.md#br-06-client-summary) | ปรับ |
| 25 Family Wealth Network | [04: BR-10](04-business-rules.md#br-10-primary-goal-and-family-wealth-network) | ปรับ |
| 26 Testing Strategy | [07: tests](07-testing.md#7-testing-strategy) | ปรับ |
| 27 CI/CD Design | [06: pipeline](06-devsecops.md#pipeline) | ปรับ |
| 28 Jenkins Pipeline | [06: pipeline](06-devsecops.md#pipeline) | ปรับ |
| 29 Docker and Compose | [06: runtime](06-devsecops.md#runtime-topology) | ปรับ |
| 30 Trivy Security Gate | [06: Trivy](06-devsecops.md#trivy-policy) | ปรับ |
| 31 Deployment and Health Check | [06: verify](06-devsecops.md#deployment-verification-and-failure) | ปรับ |
| 32 Repository Structure | [08: structure](08-delivery-roadmap.md#target-repository-structure) | ปรับ |
| 33 Git Strategy | [06: branches](06-devsecops.md#branch-and-trigger-policy) | ปรับ |
| 34 GitHub Pages | [01: future work](01-project-overview.md#out-of-scope-and-future-work) | สรุป |
| 35 Security Considerations | [05: security](05-architecture-and-data.md#security-considerations) | ปรับ |
| 36 Definition of Done | [03: DoD](03-requirements.md#definition-of-done) | สรุป |
| 37 Project Success Criteria | [03: success](03-requirements.md#project-success-criteria) | สรุป |
| 38 Development Roadmap | [08: roadmap](08-delivery-roadmap.md#development-roadmap) | ปรับ |
| 39 Future Work | [01: future work](01-project-overview.md#out-of-scope-and-future-work) | ย้าย |
| 40 Final Positioning | [01: positioning](01-project-overview.md#final-positioning) | สรุป |
| Introduction and Short Summary | [01: vision](01-project-overview.md#product-and-engineering-vision) | สรุป |

สถานะ “สรุป” คงเจตนาโดยลดรายละเอียดที่ซ้ำ “ปรับ” คือข้อกำหนดที่เพิ่มความชัดเจนหรือแก้ความขัดแย้ง และ “ย้าย” คือ Future Work ที่ไม่ใช่ MVP
