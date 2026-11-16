# สรุปภาพรวมระบบ Kotonoha Studio (言の葉スタジオ)

> เอกสารสรุปสิ่งที่พัฒนา แก้ไข และโครงสร้างระบบทั้งหมดของโปรเจกต์ เพื่อใช้อ่านทบทวนและต่อยอดในอนาคต  
> Production: `https://kotonohajath.vercel.app/`  
> GitHub: `https://github.com/xhier2547/Kotonoha_JA_TH`

---

## 1. Tech Stack และสถาปัตยกรรมหลัก

- **Framework:** Next.js `16.4.6` (App Router / Turbopack) + React `19.3.0` + TypeScript
- **Styling:** Tailwind CSS v4 + ฟอนต์ญี่ปุ่น (`Noto Sans JP`, `Noto Serif JP`) + ธีม Washi Light / Sumi Dark / System
- **ฐานข้อมูลในเครื่อง (Offline-First):** Dexie (IndexedDB `kotonoha_studio_db`, 10 ตาราง)
- **ระบบจำคำศัพท์:** `ts-fsrs` (FSRS-7) พร้อมคำนวณ Memory Curve และจัดลำดับการ์ดตามระดับ JLPT ของผู้เรียน
- **ตัดคำ & วิเคราะห์ภาษาญี่ปุ่น:** Kuromoji (`/api/tokenize`), WanaKana (Romaji IME), Dictionary & Kanji Radicals, Web Speech API + Gemini Live WebSocket
- **ระบบสมาชิก & Cloud Sync:** Supabase Auth (Email/Password + Google OAuth) + PostgreSQL (`public.profiles`, `public.user_study_data` พร้อม Row Level Security)
- **โมเดล AI (BYOK):** ผู้ใช้กรอก Gemini / OpenAI API Key ของตนเอง (เก็บเฉพาะในเครื่องผู้ใช้ และถูกตัดทิ้งเสมอเมื่อซิงค์ขึ้น Cloud ด้วย `stripSecrets: true`)

---

## 2. หน้าเว็บและ API ทั้งหมดในระบบ (22 Routes)

