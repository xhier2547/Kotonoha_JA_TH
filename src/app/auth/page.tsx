"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  ArrowLeft,
  CheckCircle2,
  Cloud,
  CloudUpload,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Wrench,
} from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { pullProgressFromCloud, pushProgressToCloud } from "@/lib/cloudSync";
import { CrestSealIcon } from "@/components/LuxuryIcons";

type AuthMode = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(configured);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    let active = true;
    void client.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      setLoadingUser(false);
    });

    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setMessage(null);
    const client = getSupabaseClient();
    if (!client) {
      setErrorMsg("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_SUPABASE_URL และ ANON_KEY");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              display_name: displayName.trim() || email.split("@")[0] || "Learner",
            },
          },
        });
        if (error) throw error;

        if (data.session) {
          await pushProgressToCloud();
          setMessage("สมัครสมาชิกและซิงค์ข้อมูลการเรียนเริ่มต้นขึ้น Cloud เรียบร้อยแล้ว!");
        } else {
          setMessage(
            "ส่งลิงก์ยืนยันไปที่อีเมลของคุณแล้ว (หรือปิด Confirm Email ใน Supabase เพื่อเข้าสู่ระบบทันที)"
          );
        }
      } else {
        const { error } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;

        const pulled = await pullProgressFromCloud("merge");
        setMessage(
          pulled.hasCloudData
            ? "เข้าสู่ระบบและรวมข้อมูลจาก Cloud + เครื่องนี้เรียบร้อยแล้ว!"
            : "เข้าสู่ระบบและอัปโหลดความคืบหน้าของคุณขึ้น Cloud เรียบร้อยแล้ว!"
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการยืนยันตัวตน");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSyncAction = async (action: "push" | "merge" | "replace") => {
    setErrorMsg(null);
    setMessage(null);
    setSyncing(true);
    try {
      if (action === "push") {
        const res = await pushProgressToCloud();
        setMessage(`อัปโหลดข้อมูลขึ้น Cloud สำเร็จ (${new Date(res.updatedAt).toLocaleTimeString("th-TH")})`);
      } else {
        const res = await pullProgressFromCloud(action);
        if (!res.hasCloudData) {
          setMessage("ยังไม่มีข้อมูลเก่าบน Cloud ระบบจึงอัปโหลดข้อมูลจากเครื่องนี้ขึ้นให้แล้วครับ");
        } else {
          setMessage(
            `${action === "merge" ? "รวมข้อมูล" : "ดึงข้อมูลจาก Cloud"} สำเร็จ! (การ์ด ${res.restored?.cards ?? 0} ใบ, Minna ${res.restored?.minnaLessons ?? 0} บท)`
          );
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "ซิงค์ข้อมูลไม่สำเร็จ");
    } finally {
      setSyncing(false);
    }
  };

  const handleSignOut = async () => {
    const client = getSupabaseClient();
    if (!client) return;
    await client.auth.signOut();
    setMessage("ออกจากระบบแล้ว — คุณยังใช้งานโหมด Guest ในเครื่องนี้ต่อได้ทันที");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-primary uppercase tracking-wider">
            Member Account & Cloud Sync
          </div>
          <h1 className="text-2xl font-bold mt-0.5">
            บัญชีสมาชิก & ซิงค์ความคืบหน้าข้ามเครื่อง
          </h1>
          <p className="text-sm text-foreground/70 mt-1">
            ซิงค์การ์ด FSRS-7, Minna no Nihongo, ผลสอบ JLPT และ Streak ข้ามอุปกรณ์ผ่าน Supabase
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-surface hover:bg-surface-muted text-xs font-medium shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>หน้าหลัก</span>
        </Link>
      </div>

      {!configured && (
        <section className="rounded-2xl border border-amber-500/35 bg-amber-500/5 p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-300">
            <Wrench className="w-4 h-4" />
            <span>ยังไม่ได้ตั้งค่า Environment Variables ของ Supabase</span>
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed">
            โค้ดระบบสมาชิกและสคริปต์ SQL พร้อมใช้งานแล้วครับ แต่บนสภาพแวดล้อมนี้ยังไม่มีค่า{" "}
            <code className="font-mono px-1 py-0.5 rounded bg-surface">NEXT_PUBLIC_SUPABASE_URL</code> และ{" "}
            <code className="font-mono px-1 py-0.5 rounded bg-surface">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
          </p>
          <ol className="text-xs text-foreground/75 list-decimal pl-5 space-y-1">
            <li>สร้างโปรเจกต์ฟรีที่ Supabase แล้วรันสคริปต์ใน <code className="font-mono">supabase/schema.sql</code></li>
            <li>นำ URL และ Anon Key ใส่ใน <code className="font-mono">.env.local</code> หรือ Vercel Environment Variables</li>
            <li>ดูขั้นตอนละเอียดเพิ่มเติมได้ในไฟล์ <code className="font-mono">DEPLOY.md</code></li>
          </ol>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium cursor-pointer"
          >
            <span>ใช้งานแบบ Guest ในเครื่องนี้ต่อไปก่อน</span>
          </button>
        </section>
      )}

      {message && (
        <div className="rounded-xl border border-matcha/40 bg-matcha/10 p-3.5 text-xs text-matcha font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-300 font-medium">
          {errorMsg}
        </div>
      )}

      {loadingUser ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-foreground/60">
          กำลังตรวจสอบสถานะบัญชี...
        </div>
      ) : user ? (
        <section className="rounded-2xl border border-border bg-surface p-6 space-y-5 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <UserCheck className="w-6 h-6" strokeWidth={1.6} />
              </div>
              <div>
                <div className="text-sm font-bold">
                  {(user.user_metadata?.display_name as string) || user.email}
                </div>
                <div className="text-xs text-foreground/65">{user.email}</div>
                <div className="inline-flex items-center gap-1 text-[11px] text-matcha font-medium mt-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>เชื่อมต่อ Cloud Sync อัตโนมัติแล้ว</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:bg-surface-muted text-xs font-medium text-foreground/80 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>ออกจากระบบ</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-border/80">
            <button
              type="button"
              disabled={syncing}
              onClick={() => void handleSyncAction("merge")}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              <span>รวมข้อมูล & ซิงค์ 2 ทาง</span>
            </button>

            <button
              type="button"
              disabled={syncing}
              onClick={() => void handleSyncAction("push")}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-border bg-background hover:bg-surface-muted text-xs font-medium disabled:opacity-50 cursor-pointer"
            >
              <CloudUpload className="w-3.5 h-3.5 text-primary" />
              <span>อัปโหลดทับ Cloud</span>
            </button>

            <button
              type="button"
              disabled={syncing}
              onClick={() => void handleSyncAction("replace")}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-border bg-background hover:bg-surface-muted text-xs font-medium disabled:opacity-50 cursor-pointer"
            >
              <Cloud className="w-3.5 h-3.5 text-primary" />
              <span>ดึงจาก Cloud ทับเครื่องนี้</span>
            </button>
          </div>

          <p className="text-[11px] text-foreground/60 leading-relaxed">
            หมายเหตุความปลอดภัย: ระบบ Cloud Sync จะไม่ส่งรหัส API Key ของ AI (Gemini/OpenAI) ออกจากเครื่องของคุณ เพื่อความปลอดภัยส่วนตัวเมื่อทดลองบนเครื่องสาธารณะ
          </p>
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-surface p-6 space-y-5 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex rounded-xl border border-border bg-background p-1">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  mode === "signin"
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/70 hover:text-foreground"
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>เข้าสู่ระบบ</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  mode === "signup"
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/70 hover:text-foreground"
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>สมัครสมาชิกใหม่</span>
              </button>
            </div>

            <span className="inline-flex items-center gap-1 text-[11px] text-foreground/60">
              <CrestSealIcon className="w-3.5 h-3.5 text-primary" />
              <span>Offline-First + Sync</span>
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <label className="block space-y-1.5 text-xs">
                <span className="font-medium">ชื่อที่แสดง (Display Name)</span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="เช่น Tanaka / Wator..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm"
                />
              </label>
            )}

            <label className="block space-y-1.5 text-xs">
              <span className="font-medium">อีเมล (Email)</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm"
              />
            </label>

            <label className="block space-y-1.5 text-xs">
              <span className="font-medium">รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)</span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm"
              />
            </label>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={submitting || !configured}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 cursor-pointer"
              >
                {mode === "signin" ? (
                  <LogIn className="w-4 h-4" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                <span>
                  {submitting
                    ? "กำลังดำเนินการ..."
                    : mode === "signin"
                      ? "เข้าสู่ระบบ & ซิงค์ข้อมูล"
                      : "สมัครสมาชิก & เริ่มซิงค์"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/")}
                className="px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-surface-muted text-xs font-medium cursor-pointer"
              >
                ทดลองเล่นแบบ Guest (ไม่ต้องสมัคร)
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
