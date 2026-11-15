import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "ข้อกำหนดการใช้งาน (Terms of Service) | Kotonoha Studio",
  description:
    "ข้อกำหนดและเงื่อนไขการใช้งาน Kotonoha Studio (言の葉スタジオ) ระบบเรียนภาษาญี่ปุ่นและ Cloud Sync",
};

export default function TermsOfServicePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-primary uppercase tracking-wider">
            Terms of Service
          </div>
          <h1 className="text-2xl font-bold mt-0.5">
            ข้อกำหนดการใช้งาน — Kotonoha Studio (言の葉スタジオ)
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
        <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4 text-xs">
          <FileText className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p>
            <strong>ขอบเขตบริการ:</strong> Kotonoha Studio เป็นเว็บแอปพลิเคชันเพื่อการศึกษาและการฝึกฝนภาษาญี่ปุ่น
            (Kana, คันจิ, คำศัพท์ FSRS-7, Minna no Nihongo, ข้อสอบจำลอง JLPT, Immersion Reader และ AI Kaiwa)
            เปิดให้ใช้งานฟรีทั้งแบบ Guest ในเครื่อง และแบบสมาชิกพร้อม Cloud Sync
          </p>
        </div>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-foreground">
            1. การยอมรับข้อกำหนด (Acceptance of Terms)
          </h2>
          <p>
            การเข้าใช้งานเว็บไซต์ การสมัครสมาชิก หรือการเข้าสู่ระบบด้วยอีเมล / Google
            ถือว่าคุณยอมรับข้อกำหนดการใช้งานฉบับนี้และ{" "}
            <Link href="/privacy" className="text-primary underline underline-offset-2">
              นโยบายความเป็นส่วนตัว (/privacy)
            </Link>
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-foreground">
            2. บัญชีผู้ใช้และการซิงค์ข้อมูล (Accounts &amp; Cloud Sync)
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-foreground/80">
            <li>คุณสามารถใช้งานฟีเจอร์หลักแบบ Guest ได้โดยไม่ต้องสมัครสมาชิก</li>
            <li>
              หากเข้าสู่ระบบด้วยอีเมลหรือบัญชี Google คุณมีหน้าที่ดูแลความปลอดภัยของบัญชีตนเอง
              และสามารถส่งออก/สำรองข้อมูล JSON ได้เสมอจากหน้า{" "}
              <Link href="/settings" className="text-primary underline underline-offset-2">
                ตั้งค่า (/settings)
              </Link>
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-foreground">
            3. ฟีเจอร์ AI แบบ BYOK และเนื้อหาข้อสอบจำลอง
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-foreground/80">
            <li>
              ผู้ใช้งานที่กรอก Gemini / OpenAI API Key ของตนเอง (Bring Your Own Key)
              เป็นผู้รับผิดชอบค่าใช้จ่ายและโควตาการใช้งานตามเงื่อนไขของผู้ให้บริการ API นั้นๆ
            </li>
            <li>
              ชุดข้อสอบ JLPT และแบบฝึกหัดภายในระบบสร้างขึ้นเพื่อฝึกฝนและจำลองโครงสร้างการสอบเท่านั้น
              ไม่ถือเป็นข้อสอบอย่างเป็นทางการจากองค์กรจัดสอบ JLPT
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-foreground">
            4. การใช้งานที่เหมาะสมและข้อจำกัดความรับผิดชอบ (Acceptable Use &amp; Disclaimer)
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-foreground/80">
            <li>ห้ามนำระบบ API หรือฟีเจอร์ซิงค์ข้อมูลไปใช้โจมตี สแปม หรือละเมิดกฎหมาย</li>
            <li>
              บริการนี้ให้บริการตามสภาพปัจจุบัน (&ldquo;As Is&rdquo;) เพื่อการศึกษา
              ทีมพัฒนาสงวนสิทธิ์ในการปรับปรุง เปลี่ยนแปลง หรือหยุดให้บริการบางส่วนได้ตามความเหมาะสม
            </li>
          </ul>
        </section>
      </article>
    </div>
  );
}