### หน้าหลักสำหรับผู้เรียน (`src/app/*`)
| Route | หน้าที่หลัก |
| :--- | :--- |
| `/` ([page.tsx](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/src/app/page.tsx)) | **Dashboard:** สรุปการ์ดค้าง/Streak, แผนการเรียนส่วนตัวรายวันตามระดับและเวลา/วัน, Memory Curve, Study Heatmap 84 วัน, AI Weakness Coach, และ Onboarding Modal |
| `/kana` ([kana/page.tsx](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/src/app/kana/page.tsx)) | **Kana Dojo:** ฝึก Hiragana & Katakana, ภาพช่วยจำ, กระดานฝึกเขียน, Active Recall และทำความเข้าใจ Mora / Pitch Accent |
| `/srs` ([srs/page.tsx](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/src/app/srs/page.tsx)) | **FSRS-7 Flashcards & Drills:** ทบทวนการ์ดศัพท์/คันจิ/ไวยากรณ์/ประโยค (จัดลำดับการ์ดใหม่ตาม `learnerLevel`), ฝึกผันกริยา-คำคุณศัพท์, Particle Cloze และ Import/Export (CSV / Anki TSV / `.apkg`) |
| `/minna` ([minna/page.tsx](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/src/app/minna/page.tsx)) | **Minna no Nihongo ครบ 50 บท (เล่ม 1–2):** สรุปไวยากรณ์ ข้อควรระวังคนไทย บทสนทนา ควิซ โน้ตส่วนตัว, ปุ่มเก็บ **คำศัพท์** และ **ไวยากรณ์ (`cardType: "grammar"`)** ลง FSRS, และเปิดเริ่มต้นบทที่ 26 อัตโนมัติสำหรับผู้เรียน N4 ขึ้นไป |
| `/jlpt` ([jlpt/page.tsx](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/src/app/jlpt/page.tsx)) | **JLPT Exam Simulator (N5–N1, 17 ชุด + 5 Full-Length):** จับเวลาจริง/แยกพาร์ต, Auto-Save Draft, เปิด-ปิด Furigana, คลิกคำศัพท์เก็บเข้าคลัง FSRS, เก็บข้อที่ตอบผิด/ไวยากรณ์ลง FSRS, และตัวปรับความเร็วเสียงฟัง + Script Fallback เมื่ออุปกรณ์ไม่มีเสียง `ja-JP` |
| `/reader` ([reader/page.tsx](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/src/app/reader/page.tsx)) | **Immersion Reader:** อ่านบทความระดับ N5–N1, นำเข้าไฟล์ซับ `.srt/.vtt`, ตัดคำด้วย Kuromoji, Smart Furigana (`all` / `unknown` / `off`), คลิกเก็บคำศัพท์เข้า FSRS และสร้างบทอ่านเพิ่มด้วย AI |
| `/shadowing` ([shadowing/page.tsx](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/src/app/shadowing/page.tsx)) | **Shadowing Studio:** ฝึกพูดตามประโยคพร้อมคิวประโยคจาก Minna/Kaiwa และ Pitch Accent |
| `/kaiwa` ([kaiwa/page.tsx](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/src/app/kaiwa/page.tsx)) | **AI Kaiwa:** ฝึกบทสนทนาสถานการณ์จำลอง (Offline / AI Text / Gemini Live Voice Call), เลือกฉากเริ่มต้นให้เหมาะกับระดับผู้เรียน และให้ AI แก้ประโยคให้เป็นธรรมชาติ |
| `/dictionary` ([dictionary/page.tsx](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/src/app/dictionary/page.tsx)) | **Dictionary & Kanji Stroke Order:** ค้นศัพท์-คันจิ แสดง Radicals, ภาพอนิเมชันลำดับขีดเขียนคันจิ (SVG 100x100), และกดส่งเข้า FSRS |
| `/auth` ([auth/page.tsx](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/src/app/auth/page.tsx)) | **สมาชิก & Cloud Sync:** สมัคร/ล็อกอินด้วยอีเมล หรือ **Google OAuth**, เชื่อมบัญชี Google, แก้ไขชื่อใน Supabase `profiles`, ซิงค์ 2 ทาง, ออก + ล้างข้อมูลเครื่อง และลบข้อมูล Cloud |
| `/settings` ([settings/page.tsx](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/src/app/settings/page.tsx)) | **ตั้งค่าการเรียน & ปฏิทิน:** ปรับ Retention, การ์ดใหม่/วัน, ระดับ JLPT, เวลาเรียน/วัน, ธีม, เสียงพูด, BYOK AI Key, แจ้งเตือนรายวัน (Web Notification + Export `.ics`), และ Export/Import JSON Backup |
| `/privacy` & `/terms` | นโยบายความเป็นส่วนตัว และข้อกำหนดการใช้งาน (รองรับการยื่น Google OAuth Branding) |

### API Routes (`src/app/api/*`)
- `/api/health`: ตรวจสถานะเซิร์ฟเวอร์และการตั้งค่า Supabase (`supabaseConfigured`, `supabaseIssue`)
- `/api/ai`: AI Kaiwa feedback, AI Story (`reader`), AI Weaknesses Coach และ `jlpt-generate`
- `/api/translate`: แปลญี่ปุ่น -> ไทย (Local dict + AI fallback)
- `/api/tokenize`: ตัดคำภาษาญี่ปุ่นด้วย Kuromoji
- `/api/image`: สร้างภาพช่วยจำคำศัพท์
- `/api/import/apkg`: แกะไฟล์ `.apkg` ของ Anki (`jszip` + `sql.js`) นำเข้าการ์ด FSRS

---

## 3. ไทม์ไลน์สิ่งที่พัฒนาและแก้ไขแล้ว (อ้างอิง Git History)

