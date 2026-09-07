# Meridian
## Financial Relationship Management Platform

> **Project Type:** Full-stack Web Application + DevSecOps / CI/CD  
> **Primary User:** Relationship Manager (RM)  
> **Core Stack:** TypeScript, Next.js, Node.js, Express.js, JWT, PostgreSQL, Prisma, GitHub, GitHub Webhook, Jenkins, Docker, Docker Compose, Trivy  
> **Deployment Target:** Ubuntu Server / VM  
> **Project Scope:** Educational / Academic Prototype using synthetic data only

---

# Table of Contents

1. [Project Overview](#1-project-overview)
2. [Project Vision and Objectives](#2-project-vision-and-objectives)
3. [Project Scope](#3-project-scope)
4. [Problem Discovery](#4-problem-discovery)
5. [Problem Statement](#5-problem-statement)
6. [How Might We](#6-how-might-we)
7. [Stakeholder Analysis](#7-stakeholder-analysis)
8. [Personas](#8-personas)
9. [Customer Journey Map — After Product](#9-customer-journey-map--after-product)
10. [Functional Requirements](#10-functional-requirements)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Constraints](#12-constraints)
13. [Business Rules](#13-business-rules)
14. [User Stories and Acceptance Criteria](#14-user-stories-and-acceptance-criteria)
15. [System Modules](#15-system-modules)
16. [Technology Stack](#16-technology-stack)
17. [System Architecture](#17-system-architecture)
18. [Database Design](#18-database-design)
19. [API Design](#19-api-design)
20. [Authentication Flow](#20-authentication-flow)
21. [Financial Health Score Design](#21-financial-health-score-design)
22. [Morning Action Plan / Priority](#22-morning-action-plan--priority)
23. [Next Best Action](#23-next-best-action)
24. [Client Summary](#24-client-summary)
25. [Family Wealth Network](#25-family-wealth-network)
26. [Testing Strategy](#26-testing-strategy)
27. [CI/CD and DevSecOps Design](#27-cicd-and-devsecops-design)
28. [Jenkins Pipeline](#28-jenkins-pipeline)
29. [Docker and Docker Compose](#29-docker-and-docker-compose)
30. [Trivy Security Gate](#30-trivy-security-gate)
31. [Deployment and Health Check](#31-deployment-and-health-check)
32. [Repository Structure](#32-repository-structure)
33. [Git Strategy](#33-git-strategy)
34. [GitHub Pages](#34-github-pages)
35. [Security Considerations](#35-security-considerations)
36. [Definition of Done](#36-definition-of-done)
37. [Project Success Criteria](#37-project-success-criteria)
38. [Development Roadmap](#38-development-roadmap)
39. [Out of Scope / Future Work](#39-out-of-scope--future-work)
40. [Final Project Positioning](#40-final-project-positioning)

---

# 1. Project Overview

## 1.1 Project Name

**Meridian: Financial Relationship Management Platform**

ชื่อภาษาไทย:

**Meridian: แพลตฟอร์มบริหารความสัมพันธ์ลูกค้าทางการเงิน**

## 1.2 Project Description

Meridian เป็น Full-stack Web Application สำหรับ Relationship Manager (RM) เพื่อช่วยรวบรวมข้อมูลสำคัญของลูกค้าไว้ในระบบเดียว และสนับสนุนการทำงาน 3 ขั้นตอนหลัก:

1. **Prioritize** — ระบุว่าลูกค้าคนใดควรได้รับความสนใจก่อน
2. **Understand** — ทำความเข้าใจสถานะทางการเงิน เป้าหมาย ความเสี่ยง และบริบทครอบครัว
3. **Decide** — แสดง Next Best Action ที่มีเหตุผลประกอบ

ตัว application จะทำหน้าที่เป็น realistic workload สำหรับระบบ Automated DevSecOps CI/CD โดยทุก code push ไปยัง GitHub สามารถ trigger Jenkins ผ่าน GitHub Webhook เพื่อทำ automated validation ตั้งแต่ lint, testing, Docker build, Trivy scan, security gate, deployment และ health check

```text
Developer
   ↓
GitHub
   ↓
GitHub Webhook
   ↓
Jenkins
   ↓
Lint + Automated Tests
   ↓
Docker Build
   ↓
Trivy Security Scan
   ↓
Security Gate
   ↓
Docker Compose Deploy
   ↓
Health Check
```

## 1.3 Background from Meridian Concept

Meridian เดิมถูกออกแบบเป็น AI Relationship Intelligence Platform เพื่อช่วย RM มองเห็นลูกค้าแบบองค์รวม ไม่ใช่เฉพาะ portfolio โดยมีแนวคิดสำคัญ เช่น Morning Action Plan, Client Profile, Financial Health Score, Next Best Action, Family Wealth Network และ AI-assisted Client Summary

สำหรับโปรเจกต์นี้จะลดขนาดลงเป็น **Meridian Lite** โดยคงเฉพาะฟีเจอร์ที่พอ implement ได้จริง และเปลี่ยนส่วน AI ที่ซับซ้อนให้เป็น rule-based, deterministic และ testable logic ก่อนในช่วงแรก

---

# 2. Project Vision and Objectives

## 2.1 Product Vision

> ช่วยให้ Relationship Manager เริ่มต้นวันทำงานด้วยข้อมูลที่ชัดเจน เห็นลูกค้าที่ควรให้ความสนใจก่อน เข้าใจภาพรวมของลูกค้า และได้รับคำแนะนำที่อธิบายเหตุผลได้จากระบบเดียว

## 2.2 Engineering Vision

> สร้างกระบวนการพัฒนาและส่งมอบซอฟต์แวร์ที่ตรวจสอบคุณภาพและความปลอดภัยโดยอัตโนมัติ ตั้งแต่ code push จนถึง deployment โดยลด dependency ต่อ manual process

## 2.3 Product Objectives

ระบบต้องช่วยให้ RM:

- Login เข้าระบบได้อย่างปลอดภัย
- เห็นลูกค้าที่ต้องได้รับ attention ก่อน
- Search และ filter ลูกค้าได้
- เปิดดู Client Profile แบบรวมศูนย์
- ดู Financial Health Score พร้อม breakdown
- ดู Goal Progress
- ดู Family Relationship
- อ่าน Client Summary
- ดู Next Best Action พร้อมเหตุผล
- ลดการเปิดข้อมูลหลายส่วนแยกกัน

## 2.4 Engineering Objectives

ระบบต้องสามารถ:

- Trigger Jenkins Pipeline จาก GitHub Push ผ่าน Webhook
- Run automated lint
- Run frontend tests
- Run backend unit tests
- Run backend API tests
- Build Docker Images
- Tag images ด้วย Git commit SHA
- Scan Docker Images ด้วย Trivy
- Block deployment เมื่อ quality/security gate fail
- Deploy ด้วย Docker Compose
- Verify deployment ผ่าน health check
- Trace running version กลับไปยัง Git commit ได้

---

# 3. Project Scope

## 3.1 MVP — Must Have

### User-facing Features

1. Authentication
2. Morning Action Plan
3. Customer List
4. Customer Search
5. Customer Filter
6. Client Profile
7. Financial Health Score
8. Financial Health Breakdown
9. Goals
10. Next Best Action
11. Explainable Recommendation
12. Family Wealth Network
13. Client Summary

### Engineering / DevSecOps Features

14. GitHub Repository
15. GitHub Webhook
16. Jenkins running on Docker
17. Automated Lint
18. Automated Frontend Tests
19. Automated Backend Unit Tests
20. Automated API Tests
21. Docker Build
22. Docker Image Tagging
23. Trivy Vulnerability Scan
24. Security Gate
25. Docker Compose Deployment
26. Health Check
27. Pipeline Logs

## 3.2 Nice to Have

- Recommendation status: Pending / Reviewed / Completed
- Audit log
- Dashboard statistics
- Historical Financial Health Score
- Deployment rollback
- Client notes
- In-app notification
- Swagger/OpenAPI
- GitHub Pages documentation site

## 3.3 Explicitly Out of MVP

- Full RAG
- Vector Database
- AI Chat
- ML Churn Prediction
- Digital Twin
- Real Core Banking Integration
- Real Banking APIs
- Real Customer Data
- Real Financial Advice
- Automated Client Messaging
- Kubernetes
- Microservices
- Enterprise IAM
- Complex consent management
- Production banking-grade security certification

---

# 4. Problem Discovery

Problem Discovery แบ่งเป็น 2 ด้าน: **Business/Product** และ **Software Delivery/Engineering**

## 4.1 Problem 1 — Information Fragmentation

### Current Situation

ข้อมูลที่ RM ต้องใช้ประกอบการตัดสินใจอาจอยู่ในหลายหมวด เช่น:

- Customer Information
- Financial Profile
- Goals
- Risk
- Portfolio
- Family Relationship
- Recent Events

### Pain Point

RM ต้องเสียเวลาเปิดและประกอบข้อมูลจากหลายส่วนก่อนจะเข้าใจลูกค้าหนึ่งคน

### Consequence

- Preparation time สูง
- เข้าใจลูกค้าได้ช้า
- มีโอกาสพลาดข้อมูลสำคัญ
- effort สูงเมื่อดูแลลูกค้าจำนวนมาก

### Opportunity

สร้าง Client Profile แบบรวมศูนย์ที่แสดงข้อมูลสำคัญในหน้าเดียว

## 4.2 Problem 2 — Prioritization

RM มีลูกค้าหลายราย แต่เวลาทำงานต่อวันมีจำกัด

คำถามสำคัญคือ:

> วันนี้ควรเริ่มจากลูกค้าคนไหนก่อน?

### Pain Point

หากไม่มีระบบจัดลำดับ RM อาจ:

- เปิดข้อมูลทีละคน
- อาศัยความจำ
- สนใจเฉพาะลูกค้าที่ active
- พลาดลูกค้าที่มี risk หรือ opportunity แต่ไม่ได้ติดต่อเข้ามา

### Opportunity

สร้าง Morning Action Plan ที่คำนวณ Priority Score และแสดงเหตุผลของ priority

## 4.3 Problem 3 — Decision Support

ถึง RM จะรู้ว่าต้องดูลูกค้าคนไหน ก็ยังต้องตัดสินใจว่า **ควร review เรื่องอะไรต่อ**

### Opportunity

สร้าง Next Best Action แบบ rule-based เช่น:

```text
Emergency liquidity ต่ำ
→ Review Emergency Fund

Goal ใกล้ครบกำหนดแต่ progress ต่ำ
→ Review Goal Funding

Debt ratio สูง
→ Review Debt Position

ไม่มี issue สำคัญ
→ Routine Financial Review
```

## 4.4 Problem 4 — Explainability

Recommendation ที่มีเพียง HIGH RISK หรือ ACTION REQUIRED โดยไม่มีเหตุผลจะทำให้ผู้ใช้เชื่อถือได้ยาก

### Opportunity

ทุก score / recommendation ต้องสามารถอธิบายได้

ตัวอย่าง:

```text
Financial Health: 58 / 100

Liquidity       8 / 25
Debt           12 / 25
Savings        11 / 20
Goals          13 / 15
Investment     14 / 15
```

## 4.5 Problem 5 — Family Context

ข้อมูลลูกค้ามักถูกดูแบบรายบุคคล ทำให้ RM อาจไม่เห็น relationship สำคัญ เช่น Spouse, Parent, Child หรือ Sibling

### Opportunity

สร้าง Family Wealth Network แบบ relationship graph

## 4.6 Engineering Problem 1 — Manual Testing

หากการ test ต้องพึ่ง developer run เอง อาจเกิด:

- ลืม test
- run test ไม่ครบ
- local environment ต่างกัน
- merge code ที่ไม่ผ่าน validation

### Opportunity

Automate testing ใน Jenkins

## 4.7 Engineering Problem 2 — Manual Build and Deployment

Manual deployment เช่น SSH → git pull → install → build → restart มีโอกาสเกิด human error และไม่ repeatable

### Opportunity

Dockerize application และ deploy ด้วย Docker Compose

## 4.8 Engineering Problem 3 — Security Validation

Application อาจ build สำเร็จ แต่ container image มี known vulnerabilities

### Opportunity

เพิ่ม Trivy ก่อน deployment

```text
Build
  ↓
Trivy
  ↓
Policy Violation?
  ├── YES → Block Deployment
  └── NO  → Deploy
```

## 4.9 Engineering Problem 4 — Traceability

หากใช้ image tag `latest` อย่างเดียว จะ trace ได้ยากว่า deployment ปัจจุบันมาจาก commit ใด

### Opportunity

Tag image ด้วย Git commit SHA เช่น:

```text
meridian-web:a8f231c
meridian-api:a8f231c
```

---

# 5. Problem Statement

## 5.1 Business Problem Statement

Relationship Managers ต้องดูแลลูกค้าหลายราย ในขณะที่ข้อมูลเกี่ยวกับสถานะทางการเงิน เป้าหมาย ความเสี่ยง และบริบทครอบครัวอาจอยู่แยกกันหลายส่วน ส่งผลให้การเตรียมข้อมูล การจัดลำดับลูกค้า และการตัดสินใจว่าจะดำเนินการอะไรต่อกับลูกค้าใช้เวลาและ effort สูง

## 5.2 Engineering Problem Statement

กระบวนการ build, test, security scan และ deploy ที่พึ่งพา manual operation ทำให้เกิดความเสี่ยงจาก human error และทำให้ไม่สามารถรับประกันได้ว่า application version ใหม่ผ่าน quality และ security checks ก่อน deployment

## 5.3 Combined Problem Statement

> Meridian aims to centralize essential client relationship and financial information for Relationship Managers while establishing an automated DevSecOps delivery process that validates, tests, security-scans, builds, and deploys every application version through a repeatable CI/CD pipeline.

---

# 6. How Might We

## Product

1. How might we help RMs identify clients requiring attention without manually reviewing every customer?
2. How might we consolidate essential customer information into a single interface?
3. How might we provide understandable recommendations without implementing complex AI?
4. How might we show why a client receives a particular health score or priority?
5. How might we help RMs understand basic family context from one profile?

## Engineering

6. How might we automatically validate every code change before deployment?
7. How might we prevent code with failing tests from being deployed?
8. How might we prevent vulnerable container images from being deployed?
9. How might we make deployments repeatable and traceable?
10. How might we reduce manual deployment steps?

---

# 7. Stakeholder Analysis

## 7.1 Stakeholder Matrix

| Stakeholder | Type | Interest | Influence | Main Concern |
|---|---|---:|---:|---|
| Relationship Manager | Primary User | High | High | Client prioritization and understanding |
| Wealth Client | Indirect User | High | Medium | Appropriate service and data privacy |
| Product Owner | Business | High | High | Product direction and scope |
| Developer | Technical | High | High | Development and delivery workflow |
| DevOps Engineer | Technical | High | High | CI/CD reliability |
| Security / InfoSec | Governance | High | High | Security gate and secret management |
| System Administrator | Operations | Medium | High | Runtime reliability |
| Compliance | Governance | Medium | High | Appropriate data handling |
| Management | Business | Medium | High | Operational value and maintainability |

## 7.2 Relationship Manager Needs

- เปิด Dashboard แล้วรู้ว่าวันนี้ควรดูใคร
- Search ได้เร็ว
- Client Profile อ่านง่าย
- Health Score อธิบายได้
- Recommendation มีเหตุผล
- ไม่ต้องเปิดหลายระบบ
- Family relationship เห็นได้ในภาพเดียว

## 7.3 Client Needs

- ข้อมูลไม่ถูกเปิดเผยอย่างไม่เหมาะสม
- Recommendation มีเหตุผล
- RM ยังเป็นผู้ตัดสินใจ
- ระบบไม่สร้างข้อมูลทางการเงินขึ้นมาเอง

## 7.4 Developer Needs

- Push code แล้ว pipeline ทำงาน
- Feedback เร็ว
- รู้ว่า test ใด fail
- ไม่ต้อง deploy manual หลายขั้น
- Environment reproducible
- Trace deployment กลับ commit ได้

## 7.5 DevOps / Administrator Needs

- Container management ง่าย
- Deployment repeatable
- Configuration แยกจาก code
- Restart service ง่าย
- Health ตรวจสอบได้
- Logs ดูได้

## 7.6 Security Stakeholder Needs

- Password ไม่เก็บ plaintext
- Secrets ไม่ commit
- Unauthorized API access ถูก block
- Image ต้อง scan
- Security policy violation ต้อง block deploy

---

# 8. Personas

## 8.1 Primary Persona — Relationship Manager

**Name:** Narin Wongchai  
**Age:** 35  
**Occupation:** Relationship Manager  
**Experience:** 7 Years  
**Digital Skill:** Medium  
**Primary Device:** Desktop / Laptop

### Responsibilities

- ดูแลลูกค้าหลายราย
- Review financial status
- เตรียมข้อมูลก่อนติดต่อ
- ติดตาม goals
- จัดลำดับลูกค้าที่ต้องได้รับ attention
- บริหารความสัมพันธ์ระยะยาว

### Goals

- เริ่มวันแล้วรู้ว่าต้องดูลูกค้าคนใดก่อน
- เตรียมตัวก่อนประชุมเร็วขึ้น
- เข้าใจลูกค้าโดยไม่ต้องเปิดหลายหน้าจอ
- เห็น issue สำคัญ
- มี recommendation ที่อธิบายได้

### Pain Points

- ลูกค้ามีจำนวนมาก
- ข้อมูลเยอะ
- เวลาจำกัด
- ต้องเลือกว่าจะดูใครก่อน
- ตัวเลขอย่างเดียวไม่บอก action
- บริบทครอบครัวมองเห็นยาก

### Motivation

> “อยากเปิดระบบแล้วรู้เลยว่าวันนี้ต้องดูใคร ทำไม และควร review เรื่องอะไร”

## 8.2 Secondary Persona — Full-stack Developer

**Name:** Beam  
**Age:** 23  
**Role:** Full-stack Developer  
**Technical Skill:** High

### Goals

- Feedback จาก pipeline เร็ว
- ไม่ deploy broken version
- Build reproducible
- ไม่ต้อง run manual deployment
- Security scan อัตโนมัติ

### Pain Points

- Manual build
- Manual test
- Manual deployment
- Environment mismatch
- ลืม security scan
- หา commit ที่ deploy อยู่ได้ยาก

### Motivation

> “เมื่อ push code แล้ว อยากให้ pipeline จัดการ validation, security scan และ deployment ต่อให้อัตโนมัติ”

---

# 9. Customer Journey Map — After Product

| Stage | User Action | Touchpoint | System Response | Expected Feeling |
|---|---|---|---|---|
| Login | เข้าระบบ | Login Page | Authenticate | Secure |
| Morning Review | เปิด Dashboard | Morning Action Plan | แสดง priority clients | Focused |
| Prioritize | ดู client ranking | Priority List | แสดงเหตุผล | Confident |
| Search | ค้นหาลูกค้า | Customer List | Search result | Efficient |
| Filter | กรองกลุ่ม | Filter Controls | Filtered result | In control |
| Understand | เปิด profile | Client Profile | Unified data | Informed |
| Evaluate | ดู Health Score | Health Card | Score + breakdown | Clear |
| Decide | ดู NBA | Recommendation Card | Action + reason | Confident |
| Explore | ดู Family | Relationship Graph | Nodes + edges | Holistic |
| Prepare | อ่าน Summary | Client Summary | Key points | Ready |
| Act | ติดต่อ client | Outside System | — | Prepared |

## 9.1 Journey Detail

### Stage 1 — Login

```text
Email / Username
Password
   ↓
Authentication
   ↓
JWT issued
   ↓
Dashboard
```

### Stage 2 — Morning Action Plan

```text
Good Morning, Narin

Clients Requiring Attention: 6

HIGH
Michael Chen
Health: 58
Reason: Emergency liquidity below target

MEDIUM
Sarah Lee
Health: 72
Reason: Education goal approaching
```

### Stage 3 — Search / Filter

```text
Search: Michael
Filter: Priority = HIGH
Filter: Health = At Risk
```

### Stage 4 — Client Profile

```text
Michael Chen
Financial Health: 64 / 100
Risk: Medium
Primary Goal: Retirement
Goal Progress: 70%
Family Members: 4
Priority: High
```

### Stage 5 — Financial Health

```text
Liquidity       12 / 25
Debt            18 / 25
Savings         13 / 20
Goals           11 / 15
Investment      10 / 15
-----------------------
Total            64 / 100
```

### Stage 6 — Next Best Action

```text
Action: Review Emergency Fund
Reason: Current liquidity covers only 2.3 months of estimated expenses.
Priority: HIGH
```

### Stage 7 — Family Relationship

```text
Michael Chen
   ├── Linda Chen — Spouse
   └── Daniel Chen — Son
```

---

# 10. Functional Requirements

## FR-01 Authentication

ระบบต้องสามารถ Login, Logout, validate credentials, generate JWT, validate JWT และ protect authenticated routes

## FR-02 Customer List

ระบบต้องแสดง Customer Name, Customer ID, Financial Health, Risk Level, Priority และ Main Goal

## FR-03 Customer Search

ค้นหาด้วย Customer Name และ Customer ID และรองรับ partial text search

## FR-04 Customer Filter

Filter อย่างน้อยด้วย:

- Priority
- Financial Health Category

Optional:

- Risk Level
- Goal Type

## FR-05 Morning Action Plan

ระบบต้อง:

1. Calculate Priority
2. Sort customers
3. Show priority client list
4. Show reason
5. Link ไป Client Profile

## FR-06 Client Profile

ต้องแสดง:

- Personal Information
- Financial Health
- Risk Level
- Goals
- Summary
- Next Best Action
- Family Network

## FR-07 Financial Health Score

คำนวณ score แบบ deterministic ช่วง 0–100

## FR-08 Financial Health Breakdown

แสดง component อย่างน้อย:

- Liquidity
- Debt
- Savings
- Goal Progress
- Investment

## FR-09 Next Best Action

Generate recommendation จาก rule โดย output ต้องมี Action, Reason และ Priority

## FR-10 Explainable Recommendation

ทุก Next Best Action ต้องระบุเหตุผล ห้ามแสดง recommendation โดยไม่มี supporting reason

## FR-11 Family Wealth Network

ระบบต้อง display Primary Client, Related Family Members และ Relationship Type เช่น Spouse, Parent, Child, Sibling

## FR-12 Client Summary

Generate summary จากข้อมูลจริงใน database ครอบคลุม:

- Financial Health
- Primary Goal
- Main Risk / Issue
- Recommended Action

## FR-13 GitHub Push Trigger

เมื่อ push code ไป branch ที่กำหนด GitHub ต้องส่ง Webhook ไป Jenkins

## FR-14 Jenkins Checkout

Jenkins ต้อง checkout commit ที่ trigger pipeline

## FR-15 Dependency Installation

Pipeline ต้อง install dependencies ของ frontend และ backend

## FR-16 Automated Lint

Pipeline ต้อง run lint และหยุด pipeline หาก lint fail ตาม policy

## FR-17 Automated Tests

Pipeline ต้อง run:

- Frontend Unit Tests
- Backend Unit Tests
- Backend API Tests

## FR-18 Test Gate

ถ้า test fail:

```text
Pipeline = FAILED
Deployment = SKIPPED
```

## FR-19 Docker Build

หาก test ผ่าน ต้อง build frontend image และ backend image

## FR-20 Docker Image Tag

Image ต้องมี tag ที่ trace กลับ commit ได้ เช่น:

```text
meridian-web:a8f231c
meridian-api:a8f231c
```

## FR-21 Trivy Scan

Scan image หลัง build โดยตรวจ HIGH และ CRITICAL ตาม policy

## FR-22 Security Gate

หาก violation เกิน threshold:

```text
Pipeline = FAILED
Deploy = BLOCKED
```

## FR-23 Automated Deployment

เมื่อทุก gate ผ่าน Jenkins ต้อง execute deployment ด้วย Docker Compose

## FR-24 Health Check

Backend ต้องมี:

```http
GET /health
```

และ Jenkins ต้องตรวจ endpoint หลัง deployment

## FR-25 Pipeline Logging

Jenkins ต้องแสดง stage status:

- Success
- Failed
- Skipped

---

# 11. Non-Functional Requirements

## NFR-01 Security

- Password ต้อง hash
- ห้าม store plaintext password
- JWT ต้องมี expiration
- Protected route ต้อง validate token
- Secrets อยู่ใน environment variables
- `.env` ต้องไม่อยู่ใน repository

## NFR-02 Performance

สำหรับ prototype:

- Common API response target: `< 500 ms` ภายใต้ test environment ที่กำหนด
- Page load target: `< 2 seconds` สำหรับ prototype dataset

## NFR-03 Reliability

Failed build ต้องไม่ replace application version เดิม

## NFR-04 Maintainability

- TypeScript
- Modular structure
- Consistent naming
- ESLint
- Business logic แยกจาก controller
- Environment-based configuration

## NFR-05 Testability

Business logic สำคัญต้องแยกเป็น function/service เช่น:

```text
calculateHealthScore()
calculatePriority()
generateNextBestAction()
generateClientSummary()
```

## NFR-06 Usability

UI ต้อง:

- อ่านง่าย
- Priority ชัด
- Navigation ไม่ซับซ้อน
- เหมาะกับ desktop/laptop

## NFR-07 Explainability

Score และ Recommendation ต้องมี breakdown / reason

## NFR-08 Auditability

Deployment ต้อง trace ได้:

```text
Git Commit → Jenkins Build → Docker Image → Running Version
```

## NFR-09 Portability

ระบบต้องสามารถ run ด้วย Docker Compose บน environment ที่มี Docker Engine และ configuration ที่เหมาะสม

## NFR-10 Data Integrity

ใช้ Foreign Keys และ database constraints เพื่อป้องกัน relationship ที่ไม่สมบูรณ์

---

# 12. Constraints

- **C-01:** Educational prototype ไม่ใช่ production banking system
- **C-02:** ใช้ Mock / Synthetic Data เท่านั้น
- **C-03:** Score และ recommendation ไม่ใช่ licensed financial advice
- **C-04:** MVP ใช้ rule-based logic ไม่พึ่ง ML, LLM หรือ RAG
- **C-05:** Deployment บน single Ubuntu Server / VM
- **C-06:** ใช้ Docker Compose ไม่ใช้ Kubernetes
- **C-07:** Primary application role คือ RM
- **C-08:** GitHub เป็น source control หลัก
- **C-09:** CI trigger ผ่าน GitHub Webhook
- **C-10:** Scope ต้องทำได้ภายในระยะเวลาโปรเจกต์นักศึกษา

---

# 13. Business Rules

## BR-01 Health Score Range

```text
0 <= Financial Health Score <= 100
```

## BR-02 Health Classification

```text
80–100 = Good
60–79  = Moderate
0–59   = At Risk
```

## BR-03 Priority Classification

```text
HIGH
MEDIUM
LOW
```

ทุก priority ต้องมี reason อย่างน้อย 1 รายการ

## BR-04 Emergency Liquidity Prototype Rule

```text
liquidity_months < 3
→ HIGH attention
→ Review Emergency Fund
```

> หมายเหตุ: threshold เป็น prototype rule ไม่ใช่มาตรฐานวิชาชีพทางการเงิน

## BR-05 Recommendation Explainability

Recommendation ทุกอันต้องมี:

- Action
- Reason
- Priority

## BR-06 Client Summary

ห้ามมีข้อมูลที่ไม่มีอยู่ใน database หรือ derived logic ที่กำหนด

## BR-07 Deployment Gate

Deployment เกิดได้เมื่อ:

```text
Lint Pass
AND Tests Pass
AND Docker Build Pass
AND Trivy Pass
```

---

# 14. User Stories and Acceptance Criteria

## US-01 — Login

**Actor:** Relationship Manager  
**Priority:** Must Have

> As a Relationship Manager, I want to securely log in to Meridian so that I can access customer information available to authenticated users.

### Acceptance Criteria

- Given user อยู่หน้า Login, when credential ถูกต้อง, then authenticate สำเร็จ
- Backend issue JWT หลัง login สำเร็จ
- Credential ผิดต้อง return `401 Unauthorized`
- Protected endpoint reject request ที่ไม่มี valid token
- Logout ต้อง clear authentication state ฝั่ง client

## US-02 — View Morning Action Plan

> As an RM, I want to see prioritized customers when I start my day so that I know who requires my attention first.

### Acceptance Criteria

- Dashboard แสดง priority customers
- แต่ละ item มี Customer, Health Score, Priority, Reason
- HIGH แสดงก่อน MEDIUM และ LOW
- Click customer แล้วไป Client Profile ได้

## US-03 — Search Customers

> As an RM, I want to search for customers so that I can quickly access a specific customer profile.

### Acceptance Criteria

- Search by name
- Search by customer ID
- Partial name supported
- Empty result มี proper empty state

## US-04 — Filter Customers

> As an RM, I want to filter customers by priority and financial health so that I can focus on a specific client segment.

### Acceptance Criteria

- Filter by Priority
- Filter by Health
- Search + Filter ใช้พร้อมกันได้
- Reset filter ได้

## US-05 — View Client Profile

> As an RM, I want to view a consolidated client profile so that I can understand important client information without navigating multiple systems.

### Acceptance Criteria

Profile ต้องมี:

- Personal Info
- Health
- Risk
- Goals
- Family
- Summary
- NBA

Client ที่ไม่มีอยู่ต้อง return 404

## US-06 — View Financial Health

> As an RM, I want to view a client's financial health score and its components so that I can understand the factors contributing to the client's current financial condition.

### Acceptance Criteria

- Score 0–100
- มี breakdown
- Same input → Same score
- มี Good / Moderate / At Risk

## US-07 — View Next Best Action

> As an RM, I want to receive a recommended next action for each client so that I can identify an appropriate issue to review first.

### Acceptance Criteria

- Output มี Action, Reason, Priority
- Rules deterministic
- Rule trigger ที่กำหนดต้องให้ expected result

## US-08 — View Family Wealth Network

> As an RM, I want to view relationships between a client and family members so that I can understand relevant family context.

### Acceptance Criteria

- Primary client node
- Related family nodes
- Relationship label
- Data จาก PostgreSQL

## US-09 — View Client Summary

> As an RM, I want a concise client summary so that I can prepare for a client conversation without manually reviewing every data point.

### Acceptance Criteria

- Summary มี Health, Goal, Main Issue, NBA
- ห้ามสร้างข้อมูลที่ไม่มี source ใน database

## US-10 — Automatic CI Trigger

**Actor:** Developer

> As a developer, I want the CI/CD pipeline to start automatically when code is pushed so that validation does not depend on manual execution.

### Acceptance Criteria

- Push to target branch
- GitHub sends Webhook
- Jenkins starts pipeline
- Jenkins records commit SHA

## US-11 — Automated Quality Gate

> As a developer, I want automated tests to run before deployment so that broken code cannot automatically reach the deployed environment.

### Acceptance Criteria

- Frontend tests run
- Backend tests run
- API tests run
- Any failure → Pipeline FAILED and Deploy SKIPPED

## US-12 — Automated Security Gate

> As a security stakeholder, I want Docker images to be scanned before deployment so that images violating the project's vulnerability policy are blocked.

### Acceptance Criteria

- Scan frontend image
- Scan backend image
- Check HIGH / CRITICAL
- Policy violation → pipeline fail
- Deploy skipped

## US-13 — Automated Deployment

> As a developer, I want successfully validated builds to be automatically deployed so that deployment is consistent and repeatable.

### Acceptance Criteria

- Test pass
- Build pass
- Trivy pass
- Jenkins runs `docker compose up -d`
- Health check ผ่านหลัง deploy

## US-14 — Pipeline Visibility

> As a developer, I want to know which pipeline stage failed so that I can quickly identify and resolve deployment problems.

### Acceptance Criteria

Jenkins แยก stage อย่างน้อย:

1. Checkout
2. Install
3. Lint
4. Test
5. Build
6. Scan
7. Deploy
8. Verify

## US-15 — View Health Score Explanation

> As an RM, I want to see the breakdown behind a health score so that I can understand why the system assigned that score.

### Acceptance Criteria

- แสดงทุก score component
- Total ตรงกับผลรวม
- มี classification
- No unexplained score

## US-16 — View Recommendation Reason

> As an RM, I want to understand why a recommendation was generated so that I can judge whether it is appropriate before acting.

### Acceptance Criteria

Recommendation card ต้องมี:

- Action
- Reason
- Priority
- Optional Source Metric / Rule

---

# 15. System Modules

## 15.1 Product Modules

```text
Meridian
│
├── Authentication
├── Dashboard
│   └── Morning Action Plan
├── Customers
│   ├── List
│   ├── Search
│   └── Filter
├── Client Profile
│   ├── Overview
│   ├── Financial Health
│   ├── Goals
│   ├── Summary
│   └── Next Best Action
└── Family Wealth Network
```

## 15.2 DevSecOps Modules

```text
DEVSECOPS
│
├── GitHub
├── GitHub Webhook
├── Jenkins
│   ├── Checkout
│   ├── Install
│   ├── Lint
│   ├── Test
│   ├── Build
│   ├── Scan
│   ├── Deploy
│   └── Verify
├── Docker
├── Docker Compose
└── Trivy
```

---

# 16. Technology Stack

| Layer | Technology |
|---|---|
| Language | TypeScript |
| Frontend | Next.js |
| UI | Bootstrap / React Bootstrap |
| Backend Runtime | Node.js |
| API Framework | Express.js |
| Authentication | JWT |
| Password Hashing | bcrypt |
| Validation | Zod |
| Database | PostgreSQL |
| ORM | Prisma |
| Family Graph | React Flow |
| Frontend Testing | Vitest + React Testing Library |
| Backend Testing | Jest or Vitest |
| API Testing | Supertest |
| Source Control | GitHub |
| CI Trigger | GitHub Webhook |
| CI/CD | Jenkins |
| Containerization | Docker |
| Orchestration | Docker Compose |
| Security Scan | Trivy |
| Server | Ubuntu Server / VM |
| Documentation Hosting | GitHub Pages — Optional |

## 16.1 TypeScript

ใช้เพื่อ:

- Type safety
- DTO consistency
- Refactoring ง่าย
- ลด runtime bugs
- ทำงานร่วมกับ Next.js/Node.js ได้ดี

## 16.2 Next.js

ใช้สำหรับ:

- Routing
- Pages
- Components
- Dashboard
- Customer Profile
- Authentication UI

ใน architecture นี้ Next.js เป็น frontend และ Express.js เป็น backend API หลัก

## 16.3 Express.js

ช่วยให้ frontend/backend separation ชัดเจน และเหมาะกับ:

- REST API
- Unit/API testing
- Docker image แยก backend
- CI/CD demo

## 16.4 PostgreSQL

ใช้เก็บข้อมูล structured:

- Users
- Clients
- Financial Profiles
- Goals
- Family Relationships

## 16.5 Prisma

ใช้สำหรับ:

- Schema management
- Migration
- Type-safe queries
- Relation handling

---

# 17. System Architecture

```text
                    Relationship Manager
                            │
                            ▼
                       Web Browser
                            │
                            ▼
                   Next.js + TypeScript
                            │
                         REST API
                            │
                            ▼
                 Node.js + Express.js
                            │
                      JWT Middleware
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
        Business Rule Engine        PostgreSQL
                │
       ┌────────┼─────────┐
       ▼        ▼         ▼
 Health Score Priority    NBA
       │
       ▼
 Client Summary
```

## 17.1 Deployment Architecture

```text
┌──────────────────────────────────────┐
│ Ubuntu Server / VM                   │
│                                      │
│ Jenkins Container                    │
│ Docker Engine                        │
│                                      │
│ ┌──────────────┐                     │
│ │ Next.js Web  │                     │
│ └──────┬───────┘                     │
│        ▼                             │
│ ┌──────────────┐                     │
│ │ Express API  │                     │
│ └──────┬───────┘                     │
│        ▼                             │
│ ┌──────────────┐                     │
│ │ PostgreSQL   │                     │
│ └──────────────┘                     │
└──────────────────────────────────────┘
```

---

# 18. Database Design

## 18.1 users

```text
id
email
password_hash
name
role
created_at
updated_at
```

## 18.2 clients

```text
id
customer_code
first_name
last_name
age
occupation
risk_level
rm_id
created_at
updated_at
```

Relation:

```text
users (RM) 1 ─── N clients
```

## 18.3 financial_profiles

```text
id
client_id
monthly_income
monthly_expense
liquid_assets
total_assets
total_debt
savings
investments
updated_at
```

Relation:

```text
clients 1 ─── 1 financial_profiles
```

## 18.4 goals

```text
id
client_id
goal_type
target_amount
current_amount
target_date
created_at
updated_at
```

Relation:

```text
clients 1 ─── N goals
```

## 18.5 family_relationships

```text
id
client_id
related_client_id
relationship_type
created_at
```

## 18.6 recommendations — Optional Persisted Model

```text
id
client_id
action
reason
priority
created_at
status
```

MVP สามารถ generate recommendation on request โดยไม่ persist ได้

---

# 19. API Design

## Authentication

```http
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

## Clients

```http
GET /api/clients
GET /api/clients/:id
GET /api/clients?search=michael
GET /api/clients?priority=HIGH
GET /api/clients?health=AT_RISK
```

## Dashboard

```http
GET /api/dashboard/morning-action-plan
```

## Financial Health

```http
GET /api/clients/:id/health
```

Example:

```json
{
  "score": 64,
  "classification": "MODERATE",
  "breakdown": {
    "liquidity": 12,
    "debt": 18,
    "savings": 13,
    "goals": 11,
    "investment": 10
  }
}
```

## Next Best Action

```http
GET /api/clients/:id/recommendations
```

Example:

```json
{
  "action": "Review Emergency Fund",
  "reason": "Current liquidity covers only 2.3 months of estimated expenses.",
  "priority": "HIGH"
}
```

## Family

```http
GET /api/clients/:id/family
```

## Summary

```http
GET /api/clients/:id/summary
```

## Health Check

```http
GET /health
```

---

# 20. Authentication Flow

```text
User
 ↓
Login Form
 ↓
POST /api/auth/login
 ↓
Express
 ↓
Find User
 ↓
bcrypt.compare()
 ↓
Credential Valid?
 ├── NO → 401
 └── YES
       ↓
     Sign JWT
       ↓
    Return Token
       ↓
Authorization: Bearer <token>
       ↓
JWT Middleware
       ↓
Protected API
```

---

# 21. Financial Health Score Design

## 21.1 Prototype Components

| Component | Max Score |
|---|---:|
| Liquidity | 25 |
| Debt | 25 |
| Savings | 20 |
| Goal Progress | 15 |
| Investment | 15 |
| **Total** | **100** |

## 21.2 Example

```text
Liquidity       18/25
Debt            20/25
Savings         14/20
Goals           12/15
Investment      10/15
---------------------
Total            74/100
```

Classification:

```text
80–100 = Good
60–79  = Moderate
0–59   = At Risk
```

## 21.3 Design Principles

Score ต้อง:

- Deterministic
- Testable
- Explainable
- Rule-based
- ไม่พึ่ง LLM

---

# 22. Morning Action Plan / Priority

## 22.1 Purpose

ตอบคำถาม:

> วันนี้ RM ควรดูลูกค้าคนใดก่อน?

## 22.2 Example Signals

- Financial Health ต่ำ
- Liquidity ต่ำ
- Debt สูง
- Goal deadline ใกล้
- Goal progress ต่ำ
- Recent event
- No recent review

## 22.3 Example Logic

```text
IF health_score < 60
THEN priority += high_weight

IF liquidity_months < 3
THEN priority += high_weight

IF target_date <= 12 months
AND goal_progress is behind
THEN priority += medium_weight
```

Output:

```text
HIGH
MEDIUM
LOW
```

---

# 23. Next Best Action

## Rule 1 — Emergency Fund

```text
IF liquidity_months < 3
THEN
Action = Review Emergency Fund
Priority = HIGH
```

## Rule 2 — Goal Funding

```text
IF goal deadline < 12 months
AND progress below expected
THEN
Action = Review Goal Funding
```

## Rule 3 — Debt

```text
IF debt ratio > threshold
THEN
Action = Review Debt Position
```

## Rule 4 — General Review

```text
IF no major rule triggered
THEN
Action = Routine Financial Review
Priority = LOW
```

ทุก recommendation ต้องมี:

- Action
- Reason
- Priority

---

# 24. Client Summary

MVP ไม่ใช้ LLM แต่ใช้ template + rules

ตัวอย่าง:

```text
Michael Chen currently has a moderate financial health score of 64.
His primary financial goal is retirement.
Emergency liquidity is below the prototype target threshold.
The highest-priority action is to review his emergency fund position.
```

ข้อดี:

- Deterministic
- No hallucination
- No API cost
- Testable
- Stable

---

# 25. Family Wealth Network

ใช้ PostgreSQL เป็น data source และ React Flow สำหรับ visualization

```text
PostgreSQL
   ↓
Express API
   ↓
JSON Nodes / Edges
   ↓
React Flow
```

ตัวอย่าง:

```text
Michael Chen
   ├── Linda Chen — Spouse
   └── Daniel Chen — Son
```

ไม่จำเป็นต้องใช้ Graph Database เช่น Neo4j ใน MVP

---

# 26. Testing Strategy

## 26.1 Priority

1. Unit Tests
2. API Tests
3. Frontend Component Tests
4. E2E — Optional

## 26.2 Backend Unit Tests

Test business logic:

```text
calculateHealthScore()
calculatePriority()
generateNextBestAction()
generateClientSummary()
```

## 26.3 API Tests

ใช้ Supertest ทดสอบ:

```text
POST /api/auth/login
GET /api/clients
GET /api/clients/:id
GET /api/clients/:id/health
GET /api/clients/:id/recommendations
GET /health
```

## 26.4 Frontend Tests

ใช้ Vitest + React Testing Library กับ:

- Login Form
- Customer List
- Health Score Card
- Priority Badge
- NBA Card

## 26.5 Example Test Case

```text
Given:
liquidity_months = 2

When:
generateNextBestAction()

Then:
action = "Review Emergency Fund"
priority = "HIGH"
```

---

# 27. CI/CD and DevSecOps Design

```text
Developer
    │
    │ git push
    ▼
GitHub
    │
    │ Webhook
    ▼
Jenkins
    │
    ├── Checkout
    ├── Install
    ├── Lint
    ├── Test
    ├── Docker Build
    ├── Trivy Scan
    ├── Security Gate
    ├── Docker Compose Deploy
    └── Health Check
             │
             ▼
        Meridian
```

---

# 28. Jenkins Pipeline

## Stage 1 — Checkout

- Checkout commit
- Record commit SHA

## Stage 2 — Install

- Install frontend dependencies
- Install backend dependencies

## Stage 3 — Lint

```text
npm run lint
```

Failure → Pipeline Stop

## Stage 4 — Test

Run:

- Frontend Tests
- Backend Unit Tests
- API Tests

Failure:

```text
Pipeline FAILED
Deploy SKIPPED
```

## Stage 5 — Docker Build

Build:

```text
meridian-web:<git-sha>
meridian-api:<git-sha>
```

## Stage 6 — Trivy Scan

Scan frontend และ backend image

## Stage 7 — Security Gate

HIGH / CRITICAL ตาม policy → fail pipeline

## Stage 8 — Deploy

```bash
docker compose up -d
```

## Stage 9 — Verify

Call:

```http
GET /health
```

Expected:

```http
200 OK
```

---

# 29. Docker and Docker Compose

## 29.1 Services

อย่างน้อย:

```text
frontend
backend
postgres
```

## 29.2 Communication

```text
Browser → Frontend → Backend → PostgreSQL
```

## 29.3 Environment Variables

ตัวอย่าง:

```text
DATABASE_URL
JWT_SECRET
JWT_EXPIRES_IN
NODE_ENV
API_URL
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_DB
```

ห้าม commit `.env`

ใช้ `.env.example` สำหรับ documentation

---

# 30. Trivy Security Gate

## 30.1 Purpose

ตรวจ known vulnerabilities ใน Docker images ก่อน deploy

## 30.2 Targets

- Frontend image
- Backend image

## 30.3 Policy Example

```text
Severity: HIGH, CRITICAL
```

หากตรง policy:

```text
Exit Non-Zero
→ Jenkins Stage Failed
→ Deploy Skipped
```

## 30.4 Scope Clarification

Trivy ในโปรเจกต์นี้ไม่ได้แทน:

- SAST
- DAST
- Penetration Testing
- Secure Code Review

ใช้เพื่อ demonstrate **container vulnerability gate**

---

# 31. Deployment and Health Check

## 31.1 Deployment

```bash
docker compose up -d
```

## 31.2 Health Check

```http
GET /health
```

Expected:

```http
200 OK
```

## 31.3 Failure

ถ้า health check fail:

- Jenkins mark stage fail
- Log แสดง failure
- Rollback เป็น future work

---

# 32. Repository Structure

```text
meridian-lite/
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── tests/
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── utils/
│   │   └── app.ts
│   ├── tests/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── docs/
├── docker-compose.yml
├── Jenkinsfile
├── .env.example
├── .gitignore
└── README.md
```

---

# 33. Git Strategy

สำหรับทีมเล็ก:

```text
main
develop
feature/*
```

ตัวอย่าง:

```text
feature/authentication
feature/customer-list
feature/financial-health
feature/nba
feature/family-network
feature/jenkins-pipeline
```

Recommended flow:

```text
feature/*
   ↓
Pull Request
   ↓
develop
   ↓
main
   ↓
Deploy
```

หากทีมเล็กมาก สามารถลดเหลือ `main + feature/*`

---

# 34. GitHub Pages

## 34.1 Main Application

**ไม่แนะนำ** ให้ใช้ GitHub Pages สำหรับ application หลัก เพราะระบบมี:

- Next.js
- Express.js
- PostgreSQL

GitHub Pages เหมาะกับ static site และไม่สามารถรัน Express API หรือ PostgreSQL backend ได้

## 34.2 Recommended Usage

ใช้ GitHub Pages สำหรับ:

- Project Documentation
- Architecture Diagram
- Feature Overview
- Screenshots
- CI/CD Flow
- Demo Video
- Team Information
- Installation Guide

Deployment split:

```text
GitHub Pages → Documentation Only
Ubuntu Server / VM → Meridian Application
```

---

# 35. Security Considerations

## 35.1 Password Storage

ใช้ bcrypt hash ก่อนเก็บ database

## 35.2 JWT

- Secret อยู่ใน environment variable
- Token มี expiration
- Middleware validate token

## 35.3 Secrets

ห้าม commit:

```text
.env
JWT_SECRET
DATABASE_PASSWORD
API_SECRET
```

## 35.4 Database

ใช้:

- Foreign Keys
- Validation
- Prisma / parameterized queries

## 35.5 Jenkins Credentials

Sensitive credentials ต้องเก็บใน Jenkins Credentials ไม่ hardcode ใน Jenkinsfile

## 35.6 Docker Socket Caveat

หาก Jenkins container mount:

```text
/var/run/docker.sock
```

Jenkins จะสามารถควบคุม Docker daemon ของ host ได้ในระดับสูง

ข้อดี:

- Setup ง่าย
- เหมาะกับ prototype

ข้อเสีย:

- Security risk สูง
- ไม่ใช่ production best practice

ควรระบุในรายงานว่าเป็น architectural trade-off ของ prototype

---

# 36. Definition of Done

Feature ถือว่าเสร็จเมื่อ:

```text
Requirement Implemented
      ↓
Code Review / Self Review
      ↓
Lint Pass
      ↓
Unit Test Pass
      ↓
API / Component Test Pass
      ↓
Docker Build Pass
      ↓
Trivy Pass
      ↓
Deploy Pass
      ↓
Health Check Pass
```

---

# 37. Project Success Criteria

## 37.1 Product Success

RM ต้องสามารถ:

- Login
- ดู Morning Action Plan
- Search customer
- Filter customer
- เปิด Client Profile
- ดู Financial Health Score
- ดู score breakdown
- ดู Goals
- ดู Next Best Action
- เข้าใจเหตุผล recommendation
- ดู Family Relationship
- อ่าน Client Summary

## 37.2 CI/CD Success

ระบบต้องพิสูจน์ได้ว่า:

- Push trigger Jenkins อัตโนมัติ
- Lint fail block pipeline
- Test fail block pipeline
- Docker image build สำเร็จ
- Image tag มี commit SHA
- Trivy scan ทำงาน
- Security policy violation block deploy
- Valid build deploy ด้วย Docker Compose
- Health check ยืนยัน service หลัง deployment
- Developer เห็น stage logs ได้

## 37.3 Suggested Demo Scenarios

### Demo 1 — Successful Pipeline

```text
Push
→ Webhook
→ Jenkins
→ Tests Pass
→ Build
→ Trivy Pass
→ Deploy
→ Health OK
```

### Demo 2 — Test Failure

```text
Push
→ Jenkins
→ Test Failed
→ Build / Deploy Skipped
```

### Demo 3 — Security Gate

```text
Build
→ Trivy
→ Policy Violation
→ Deployment Blocked
```

### Demo 4 — Application

```text
Login
→ Morning Action Plan
→ Select HIGH Client
→ Client Profile
→ Health Breakdown
→ NBA Reason
→ Family Graph
```

---

# 38. Development Roadmap

## Sprint 1 — Foundation

- Repository
- TypeScript
- Next.js
- Express
- PostgreSQL
- Prisma
- Docker
- Authentication

## Sprint 2 — Customer Core

- Customer List
- Search
- Filter
- Client Profile

## Sprint 3 — Financial Logic

- Financial Profile
- Health Score
- Score Breakdown
- Goals
- Priority Score
- Morning Action Plan

## Sprint 4 — Decision Support

- Next Best Action
- Recommendation Reason
- Client Summary
- Family Wealth Network

## Sprint 5 — Testing

- Unit Tests
- API Tests
- Frontend Component Tests
- Lint

## Sprint 6 — DevSecOps

- Jenkins Docker
- GitHub Webhook
- Jenkinsfile
- Docker Build
- Image Tagging
- Trivy
- Docker Compose Deploy
- Health Check

## Sprint 7 — Finalization

- UI polish
- Seed data
- README
- Architecture Diagram
- Demo scenarios
- GitHub Pages documentation
- Final report
- Presentation

---

# 39. Out of Scope / Future Work

- RAG
- Vector Database
- AI Chat
- ML Risk / Churn Prediction
- Digital Twin
- Advanced NBA Ranking
- Historical Event Detection
- Real-time Notifications
- Real Core Banking Integration
- Consent Layer
- Advanced RBAC
- Audit Trail
- Docker Registry
- Blue/Green Deployment
- Automated Rollback
- Kubernetes
- SAST
- DAST
- SBOM
- Dependency Scanning
- Centralized Logging
- Monitoring / Observability

---

# 40. Final Project Positioning

โปรเจกต์นี้ไม่ควรถูกนำเสนอว่าเป็น **AI Banking Platform ระดับ Production** เพราะ scope และ regulation/security ใหญ่เกินขอบเขตโครงงาน

ควรนำเสนอว่า:

> **Meridian is a realistic full-stack financial relationship management prototype used to design and demonstrate an end-to-end Automated DevSecOps CI/CD Pipeline. The system centralizes essential client information, provides explainable rule-based financial health and next-action recommendations, and automatically validates, security-scans, builds, and deploys software updates using GitHub, Jenkins, Docker, Trivy, and Docker Compose.**

## 40.1 Final Architecture Summary

```text
                         PRODUCT SIDE

                         RM / User
                            │
                            ▼
                    Next.js + TypeScript
                            │
                         REST API
                            │
                            ▼
                   Node.js + Express
                            │
                      JWT Middleware
                            │
          ┌─────────────────┴─────────────────┐
          │                                   │
          ▼                                   ▼
    PostgreSQL                         Business Rules
                                          │
                            ┌─────────────┼─────────────┐
                            ▼             ▼             ▼
                      Health Score     Priority        NBA
                            │
                            ▼
                     Client Summary

                       DEVSECOPS SIDE

Developer
    │
    │ git push
    ▼
GitHub
    │
    │ Webhook
    ▼
Jenkins
    │
    ├── Checkout
    ├── Install
    ├── Lint
    ├── Test
    ├── Docker Build
    ├── Trivy Scan
    ├── Security Gate
    ├── Docker Compose Deploy
    └── Health Check
              │
              ▼
       Meridian Running
```

## 40.2 Recommended Final MVP Feature Set

### User-facing

- Authentication
- Morning Action Plan
- Customer List
- Search
- Filter
- Client Profile
- Financial Health Score
- Health Breakdown
- Goals
- Next Best Action
- Recommendation Reason
- Client Summary
- Family Wealth Network

### Engineering

- TypeScript
- Next.js
- Node.js
- Express.js
- JWT
- PostgreSQL
- Prisma
- GitHub
- GitHub Webhook
- Jenkins
- Docker
- Docker Compose
- Trivy
- Automated Tests
- Automated Deployment
- Health Check
- Git Commit Traceability

---

# Short Project Summary

Meridian เป็น Full-stack Financial Relationship Management Prototype สำหรับ Relationship Manager ที่ช่วยจัดลำดับลูกค้า แสดงข้อมูลแบบรวมศูนย์ คำนวณ Financial Health Score แบบ rule-based สร้าง Next Best Action ที่อธิบายเหตุผลได้ และแสดง Family Relationship

ตัว application ถูกใช้เป็น realistic workload สำหรับ Automated DevSecOps CI/CD Pipeline โดยทุก code push สามารถ trigger Jenkins ผ่าน GitHub Webhook เพื่อทำ lint, automated tests, Docker build, Trivy vulnerability scanning, security gating, Docker Compose deployment และ health check โดยอัตโนมัติ

จุดสำคัญของโครงงานจึงไม่ได้อยู่ที่ความซับซ้อนของ AI แต่เป็นการเชื่อม **Full-stack Software Engineering + Testing + Containerization + Security + Continuous Deployment** ให้ทำงานร่วมกันเป็นระบบเดียวที่สามารถ demo และพิสูจน์ได้จริง
