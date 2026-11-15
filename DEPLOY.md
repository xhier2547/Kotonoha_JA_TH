# คู่มือ Deploy ขึ้น Vercel + ตั้งค่า Supabase สมาชิก (ฟรี)

## 1. สร้างโปรเจกต์ Supabase (ฐานข้อมูลสมาชิก + Cloud Sync)
1. ไปที่ https://supabase.com และสร้างโปรเจกต์ใหม่ (Free Tier)
2. เปิดเมนู **SQL Editor** -> New Query -> คัดลอกไฟล์ `supabase/schema.sql` ไปวางแล้วกด **Run**
3. (ตัวเลือกสำหรับการเทสทันที) ใน **Authentication -> Providers -> Email** สามารถปิด "Confirm email" ชั่วคราวเพื่อให้คนทดสอบสมัครแล้วล็อกอินได้ทันทีโดยไม่ต้องยืนยันอีเมล หรือเปิดไว้ตามปกติเมื่อใช้งานจริง
4. เปิด **Project Settings -> API** แล้วคัดลอก:
   - `Project URL` -> `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> สำหรับรันบนเครื่องตัวเอง: สร้างไฟล์ `.env.local` ที่ root โปรเจกต์ตามตัวอย่างใน `.env.example`

## 2. Deploy ขึ้น Vercel
1. Push โค้ดขึ้น GitHub / GitLab
2. เปิด https://vercel.com -> **Add New Project** -> เลือก repository นี้
3. ในส่วน **Environment Variables** ให้เพิ่มทั้ง 2 ค่า:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. กด **Deploy**

## 3. เช็กสถานะระบบหลัง Deploy
- เปิด `/api/health` เพื่อตรวจสอบว่า `supabaseConfigured: true`
- เปิด `/auth` เพื่อทดสอบสมัครสมาชิก / ล็อกอิน / กด Sync ข้ามเครื่อง และทดสอบโหมด Guest
- **หมายเหตุเรื่อง AI & Kuromoji**:
  - ฟีเจอร์ AI (Kaiwa, AI Mock Test, AI Weakness Coach) ออกแบบแบบ BYOK — ผู้ใช้แต่ละคนกรอก Gemini/OpenAI API Key ของตนเองใน `/settings` (เก็บในเครื่องผู้ใช้ ไม่ถูกอัปโหลดขึ้น Cloud ตอน Sync เพื่อความปลอดภัยของคีย์)
  - `/api/translate` รองรับการแปลภาษาไทยแบบ Dictionary + Gemini/OpenAI Fallback