1. **`ec1f785` — เปิดตัว Kotonoha Studio ครบชุด**
   - รวมระบบ FSRS-7, Minna 50 บท, JLPT N5–N1 (17 ชุด: N5=4, N4=4, N3=3, N2=3, N1=3 รวม Full-Length `70/70/66/66/65` ข้อ), Stroke Order, AI Weakness Coach, Anki/CSV/SRT, และ Supabase Auth/Sync
2. **`39f0e74` & `f4ea608` — แก้ปัญหา Deploy บน Vercel และตรวจความปลอดภัย Environment**
   - เพิ่ม [supabaseConfig.ts](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/src/lib/supabaseConfig.ts) ป้องกันเว็บล่มถ้า `NEXT_PUBLIC_SUPABASE_URL` ไม่ใช่ URL (เช่น เผลอใส่ `sb_publishable_...`), บล็อกการใช้ `sb_secret_...` ในตัวแปรสาธารณะ และตัด subpath อย่าง `/rest/v1/` ท้าย URL ให้อัตโนมัติ
3. **`12d7c5a`, `b8ddf49`, `2a40a43` — เพิ่ม Google OAuth + หน้า Privacy & Terms**
   - เพิ่มปุ่ม **ดำเนินการต่อด้วย Google** และ **เชื่อม Google** ใน `/auth` พร้อม Auto-Merge Cloud หลังกลับจาก OAuth และ `getUserDisplayName`
   - สร้างหน้า `/privacy` และ `/terms` เพื่อใช้กรอกใน Google Cloud Console (Branding -> In production)
4. **`10351dd` — ระบบประเมินแรกเข้าเมื่อล็อกอินครั้งแรก (First-Login Onboarding & Adaptive Study)**
   - เพิ่ม [studyPlan.ts](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/src/lib/studyPlan.ts) และ [OnboardingModal.tsx](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/src/components/OnboardingModal.tsx) ถามระดับภาษา + เวลาเรียน/วัน + เป้าหมายหลัก แล้วปรับใช้จริงใน Dashboard, FSRS Queue (`sortFreshCardsByLevel`), JLPT, Reader, Minna (บท 26+), Kaiwa และ Settings
5. **`79fd1c0` — ระยะที่ 1: ความปลอดภัยบัญชี & `profiles` Sync**
   - เชื่อมต่อตาราง `public.profiles` (`syncProfileToCloud`, `fetchProfileFromCloud`) + แก้ Trigger `handle_new_user()` ใน [schema.sql](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/supabase/schema.sql) ให้รองรับชื่อจาก Google
   - สร้าง [accountIsolation.ts](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/src/lib/accountIsolation.ts) และ `resetLocalStudyData` ใน [db.ts](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/src/lib/db.ts) ป้องกันข้อมูลปนกันเมื่อสลับบัญชีบนเบราว์เซอร์เดียวกัน
   - เพิ่มปุ่ม **ออก + ล้างข้อมูลเครื่อง** และ **ล้างข้อมูล Cloud**
6. **`8804554` — ระยะที่ 2: วัดระดับด่วน, Grammar FSRS และเสถียรภาพเสียงฟัง**
   - เพิ่ม **แบบทดสอบวัดระดับด่วน 6 ข้อ** (`PLACEMENT_QUIZ_QUESTIONS`, `evaluatePlacementQuiz`) ใน Onboarding
   - เพิ่มปุ่มเก็บ **ไวยากรณ์เข้า FSRS** (`bulkMineMinnaGrammar`) ใน Minna และปุ่ม **เก็บข้อที่ตอบผิดลง FSRS** + เก็บรายข้อใน JLPT
   - เพิ่ม `waitForJapaneseVoices` & `getJapaneseSpeechCapabilities` ใน [speech.ts](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/src/lib/speech.ts), ตัวปรับความเร็ว `0.8x / ปกติ / 1.15x` และแถบช่วยเปิดสคริปต์เมื่อเครื่องไม่มีเสียง `ja-JP`
