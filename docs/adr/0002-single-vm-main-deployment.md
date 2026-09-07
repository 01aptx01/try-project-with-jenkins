# Deploy main on one Ubuntu VM

MVP ใช้ Jenkins, Caddy, frontend, API และ PostgreSQL บน Ubuntu VM เดียว และ deploy เฉพาะ commit ที่ merge เข้า `main` เพื่อให้สาธิต pipeline ได้ภายในขอบเขตโครงงาน โดย image ใช้ commit SHA และเก็บใน Docker daemon ของ VM ข้อแลกเปลี่ยนคือไม่มี isolation, image registry, high availability หรือ automatic rollback ระดับ production
