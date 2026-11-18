"use client";

import { useEffect, useRef, useState } from "react";
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
  Save,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Wrench,
} from "lucide-react";
import {
  getSupabaseClient,
  getSupabaseConfigIssue,
  getUserDisplayName,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { getAppSettings, resetLocalStudyData } from "@/lib/db";
import { writeActiveAccountOwner } from "@/lib/accountIsolation";
import {
  deleteCloudStudyData,
  fetchProfileFromCloud,
  pullProgressFromCloud,
  pushProgressToCloud,
  syncProfileToCloud,
  type CloudProfileRecord,
} from "@/lib/cloudSync";
import { CrestSealIcon } from "@/components/LuxuryIcons";
import { StudyPageHero } from "@/components/StudyPageHero";

type AuthMode = "signin" | "signup";

function GoogleGIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-8.97z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.37 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
      />
    </svg>
  );
}

export default function AuthPage() {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const configIssue = getSupabaseConfigIssue();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(configured);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [cloudProfile, setCloudProfile] = useState<CloudProfileRecord | null>(null);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [confirmDeleteCloud, setConfirmDeleteCloud] = useState(false);
  const [deletingCloud, setDeletingCloud] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const manualAuthRef = useRef(false);
  const oauthSyncedRef = useRef(false);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    let active = true;
    void client.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      const u = data.user ?? null;
      setUser(u);
      if (u) {
        setProfileNameDraft(getUserDisplayName(u));
        const profile = await fetchProfileFromCloud();
        if (active && profile) {
          setCloudProfile(profile);
          if (profile.display_name) setProfileNameDraft(profile.display_name);
        }
      }
      if (active) setLoadingUser(false);

      if (typeof window !== "undefined") {
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const oauthError =
          searchParams.get("error_description") ||
          hashParams.get("error_description") ||
          searchParams.get("error") ||
          hashParams.get("error");
        if (oauthError) {
          setErrorMsg(`ไม่สามารถเข้าสู่ระบบด้วย Google ได้: ${oauthError}`);
        }
      }
    });

    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        setProfileNameDraft(getUserDisplayName(nextUser));
      } else {
        setCloudProfile(null);
      }

      // Auto-merge once when returning from Google OAuth redirect.
      if (
        event === "SIGNED_IN" &&
        nextUser &&
        !manualAuthRef.current &&
        !oauthSyncedRef.current
      ) {
        oauthSyncedRef.current = true;
        void pullProgressFromCloud("merge")
          .then(async (pulled) => {
            if (!active) return;
            const [latest, profile] = await Promise.all([
              getAppSettings(),
              fetchProfileFromCloud(),
            ]);
            if (!active) return;
            if (profile) setCloudProfile(profile);
            if (!latest.onboardingCompleted) {
              router.push("/?onboarding=1");
              return;
            }
            if (pulled.switchedAccountReset) {
              setMessage(
                "ตรวจพบการเปลี่ยนบัญชี — ระบบล้างข้อมูลบัญชีเดิมในเครื่องและโหลดข้อมูลจาก Cloud ของคุณเรียบร้อยแล้ว!"
              );
            } else {
              setMessage(
                pulled.hasCloudData
                  ? "เข้าสู่ระบบและรวมข้อมูลจาก Cloud + เครื่องนี้เรียบร้อยแล้ว!"
                  : "เข้าสู่ระบบและอัปโหลดความคืบหน้าของคุณขึ้น Cloud เรียบร้อยแล้ว!"
              );
            }
          })
          .catch(() => {
            // Keep session active; user can retry sync manually if needed
          });
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  const handleGoogleAuth = async (intent: "signin" | "link") => {
    setErrorMsg(null);
    setMessage(null);
    const client = getSupabaseClient();
    if (!client) {
      setErrorMsg("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_SUPABASE_URL และ ANON_KEY");
      return;
    }

    setOauthLoading(true);
    try {
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/auth` : undefined;

      if (intent === "link") {
        const { error } = await client.auth.linkIdentity({
          provider: "google",
          options: { redirectTo },
        });
        if (error) throw error;
      } else {
        const { error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
            queryParams: {
              access_type: "offline",
              prompt: "select_account",
            },
          },
        });
        if (error) throw error;
      }
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : "";
      if (rawMsg.toLowerCase().includes("provider is not enabled")) {
        setErrorMsg(
          "ยังไม่ได้เปิดใช้งาน Google Provider ใน Supabase Dashboard (Authentication -> Sign In / Providers -> Google)"
        );
      } else if (rawMsg.toLowerCase().includes("manual linking")) {
        setErrorMsg(
          "หากต้องการเชื่อม Google เข้ากับบัญชีอีเมลเดิม กรุณาเปิด Manual Linking ใน Supabase Auth Settings หรือเข้าสู่ระบบด้วยปุ่ม Google โดยตรงครับ"
        );
      } else {
        setErrorMsg(rawMsg || "ไม่สามารถเชื่อมต่อบัญชี Google ได้");
      }
      setOauthLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setMessage(null);
    const client = getSupabaseClient();
    if (!client) {
      setErrorMsg("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_SUPABASE_URL และ ANON_KEY");
      return;
    }

    manualAuthRef.current = true;
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
          await pullProgressFromCloud("merge");
          const [latest, profile] = await Promise.all([
            getAppSettings(),
            fetchProfileFromCloud(),
          ]);
          if (profile) setCloudProfile(profile);
          if (!latest.onboardingCompleted) {
            router.push("/?onboarding=1");
            return;
          }
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
        const [latest, profile] = await Promise.all([
          getAppSettings(),
          fetchProfileFromCloud(),
        ]);
        if (profile) setCloudProfile(profile);
        if (!latest.onboardingCompleted) {
          router.push("/?onboarding=1");
          return;
        }
        if (pulled.switchedAccountReset) {
          setMessage(
            "ตรวจพบการเปลี่ยนบัญชี — ระบบล้างข้อมูลบัญชีเดิมในเครื่องและโหลดข้อมูลจาก Cloud ของบัญชีนี้เรียบร้อยแล้ว!"
          );
        } else {
          setMessage(
            pulled.hasCloudData
              ? "เข้าสู่ระบบและรวมข้อมูลจาก Cloud + เครื่องนี้เรียบร้อยแล้ว!"
              : "เข้าสู่ระบบและอัปโหลดความคืบหน้าของคุณขึ้น Cloud เรียบร้อยแล้ว!"
          );
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการยืนยันตัวตน");
    } finally {
      manualAuthRef.current = false;
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

  const handleSaveProfileName = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = getSupabaseClient();
    const trimmed = profileNameDraft.trim();
    if (!client || !user || !trimmed) return;

    setErrorMsg(null);
    setMessage(null);
    setSavingProfile(true);
    try {
      const { data, error } = await client.auth.updateUser({
        data: { display_name: trimmed },
      });
      if (error) throw error;
      if (data.user) setUser(data.user);

      const synced = await syncProfileToCloud({ displayName: trimmed });
      if (synced) setCloudProfile(synced);
      setMessage("อัปเดตชื่อโปรไฟล์และซิงค์ขึ้น Supabase แล้ว!");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "อัปเดตชื่อโปรไฟล์ไม่สำเร็จ");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSignOut = async (wipeLocal: boolean) => {
    const client = getSupabaseClient();
    if (!client) return;
    setErrorMsg(null);
    setMessage(null);
    await client.auth.signOut();
    if (wipeLocal) {
      await resetLocalStudyData({ preserveApiKey: true });
      writeActiveAccountOwner(null);
      setMessage("ออกจากระบบและล้างข้อมูลการเรียนในเครื่องนี้เรียบร้อยแล้ว (เหมาะสำหรับเครื่องสาธารณะ/สลับบัญชี)");
    } else {
      setMessage("ออกจากระบบแล้ว — คุณยังใช้งานโหมด Guest ในเครื่องนี้ต่อได้ทันที");
    }
  };

  const handleDeleteCloudData = async () => {
    setErrorMsg(null);
    setMessage(null);
    setDeletingCloud(true);
    try {
      await deleteCloudStudyData();
      setConfirmDeleteCloud(false);
      setMessage("ลบข้อมูลการเรียนบน Cloud (user_study_data) ของบัญชีนี้เรียบร้อยแล้ว");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "ลบข้อมูลบน Cloud ไม่สำเร็จ");
    } finally {
      setDeletingCloud(false);
    }
  };

  const hasGoogleLinked = Boolean(
    user?.identities?.some((id) => id.provider === "google") ||
      user?.app_metadata?.provider === "google"
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <StudyPageHero
        tone="indigo"
        kanjiWatermark="絆"
        eyebrow="Member Account & Cloud Sync"
        title="บัญชีสมาชิก & ซิงค์ความคืบหน้าข้ามเครื่อง"
        subtitle="ซิงค์การ์ด FSRS-7, Minna no Nihongo, ผลสอบ JLPT และ Streak ข้ามอุปกรณ์ผ่าน Supabase"
        actions={
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/25 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold shrink-0 backdrop-blur-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>หน้าหลัก</span>
          </Link>
        }
      />

      {!configured && (
        <section className="rounded-2xl border border-amber-500/35 bg-amber-500/5 p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-300">
            <Wrench className="w-4 h-4" />
            <span>
              {configIssue === "invalid_url"
                ? "ค่า NEXT_PUBLIC_SUPABASE_URL ไม่ใช่ URL ที่ถูกต้อง"
                : configIssue === "secret_key_used_as_public"
                ? "ตรวจพบ Secret Key (sb_secret_...) ใน NEXT_PUBLIC_SUPABASE_ANON_KEY"
                : "ยังไม่ได้ตั้งค่า Environment Variables ของ Supabase"}
            </span>
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed">
            {configIssue === "invalid_url" ? (
              <>
                ค่า <code className="font-mono px-1 py-0.5 rounded bg-surface">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
                ต้องเป็น Project URL เช่น{" "}
                <code className="font-mono px-1 py-0.5 rounded bg-surface">https://xxxx.supabase.co</code>{" "}
                ไม่ใช่คีย์ <code className="font-mono px-1 py-0.5 rounded bg-surface">sb_publishable_...</code>
              </>
            ) : configIssue === "secret_key_used_as_public" ? (
              <>
                ห้ามนำ <code className="font-mono px-1 py-0.5 rounded bg-surface">sb_secret_...</code>{" "}
                มาใส่ใน <code className="font-mono px-1 py-0.5 rounded bg-surface">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
                กรุณาเปลี่ยนไปใช้คีย์ <code className="font-mono px-1 py-0.5 rounded bg-surface">sb_publishable_...</code>{" "}
                หรือ Anon Public Key และรีบ Rotate/Revoke คีย์ลับตัวเก่าใน Supabase ทันที
              </>
            ) : (
              <>
                โค้ดระบบสมาชิกและสคริปต์ SQL พร้อมใช้งานแล้วครับ แต่บนสภาพแวดล้อมนี้ยังไม่มีค่า{" "}
                <code className="font-mono px-1 py-0.5 rounded bg-surface">NEXT_PUBLIC_SUPABASE_URL</code> และ{" "}
                <code className="font-mono px-1 py-0.5 rounded bg-surface">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
              </>
            )}
          </p>
          <ol className="text-xs text-foreground/75 list-decimal pl-5 space-y-1">
            <li>ดู Project URL ใน Supabase Dashboard -&gt; Project Settings -&gt; Data API</li>
            <li>นำ Project URL ใส่ใน <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> และ Publishable Key ใส่ใน <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code></li>
            <li>อัปเดตทั้งใน Vercel Environment Variables (แล้ว Redeploy) และใน <code className="font-mono">.env.local</code></li>
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
                  {cloudProfile?.display_name || getUserDisplayName(user)}
                </div>
                <div className="text-xs text-foreground/65">{user.email}</div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1 text-[11px] text-matcha font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>เชื่อมต่อ Cloud Sync อัตโนมัติแล้ว</span>
                  </span>
                  {cloudProfile?.learner_level && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-primary/25 bg-primary/10 text-primary text-[11px] font-semibold">
                      ระดับ {cloudProfile.learner_level}
                    </span>
                  )}
                  {hasGoogleLinked && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border bg-background text-[11px] font-medium">
                      <GoogleGIcon className="w-3 h-3" />
                      <span>Google</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!hasGoogleLinked && (
                <button
                  type="button"
                  disabled={oauthLoading}
                  onClick={() => void handleGoogleAuth("link")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-surface-muted text-xs font-medium disabled:opacity-50 cursor-pointer"
                >
                  <GoogleGIcon className="w-3.5 h-3.5" />
                  <span>{oauthLoading ? "กำลังเชื่อมต่อ..." : "เชื่อม Google"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => void handleSignOut(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:bg-surface-muted text-xs font-medium text-foreground/80 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>ออกจากระบบ</span>
              </button>

              <button
                type="button"
                onClick={() => void handleSignOut(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/35 text-rose-600 dark:text-rose-300 hover:bg-rose-500/10 text-xs font-medium cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ออก + ล้างข้อมูลเครื่อง</span>
              </button>
            </div>
          </div>

          <form
            onSubmit={(e) => void handleSaveProfileName(e)}
            className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5 pt-3 border-t border-border/80"
          >
            <label className="flex-1 space-y-1 text-xs">
              <span className="font-medium text-foreground/75">
                ชื่อโปรไฟล์สมาชิก (บันทึกลง Supabase `profiles`)
              </span>
              <input
                type="text"
                value={profileNameDraft}
                onChange={(e) => setProfileNameDraft(e.target.value)}
                required
                placeholder="ชื่อที่แสดงในระบบ"
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={savingProfile || !profileNameDraft.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-background hover:bg-surface-muted text-xs font-semibold disabled:opacity-50 cursor-pointer shrink-0"
            >
              <Save className="w-3.5 h-3.5 text-primary" />
              <span>{savingProfile ? "กำลังบันทึก..." : "บันทึกชื่อโปรไฟล์"}</span>
            </button>
          </form>

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

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/80">
            <p className="text-[11px] text-foreground/60 leading-relaxed max-w-md">
              หมายเหตุความปลอดภัย: ระบบ Cloud Sync จะไม่ส่งรหัส AI API Key ของ AI (Gemini/OpenAI) ออกจากเครื่อง และจะแยกข้อมูลอัตโนมัติหากมีการสลับบัญชีคนละคนในเบราว์เซอร์เดียวกัน
            </p>

            {!confirmDeleteCloud ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteCloud(true)}
                className="text-[11px] text-rose-600 dark:text-rose-300 hover:underline underline-offset-2 cursor-pointer shrink-0"
              >
                ล้างข้อมูลการเรียนบน Cloud
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={deletingCloud}
                  onClick={() => void handleDeleteCloudData()}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-medium disabled:opacity-50 cursor-pointer"
                >
                  {deletingCloud ? "กำลังลบ..." : "ยืนยันลบข้อมูล Cloud"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteCloud(false)}
                  className="px-2.5 py-1 rounded-lg border border-border text-[11px] cursor-pointer"
                >
                  ยกเลิก
                </button>
              </div>
            )}
          </div>
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

          <div className="space-y-3">
            <button
              type="button"
              disabled={oauthLoading || submitting || !configured}
              onClick={() => void handleGoogleAuth("signin")}
              className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-surface-muted text-sm font-medium disabled:opacity-50 cursor-pointer transition-colors"
            >
              <GoogleGIcon className="w-4 h-4 shrink-0" />
              <span>
                {oauthLoading ? "กำลังเปิดหน้า Google..." : "ดำเนินการต่อด้วย Google"}
              </span>
            </button>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-border/80" />
              <span className="mx-3 shrink-0 text-[11px] text-foreground/50">
                หรือใช้อีเมลและรหัสผ่าน
              </span>
              <div className="flex-grow border-t border-border/80" />
            </div>
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

      <div className="text-center text-xs text-foreground/60">
        การเข้าสู่ระบบหรือใช้งาน Cloud Sync ถือว่าคุณยอมรับ{" "}
        <Link href="/terms" className="text-primary underline underline-offset-2 hover:text-primary/80">
          ข้อกำหนดการใช้งาน (Terms)
        </Link>{" "}
        และ{" "}
        <Link href="/privacy" className="text-primary underline underline-offset-2 hover:text-primary/80">
          นโยบายความเป็นส่วนตัว (Privacy)
        </Link>
      </div>
    </div>
  );
}
