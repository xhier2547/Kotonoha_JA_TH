import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว (Privacy Policy) | Kotonoha Studio",
  description:
    "นโยบายความเป็นส่วนตัวของ Kotonoha Studio (言の葉スタジオ) เกี่ยวกับการใช้ข้อมูลบัญชี Google และ Cloud Sync",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-primary uppercase tracking-wider">
            Privacy Policy
          </div>
          <h1 className="text-2xl font-bold mt-0.5">
            นโยบายความเป็นส่วนตัว — Kotonoha Studio (言の葉スタジオ)
          </h1>
          <p className="text-xs text-foreground/65 mt-1">
            อัปเดตล่าสุด: 16 พฤศจิกายน 2026
          </p>
        </div>

        <Link
          href="/auth"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-surface hover:bg-surface-muted text-xs font-medium shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>กลับหน้าสมาชิก</span>
        </Link>
      </div>

      <article className="rounded-2xl border border-border bg-surface p-6 space-y-5 text-sm leading-relaxed text-foreground/85 shadow-xs">
        <div className="flex items-start gap-3 rounded-xl border border-matcha/30 bg-matcha/5 p-4 text-xs">
          <ShieldCheck className="w-4 h-4 text-matcha shrink-0 mt-0.5" />
          <p>
            <strong>สรุปสั้นๆ:</strong> Kotonoha Studio เก็บข้อมูลการเรียนไว้ในเครื่องของคุณเป็นหลัก
            (Offline-First) และจะซิงค์ขึ้น Cloud เฉพาะเมื่อคุณสมัครสมาชิกหรือเข้าสู่ระบบด้วยอีเมล / Google
            เพื่อสำรองความคืบหน้าการเรียนข้ามอุปกรณ์เท่านั้น โดยไม่นำข้อมูลไปขายหรือแบ่งปันให้บุคคลที่สาม
          </p>
        </div>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-foreground">
            1. ข้อมูลที่เราขอรับเมื่อเข้าสู่ระบบด้วย Google (Data Accessed)
          </h2>
          <p>
            เมื่อคุณเลือก <strong>“ดำเนินการต่อด้วย Google”</strong> (Google OAuth ผ่าน Supabase Auth)
            แอปจะขอเข้าถึงเฉพาะข้อมูลโปรไฟล์พื้นฐาน ได้แก่:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-foreground/80">
            <li>ที่อยู่อีเมล (Email address) เพื่อใช้ระบุตัวตนบัญชีสมาชิก</li>
            <li>ชื่อที่แสดงและรูปโปรไฟล์ (Display name / Avatar URL) เพื่อแสดงผลภายในหน้าบัญชี</li>
          </ul>
          <p className="text-xs text-foreground/70">
            We only request basic profile scopes (email, profile, openid) solely for
            authentication and identifying your learning sync account.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-foreground">
            2. วัตถุประสงค์การใช้ข้อมูล (How We Use Your Data)
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-foreground/80">
            <li>ยืนยันตัวตนในการเข้าสู่ระบบและเชื่อมต่อบัญชีสมาชิกข้ามอุปกรณ์</li>
            <li>
              สำรองและซิงค์ความคืบหน้าการเรียนภาษาญี่ปุ่น ได้แก่ การ์ดคำศัพท์ FSRS-7,
              ประวัติการทบทวน, บทเรียน Minna no Nihongo, คะแนนสอบจำลอง JLPT และสถิติ Streak
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-foreground">
            3. การจัดเก็บและความปลอดภัย (Storage &amp; Security)
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-foreground/80">
            <li>
              ข้อมูลการซิงค์บน Cloud จัดเก็บบนฐานข้อมูล Supabase พร้อมมาตรการ{" "}
              <strong>Row Level Security (RLS)</strong> ทำให้เข้าถึงได้เฉพาะเจ้าของบัญชีเท่านั้น
            </li>
            <li>
              รหัส AI API Key ของคุณ (เช่น Gemini / OpenAI API Key ที่กรอกในหน้าตั้งค่า)
              จะถูกเก็บไว้เฉพาะในอุปกรณ์ของคุณ (Local IndexedDB) และจะ{" "}
              <strong>ไม่ถูกส่งขึ้น Cloud Sync โดยเด็ดขาด</strong>
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-foreground">
            4. การยกเลิกการเชื่อมต่อและลบข้อมูล (Data Retention &amp; Deletion)
          </h2>
          <p>
            คุณสามารถใช้งานแอปในโหมด Guest โดยไม่ต้องสร้างบัญชี, ส่งออกหรือล้างข้อมูลในเครื่องได้ตลอดเวลาที่หน้า{" "}
            <Link href="/settings" className="text-primary underline underline-offset-2">
              ตั้งค่า (/settings)
            </Link>{" "}
            และสามารถถอนสิทธิ์การเข้าถึงของแอปได้ทุกเมื่อผ่านหน้า{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              Google Account Permissions
            </a>
            {" "}หรือแจ้งขอลบบัญชีและข้อมูลทั้งหมดได้ผ่าน GitHub Repository ของโปรเจกต์
          </p>
        </section>
      </article>
    </div>
  );
}
