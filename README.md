# billshere 🧾

Web app มือถือเป็นหลัก สำหรับ **สร้างบิลกลุ่ม หารส่วนลด และเก็บเงินด้วย PromptPay** —
ย้าย workflow เดิมจาก Google Sheet มาเป็นแอปที่ใช้ภายในบริษัท

## ฟีเจอร์
- 🔐 ล็อกอิน/สมัครสมาชิก (JWT httpOnly cookie) — ใช้ภายในบริษัท ล็อกอินแล้วเห็นบิลได้เลย
- 🧾 สร้าง "โพสบิล" แท็กสมาชิก + ใส่ราคาแต่ละคน
- ➗ หารส่วนลดอัตโนมัติ 2 แบบ: **FIXED** (ส่วนลดรวมหารเท่ากัน เช่น 70÷8=8.75) และ **PERCENT** (ลด % ต่อคน)
- 📱 แสดง **PromptPay QR** ของผู้สร้างโพส พร้อมยอดของแต่ละคน ให้คนอื่นสแกนโอน
- 🧾 แนบสลิปโอน → เจ้าของบิลกดยืนยัน "จ่ายแล้ว"
- 🔍 ค้นหา/ไล่ดูบิลทั้งหมด, แดชบอร์ด "โพสของฉัน" + "โพสที่ถูกแท็ก"
- 📊 สรุปรายวัน + ส่งออก CSV

## Stack
Next.js 16.2.10 (App Router, Server Actions) · PostgreSQL 16 · Prisma 6 · Tailwind CSS 4 ·
Auth: `jose` + `bcryptjs` · QR: `promptpay-qr` + `qrcode` · Docker

## เริ่มใช้งานด้วย Docker (แนะนำ)
```bash
cp .env.example .env      # แก้ JWT_SECRET ในโปรดักชัน
docker compose up --build
```
เปิด http://localhost:3000 — entrypoint จะรัน `prisma migrate deploy` อัตโนมัติ

## เชื่อม DBeaver
Postgres เปิดที่ **host `localhost` port `5433`** (เลี่ยงชนกับ Postgres เครื่องที่พอร์ต 5432)
- Database / User / Password: ตาม `.env` (ค่าเริ่มต้น `billshere` / `billshere` / `billshere_pass`)

## รันแบบ dev (แอปนอก Docker, DB ใน Docker)
```bash
docker compose up -d db           # Postgres อย่างเดียว (localhost:5433)
npm install
npx prisma migrate dev            # สร้าง/อัปเดตตาราง
npm run dev
```

## บัญชีเดโม (seed ไว้แล้ว)
| อีเมล | รหัสผ่าน | บทบาท |
|-------|----------|-------|
| owner@demo.com | 123456 | เจ้าของบิล (ตั้ง PromptPay ไว้แล้ว) |
| friend@demo.com | 123456 | ผู้ถูกแท็ก |

## โครงสร้าง
- `src/app/(auth)/` — login, register
- `src/app/(app)/` — dashboard, search, posts/new, posts/[id], profile, summary
- `src/actions/` — server actions (auth, posts, slips, profile)
- `src/lib/` — db, auth, jwt, discount, promptpay, summary, format
- `prisma/schema.prisma` — User, Post, Participant
