# 6. DevSecOps and Deployment

## Branch and trigger policy

ใช้ `main + feature/*` Developer สร้าง feature branch และเปิด pull request; PR webhook ที่ตรวจ signature และ allowed branch trigger validation (install, lint, tests และ build/scan ตาม policy) แต่ห้าม deploy Push/merge เข้า `main` ที่ตรวจ signature แล้วเท่านั้น trigger deployment pipeline Jenkins ไม่รัน fork PR ที่ไม่เชื่อถือบน agent นี้ และการเปลี่ยน Jenkinsfile, Dockerfile, Compose หรือ build script ต้องผ่านผู้ดูแลที่เชื่อถือได้

```text
feature/* → Pull Request validation → main → GitHub webhook → Jenkins → VM deployment
```

## Pipeline

| Stage | Action | Failure behavior |
|---|---|---|
| Checkout | checkout commit ที่ trigger และบันทึก short/full SHA | pipeline fail |
| Install | install frontend และ backend dependencies จาก lockfile ด้วย `npm ci` | pipeline fail |
| Lint | รัน lint ของทั้งสอง application | stop; deploy skipped |
| Test | frontend component, backend unit และ API tests | stop; deploy skipped |
| Build | build `meridian-web:<SHA>` และ `meridian-api:<SHA>` จาก build environment ที่ระบุเวอร์ชัน | stop; deploy skipped |
| Scan | Trivy scan ทั้งสอง images | scan error หรือ HIGH/CRITICAL → fail; deploy skipped |
| Deploy | export SHA ให้ Compose แล้ว `docker compose up -d` | pipeline fail |
| Verify | poll `GET /health` ตาม retry/timeout ที่กำหนด | pipeline fail พร้อม logs |

Jenkins ต้องแสดง stage เป็น Success, Failed หรือ Skipped และไม่ใช้ `latest` เป็น version ที่ deploy SHA ที่ `/health` ส่งคืนต้องตรงกับ SHA ของ Jenkins build เพื่อรองรับ NFR-08 อนุญาต build/deployment ครั้งละหนึ่ง run และ build/scan images ตามลำดับเพื่อลด peak resource usage

## Runtime topology

Ubuntu VM เดียวรัน Jenkins controller, build agent, Caddy, frontend, backend API และ PostgreSQL ผ่าน Docker Engine/Compose Browser ติดต่อ HTTPS ที่ Caddy; Caddy route `/api/*` และ `/health` ไป API, หน้าอื่นไป frontend เพื่อให้ cookie มี same-origin API ไม่ publish port สู่ภายนอก Jenkins controller มี built-in executor เป็นศูนย์; build agent บน VM เดียวมี executor หนึ่งตัวและเป็นผู้รัน build/scan/deploy

```text
GitHub ─webhook→ Jenkins ─Docker socket→ Docker Compose
                                           ├─ Caddy
                                           ├─ Next.js web
                                           ├─ Express API
                                           └─ PostgreSQL
```

Docker images เก็บใน daemon ของ VM; ไม่มี registry ใน MVP Environment variables ขั้นต่ำคือ `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `NODE_ENV`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` และ image SHA Compose file ต้องไม่กำหนด secret จริง Agent ที่เข้าถึง Docker socket มีอำนาจระดับ host; การรัน non-root container หรือเปลี่ยน socket mode ไม่เป็น security boundary สำหรับ build script ที่ไม่เชื่อถือ

## Trivy policy

scan frontend และ backend images หลัง build ด้วย severity `HIGH,CRITICAL` และ exit non-zero เมื่อพบผลลัพธ์ใด ๆ ในระดับดังกล่าว ห้ามใช้ `--ignore-unfixed` หรือ exception file เพื่อให้ pipeline ผ่าน หาก Trivy command, database update หรือ report parsing ล้มเหลว ถือว่า scan fail และไม่ deploy CVE ที่ไม่มี fix อาจทำให้ build ถูก block; นี่คือ trade-off ของ policy ให้แก้ด้วยการอัปเดต dependency/base image แล้วสแกนใหม่ ผล scan เปลี่ยนได้เมื่อฐานข้อมูลช่องโหว่เปลี่ยน

Trivy เป็น container vulnerability gate ไม่ทดแทน SAST, DAST, penetration test หรือ secure code review

## Deployment verification and failure

ก่อนเปลี่ยน application containers pipeline ต้องตรวจ configuration และ run migration ที่เข้ากันได้; migration fail ต้องหยุด deployment และห้าม reset/seed database อัตโนมัติ หลัง Compose deploy Jenkins ตรวจ `GET /health` ให้ API/database ready และ SHA ตรง รวมถึงตรวจหน้าเว็บผ่าน Caddy ภายใน 120 วินาที โดยแต่ละ request timeout 5 วินาที หากไม่ผ่าน stage Verify ต้อง failed และเก็บ command/service logs ไว้ใน build output ไม่ rollback อัตโนมัติ; rollback, blue/green และ registry เป็น Future Work

## Host baseline and measurement

ใช้ Ubuntu VM 4 vCPU / 8 GiB RAM เป็น baseline สำหรับทดสอบที่เสนอ ไม่ใช่ค่าขั้นต่ำที่พิสูจน์แล้ว ก่อน demo ให้บันทึก peak RAM, OOM events, disk usage ของ images/cache และ API/page latency ขณะ pipeline ทำงาน แยกงบ runtime containers ออกจาก build และ scanner ที่ใช้ชั่วคราว Memory limit ของ container ต้องตั้งหลังวัดจริงและเหลือ headroom ให้ host/Jenkins; swap เป็นเพียง buffer ที่ช้ากว่า RAM ไม่ใช่สิ่งทดแทน RAM

## Demo scenarios

1. Successful: push main → webhook → tests/build/scan pass → deploy → health 200
2. Test failure: test fail → Build, Scan, Deploy, Verify เป็น skipped
3. Security failure: image มี HIGH/CRITICAL → scan fail → Deploy/Verify skipped
4. Health failure: deploy command สำเร็จแต่ `/health` ไม่พร้อม → Verify failed และแสดง logs