7. **`5e8e6d0` — ระยะที่ 3: การแจ้งเตือนรายวัน, ปฏิทิน `.ics`, PWA Badge และคู่มือโดเมนส่วนตัว**
   - สร้าง [studyReminder.ts](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/src/lib/studyReminder.ts) รองรับ Web Notification วันละ 1 ครั้ง + สร้างไฟล์ปฏิทิน `RRULE:FREQ=DAILY` (`.ics`) ใน `/settings#reminder`
   - เพิ่มตัวนับการ์ดครบกำหนดทบทวน (`dueCount`) ข้างเมนู FSRS และ PWA `navigator.setAppBadge` ใน [AppShell.tsx](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/src/components/AppShell.tsx)
   - อัปเดต Service Worker [sw.js](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/public/sw.js) เป็น `kotonoha-studio-v3` (เพิ่ม `/privacy`, `/terms`) และเพิ่มคู่มือ Custom Domain ใน [DEPLOY.md](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/DEPLOY.md)

---

## 4. โครงสร้างโฟลเดอร์สำคัญ

```text
src/
├── app/            # หน้าเว็บ (App Router) และ /api/* routes
├── components/     # UI หลัก (AppShell, OnboardingModal, MemoryCurve, StudyAnalytics, Coach, Icons)
├── data/           # ชุดข้อมูล Minna 50 บท, JLPT 17 ชุด, Core/Extra Vocab, Kana, Stroke Orders
├── lib/            # Logic หลัก (fsrs, db, cloudSync, supabase, studyPlan, studyReminder, accountIsolation, speech, etc.)
└── types/          # TypeScript interfaces กลาง (learning.ts)
supabase/schema.sql # สคริปต์สร้างตาราง profiles + user_study_data + RLS + Trigger
tests/core.test.mjs # Automated tests (14 test cases)
DEPLOY.md           # คู่มือตั้งค่า Supabase, Vercel, Google OAuth และ Custom Domain
```

---

## 5. คำสั่งตรวจสอบระบบ & ข้อควรระวังเวลาดูแลต่อ

### คำสั่งทดสอบและ Build (ควรผ่านทั้งหมดก่อน Push)
```powershell
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```
*(ปัจจุบันชุดเทส [core.test.mjs](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/tests/core.test.mjs) มี 14 เคสครอบคลุม FSRS, ผันกริยา, Dialogue Parser, Minna 50 บท, JLPT 17 ชุด, CSV/Anki TSV, SRT/VTT, Weakness Analyzer, Stroke Order, Supabase Env Validation, Adaptive Study Plan, Account Isolation, Placement Quiz และ Reminder/ICS)*

### ข้อควรระวังสำคัญด้านตั้งค่า Production
1. **ตัวแปร Vercel & `.env.local`:**
   - `NEXT_PUBLIC_SUPABASE_URL` ต้องเป็น `https://<project-ref>.supabase.co` (ไม่มี `/rest/v1/`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` ต้องใช้ Publishable Key (`sb_publishable_...`) หรือ legacy `anon` public key เท่านั้น **ห้ามใส่ `sb_secret_...`** และใน Vercel ให้ตั้งประเภทตัวแปร `NEXT_PUBLIC_*` เป็น **Config** (ไม่ใช่ Sensitive)
2. **Supabase & Google OAuth:**
   - รัน [schema.sql](file:///c:/Users/wator/Documents/AI_PRO/ja_learn/supabase/schema.sql) ใน Supabase SQL Editor ให้เรียบร้อย
   - ใน Supabase -> **Authentication -> URL Configuration** ให้ใส่ Site URL และ Redirect URLs ของโดเมนจริง (`https://kotonohajath.vercel.app/**`)
   - ใน Google Cloud Console -> **Google Auth Platform -> Branding**: ใส่ Home Page (`https://kotonohajath.vercel.app`), Privacy (`/privacy`), Terms (`/terms`) และเพิ่ม `kotonohajath.vercel.app` + `supabase.co` ใน **Authorized domains**
