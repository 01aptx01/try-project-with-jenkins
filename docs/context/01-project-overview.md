# 1. Project Overview

## Product and engineering vision

Meridian คือ Full-stack Financial Relationship Management prototype สำหรับ Relationship Manager (RM) ใช้ข้อมูลสังเคราะห์เพื่อให้ RM เริ่มวันด้วยรายการ Client ที่ต้องให้ความสนใจ เข้าใจข้อมูลสำคัญในหน้าเดียว และเห็น Next Best Action (NBA) ที่อธิบายได้

แอปนี้ยังเป็น realistic workload เพื่อสาธิต Automated DevSecOps CI/CD: ทุกการเปลี่ยนแปลงที่ merge เข้า `main` จะผ่าน GitHub webhook ไปยัง Jenkins เพื่อตรวจ lint, tests, Docker build, Trivy, deployment และ health check ตาม [06-devsecops.md](06-devsecops.md)

```text
Prioritize → Understand → Decide
     │             │          │
Morning Plan   Client Profile  One explainable NBA
```

## MVP in scope

- Authentication แบบ RM, Morning Action Plan, Client List, search และ filter
- Client Profile ที่รวม Financial Health, goals, summary, NBA และ Family Wealth Network
- Rule-based, deterministic และ explainable Financial Health/Priority/NBA ตาม [04-business-rules.md](04-business-rules.md)
- PostgreSQL, Prisma, Next.js, Express, Docker Compose, Jenkins, GitHub webhook และ Trivy
- Lint, frontend/component tests, backend unit/API tests, image tagging, security gate, deployment และ health check

## Constraints

| รหัส | ข้อจำกัด |
|---|---|
| C-01 | เป็น educational prototype ไม่ใช่ production banking system |
| C-02 | ใช้เฉพาะ seed data สังเคราะห์ |
| C-03 | Score และ NBA ไม่ใช่ licensed financial advice |
| C-04 | MVP ไม่ใช้ ML, LLM, RAG หรือ vector database |
| C-05 | ใช้ Ubuntu VM เดียวและ Docker Compose; ไม่ใช้ Kubernetes |
| C-06 | RM เป็น application role เดียว และเข้าถึงเฉพาะ Client ของตน |
| C-07 | GitHub เป็น source control, webhook เป็น CI trigger และ deploy เฉพาะ `main` |

## Out of scope and future work

MVP ไม่รวม real banking integration, real customer data, AI chat, churn prediction, advanced RBAC, audit trail, notifications, Docker registry, blue/green deployment, rollback, Kubernetes, SAST/DAST/SBOM, centralized logging หรือ monitoring

GitHub Pages ใช้ได้เฉพาะเอกสาร โครงสร้างระบบ รูป screenshot และสื่อ demo; แอปหลักต้องรันบน Ubuntu VM เพราะใช้ Express และ PostgreSQL

## Final positioning

> Meridian is a realistic full-stack financial relationship management prototype used to demonstrate an end-to-end automated DevSecOps CI/CD pipeline. It centralizes synthetic client information, produces explainable rule-based health and next-action results, and validates, scans, builds, and deploys updates through GitHub, Jenkins, Docker, Trivy, and Docker Compose.

## Source mapping

ครอบคลุมหัวข้อเดิม 1–3, 12, 39–40 และ Short Project Summary ดู [README](README.md) สำหรับตารางเทียบฉบับเต็ม
