# คู่มือ Deploy ขึ้น Vercel + ตั้งค่า Supabase สมาชิก (ฟรี)

## 1. สร้างโปรเจกต์ Supabase (ฐานข้อมูลสมาชิก + Cloud Sync)
1. ไปที่ https://supabase.com และสร้างโปรเจกต์ใหม่ (Free Tier)
2. เปิดเมนู **SQL Editor** -> New Query -> คัดลอกไฟล์ `supabase/schema.sql` ไปวางแล้วกด **Run**
3. (ตัวเลือกสำหรับการเทสทันที) ใน **Authentication -> Providers -> Email** สามารถปิด "Confirm email" ชั่วคราวเพื่อให้คนทดสอบสมัครแล้วล็อกอินได้ทันทีโดยไม่ต้องยืนยันอีเมล หรือเปิดไว้ตามปกติเมื่อใช้งานจริง
4. เปิด **Project Settings -> Data API / API Keys** แล้วคัดลอก:
   - `Project URL` (เช่น `https://xxxx.supabase.co` ไม่ต้องมี `/rest/v1/`) -> `NEXT_PUBLIC_SUPABASE_URL`
   - `Publishable key` (`sb_publishable_...`) หรือ `anon public key` (**ห้ามใช้ `sb_secret_...`**) -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 1.5 (แนะนำ) เปิดใช้ปุ่ม Login with Google
1. ใน **Google Cloud Console** -> **APIs & Services -> Credentials** -> สร้าง **OAuth client ID (Web application)**
   - ช่อง **Authorized redirect URIs** ให้ใส่: `https://<your-project-ref>.supabase.co/auth/v1/callback`
2. ใน **Supabase Dashboard -> Authentication -> Sign In / Providers -> Google**:
   - เปิด **Enable Sign in with Google** แล้วนำ Client ID และ Client Secret จาก Google มาวาง
3. ใน **Supabase Dashboard -> Authentication -> URL Configuration**:
   - ตั้ง **Site URL** เป็น `https://your-app.vercel.app`
   - เพิ่ม **Redirect URLs** เป็น `https://your-app.vercel.app/**` (และ `http://localhost:3000/**` สำหรับเทสในเครื่อง)

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
