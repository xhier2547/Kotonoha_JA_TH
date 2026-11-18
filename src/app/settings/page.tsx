"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CalendarPlus, Check, Download, Save, Sparkles, Upload } from "lucide-react";
import {
  DEFAULT_SETTINGS,
  exportDatabaseJson,
  getAppSettings,
  getLearningSummary,
  importDatabaseJson,
  saveAppSettings,
} from "@/lib/db";
import { getJapaneseVoices, speakJapanese } from "@/lib/speech";
import { broadcastThemePreference } from "@/lib/theme";
import { DAILY_TIME_OPTIONS, STUDY_FOCUS_OPTIONS } from "@/lib/studyPlan";
import {
  buildStudyReminderIcs,
  parseReminderHHMM,
  showBrowserStudyNotification,
} from "@/lib/studyReminder";
import { StudyPageHero } from "@/components/StudyPageHero";
import type {
  AiProvider,
  AppSettings,
  JlptLevel,
  StudyGoalFocus,
  ThemePreference,
} from "@/types/learning";

export default function SettingsPage() {
  const [form, setForm] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [savedNotice, setSavedNotice] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [reminderNotice, setReminderNotice] = useState<string | null>(null);

  useEffect(() => {
    getAppSettings().then(setForm);

    const loadVoices = () => {
      setVoices(getJapaneseVoices());
    };
    loadVoices();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveAppSettings(form);
    broadcastThemePreference(form.theme ?? "system");
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleToggleBrowserReminder = async (enabled: boolean) => {
    setReminderNotice(null);
    if (!enabled) {
      setForm((prev) => ({ ...prev, reminderEnabled: false }));
      return;
    }
    if (typeof window === "undefined" || !("Notification" in window)) {
      setReminderNotice(
        "เบราว์เซอร์นี้ไม่รองรับ Web Notification — แนะนำกดดาวน์โหลดปฏิทิน (.ics) ด้านล่างแทนครับ"
      );
      return;
    }
    const perm =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
    if (perm === "granted") {
      setForm((prev) => ({ ...prev, reminderEnabled: true }));
      setReminderNotice("อนุญาตแจ้งเตือนแล้ว! อย่าลืมกด 'บันทึกการตั้งค่า' ด้านล่างด้วยนะครับ");
    } else {
      setForm((prev) => ({ ...prev, reminderEnabled: false }));
      setReminderNotice(
        "สิทธิ์แจ้งเตือนถูกปิดไว้ในเบราว์เซอร์ — คุณยังสามารถดาวน์โหลดไฟล์ปฏิทิน (.ics) เพื่อตั้งเตือนรายวันได้ฟรีครับ"
      );
    }
  };

  const handleTestReminder = async () => {
    setReminderNotice(null);
    if (typeof window === "undefined" || !("Notification" in window)) {
      setReminderNotice("เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนโดยตรง");
      return;
    }
    if (Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setReminderNotice("กรุณาอนุญาตการแจ้งเตือนในเบราว์เซอร์ก่อนทดสอบครับ");
        return;
      }
    }
    const summary = await getLearningSummary();
    const sent = showBrowserStudyNotification({
      dueCount: summary.dueCount,
      dailyMinutes: form.dailyMinutes,
      learnerLevel: form.learnerLevel,
    });
    setReminderNotice(
      sent ? "ส่งการแจ้งเตือนทดสอบแล้ว!" : "ไม่สามารถแสดงการแจ้งเตือนได้"
    );
  };

  const handleDownloadIcs = () => {
    const icsText = buildStudyReminderIcs({
      timeHHMM: form.reminderTime ?? "20:00",
      dailyMinutes: form.dailyMinutes ?? 20,
      learnerLevel: form.learnerLevel,
      appOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
    });
    const blob = new Blob([icsText], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kotonoha-reminder-${form.learnerLevel.toLowerCase()}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    setReminderNotice(
      "ดาวน์โหลดไฟล์ปฏิทิน .ics แล้ว! เปิดไฟล์เพื่อเพิ่มเตือนฝึกทุกวันลง Google Calendar / Apple Calendar ได้เลย"
    );
  };

  const handleExport = async () => {
    const json = await exportDatabaseJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kotonoha-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupMessage("ดาวน์โหลดไฟล์สำรองข้อมูลเรียบร้อยแล้ว");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const restored = await importDatabaseJson(text);
      const refreshed = await getAppSettings();
      setForm(refreshed);
      broadcastThemePreference(refreshed.theme ?? "system");
      setBackupMessage(
        `นำเข้าข้อมูลสำเร็จ! กู้คืนการ์ด ${restored.cards} ใบ, ประวัติทบทวน ${restored.reviewLogs} ครั้ง, Minna ${restored.minnaLessons} บท และผลสอบ JLPT ${restored.jlptAttempts} ครั้ง`
      );
    } catch (err) {
      setBackupMessage(
        err instanceof Error ? err.message : "นำเข้าไฟล์ไม่สำเร็จ"
      );
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <StudyPageHero
        tone="matcha"
        kanjiWatermark="設定"
        eyebrow="Preferences & Local Data"
        title="ตั้งค่าการเรียน & สำรองข้อมูล"
        subtitle="ข้อมูลการเรียนและ API Key ทั้งหมดถูกเก็บไว้ในเบราว์เซอร์ของคุณเอง (IndexedDB) ไม่ส่งออกไปเก็บที่เซิร์ฟเวอร์อื่น"
      />

      <form onSubmit={handleSave} className="space-y-6">
        {/* FSRS & Study Settings */}
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-4">
          <h2 className="font-bold text-base">1. ระบบความจำ FSRS-7 & การอ่าน</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium block">
                เป้าหมายอัตราการจำได้ (Desired Retention):{" "}
                <strong className="text-primary">
                  {Math.round(form.desiredRetention * 100)}%
                </strong>
              </span>
              <input
                type="range"
                min={0.8}
                max={0.96}
                step={0.01}
                value={form.desiredRetention}
                onChange={(e) =>
                  setForm({ ...form, desiredRetention: Number(e.target.value) })
                }
                className="w-full accent-primary"
              />
              <span className="text-xs text-foreground/60 block">
                แนะนำ 90% (ค่าสูงขึ้นจะจำแม่นขึ้นแต่จำนวนทบทวนต่อวันจะมากขึ้น)
              </span>
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium block">จำนวนการ์ดใหม่ต่อวัน</span>
              <input
                type="number"
                min={5}
                max={50}
                value={form.dailyNewCards}
                onChange={(e) =>
                  setForm({ ...form, dailyNewCards: Number(e.target.value) || 10 })
                }
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background"
              />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium block">ระดับภาษาปัจจุบัน (JLPT)</span>
              <select
                value={form.learnerLevel}
                onChange={(e) =>
                  setForm({
                    ...form,
                    learnerLevel: e.target.value as JlptLevel,
                  })
                }
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background"
              >
                <option value="N5">N5 (เริ่มต้น)</option>
                <option value="N4">N4 (พื้นฐานสนทนาได้)</option>
                <option value="N3">N3 (ระดับกลาง คุยธรรมชาติ)</option>
                <option value="N2">N2 (ระดับสูง อ่านข่าว/ทำงาน)</option>
                <option value="N1">N1 (ระดับเชี่ยวชาญ วิชาการ)</option>
              </select>
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium block">ธีมหน้าจอ (Appearance)</span>
              <select
                value={form.theme ?? "system"}
                onChange={(e) => {
                  const nextTheme = e.target.value as ThemePreference;
                  setForm({ ...form, theme: nextTheme });
                  broadcastThemePreference(nextTheme);
                }}
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background"
              >
                <option value="system">ตามระบบปฏิบัติการ (System)</option>
                <option value="light">โหมดสว่าง (Washi Light)</option>
                <option value="dark">โหมดมืด (Sumi Dark)</option>
              </select>
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium block">Furigana เริ่มต้นในหน้าอ่าน</span>
              <select
                value={form.furiganaMode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    furiganaMode: e.target.value as "all" | "unknown" | "off",
                  })
                }
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background"
              >
                <option value="unknown">แสดงเฉพาะคำที่ยังไม่เคยเรียน (แนะนำ)</option>
                <option value="all">แสดงทุกคำ</option>
                <option value="off">ซ่อนทั้งหมด</option>
              </select>
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium block">เวลาเรียนต่อวัน (แผนรายวัน)</span>
              <select
                value={form.dailyMinutes ?? 20}
                onChange={(e) =>
                  setForm({
                    ...form,
                    dailyMinutes: Number(e.target.value) || 20,
                  })
                }
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background"
              >
                {DAILY_TIME_OPTIONS.map((opt) => (
                  <option key={opt.minutes} value={opt.minutes}>
                    {opt.label} — {opt.subtitle}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium block">เป้าหมายหลักในการฝึก</span>
              <select
                value={form.studyGoalFocus ?? "balanced"}
                onChange={(e) =>
                  setForm({
                    ...form,
                    studyGoalFocus: e.target.value as StudyGoalFocus,
                  })
                }
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background"
              >
                {STUDY_FOCUS_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="pt-1">
            <Link
              href="/?onboarding=1"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline underline-offset-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>ทำแบบสอบถามประเมินระดับและจัดแผนใหม่อีกครั้ง</span>
            </Link>
          </div>
        </section>

        {/* Voice / TTS Settings */}
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-4">
          <h2 className="font-bold text-base">2. เสียงอ่านภาษาญี่ปุ่น (Text-to-Speech)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium block">เลือกเสียงญี่ปุ่นในเครื่อง</span>
              <select
                value={form.preferredVoiceName}
                onChange={(e) =>
                  setForm({ ...form, preferredVoiceName: e.target.value })
                }
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background"
              >
                <option value="">เลือกอัตโนมัติ (แนะนำ)</option>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium block">
                ความเร็วเสียง: <strong>{form.speechRate.toFixed(2)}x</strong>
              </span>
              <input
                type="range"
                min={0.65}
                max={1.25}
                step={0.05}
                value={form.speechRate}
                onChange={(e) =>
                  setForm({ ...form, speechRate: Number(e.target.value) })
                }
                className="w-full accent-primary"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() =>
              speakJapanese("おはようございます。今日も日本語を頑張りましょう！", {
                rate: form.speechRate,
                voiceName: form.preferredVoiceName || undefined,
              })
            }
            className="px-3.5 py-2 rounded-xl border border-border hover:bg-surface-muted text-xs font-medium cursor-pointer"
          >
            ทดสอบฟังเสียงพูด
          </button>
        </section>

        {/* AI Tutor Settings */}
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-4">
          <h2 className="font-bold text-base">
            3. คู่สนทนา AI Kaiwa & แต่งนิทาน i+1 (ไม่บังคับ)
          </h2>
          <p className="text-xs text-foreground/70">
            หากเลือกโหมด Offline คุณยังใช้งานได้ครบทุกฟีเจอร์ผ่านบทสนทนาจำลอง แต่หากใส่ Gemini หรือ OpenAI API Key จะสามารถคุยโต้ตอบสดได้ทุกหัวข้อและให้ AI แต่งบทอ่าน i+1 เฉพาะตัวได้ครับ
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium block">ผู้ให้บริการ AI</span>
              <select
                value={form.aiProvider}
                onChange={(e) => {
                  const provider = e.target.value as AiProvider;
                  setForm({
                    ...form,
                    aiProvider: provider,
                    aiModel:
                      provider === "openai" ? "gpt-4o-mini" : "gemini-3.8-flash",
                  });
                }}
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background"
              >
                <option value="offline">โหมด Offline (ไม่ต้องใช้ API Key)</option>
                <option value="gemini">Google Gemini API</option>
                <option value="openai">OpenAI API</option>
              </select>
            </label>

            {form.aiProvider !== "offline" && (
              <>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium block">Model Name</span>
                  <input
                    type="text"
                    value={form.aiModel}
                    onChange={(e) => setForm({ ...form, aiModel: e.target.value })}
                    placeholder={
                      form.aiProvider === "gemini" ? "gemini-3.8-flash" : "gpt-4o-mini"
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-border bg-background font-mono text-xs"
                  />
                </label>

                <label className="space-y-1.5 text-sm sm:col-span-2">
                  <span className="font-medium block">API Key (เก็บเฉพาะในเครื่องของคุณ)</span>
                  <input
                    type="password"
                    value={form.apiKey}
                    onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                    placeholder="วาง API Key ที่นี่..."
                    className="w-full px-3.5 py-2 rounded-xl border border-border bg-background font-mono text-xs"
                  />
                </label>
              </>
            )}
          </div>
        </section>

        {/* Study Reminder & Calendar */}
        <section
          id="reminder"
          className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-4 scroll-mt-24"
        >
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-base">
              4. แจ้งเตือนฝึกภาษาญี่ปุ่นรายวัน &amp; ปฏิทิน (.ics)
            </h2>
          </div>
          <p className="text-xs text-foreground/70 leading-relaxed">
            ช่วยให้ไม่ลืมกลับมาทบทวน FSRS เพื่อรักษา Streak ต่อเนื่อง: เปิดแจ้งเตือนเมื่อเปิดเว็บ หรือส่งออกนัดหมายประจำวันลง Google/Apple Calendar
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 cursor-pointer">
              <div className="text-xs">
                <div className="font-semibold text-sm">เปิดแจ้งเตือนเมื่อมีคำรอทบทวน</div>
                <div className="text-foreground/65 mt-0.5">
                  เตือน 1 ครั้ง/วัน เมื่อถึงเวลาที่กำหนดและเปิดแอปอยู่
                </div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(form.reminderEnabled)}
                onChange={(e) => void handleToggleBrowserReminder(e.target.checked)}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium block">เวลาเตือนประจำวัน</span>
              <input
                type="time"
                value={parseReminderHHMM(form.reminderTime).formatted}
                onChange={(e) =>
                  setForm({ ...form, reminderTime: e.target.value || "20:00" })
                }
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => void handleTestReminder()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-background hover:bg-surface-muted text-xs font-medium cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-primary" />
              <span>ทดสอบแจ้งเตือนทันที</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadIcs}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 text-xs font-semibold cursor-pointer"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              <span>ดาวน์โหลดปฏิทินเตือนทุกวัน (.ics)</span>
            </button>
          </div>

          {reminderNotice && (
            <div className="text-xs text-primary font-medium">{reminderNotice}</div>
          )}
        </section>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>บันทึกการตั้งค่า</span>
          </button>

          {savedNotice && (
            <span className="inline-flex items-center gap-1 text-sm text-matcha font-medium">
              <Check className="w-4 h-4" /> บันทึกแล้ว!
            </span>
          )}
        </div>
      </form>

      {/* Backup & Restore */}
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-4">
        <h2 className="font-bold text-base">5. สำรองและกู้คืนข้อมูล (Export / Import JSON)</h2>
        <p className="text-xs text-foreground/70">
          ส่งออกและกู้คืนข้อมูลครบทั้ง 10 ตาราง: การ์ด FSRS, ประวัติการทบทวน (Memory Curve), Kana, บทอ่าน, Kaiwa, Shadowing, Minna 50 บท และประวัติข้อสอบ JLPT
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-surface hover:bg-surface-muted text-sm font-medium cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export JSON Backup</span>
          </button>

          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-surface hover:bg-surface-muted text-sm font-medium cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Import JSON Backup</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
        </div>
        {backupMessage && (
          <div className="text-xs text-primary font-medium">{backupMessage}</div>
        )}
      </section>
    </div>
  );
}
