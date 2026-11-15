"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  GraduationCap,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { saveAppSettings } from "@/lib/db";
import {
  DAILY_TIME_OPTIONS,
  PROFICIENCY_OPTIONS,
  STUDY_FOCUS_OPTIONS,
  buildSettingsFromOnboarding,
  computeDailyStudyPlan,
  inferProficiencyTrack,
  type ProficiencyTrack,
} from "@/lib/studyPlan";
import type { AppSettings, StudyGoalFocus } from "@/types/learning";

interface OnboardingModalProps {
  open: boolean;
  initialSettings: AppSettings;
  userLabel?: string | null;
  onClose: () => void;
  onSaved: (updated: AppSettings) => void;
}

export function OnboardingModal({
  open,
  initialSettings,
  userLabel,
  onClose,
  onSaved,
}: OnboardingModalProps) {
  const [proficiency, setProficiency] = useState<ProficiencyTrack>(() =>
    inferProficiencyTrack(initialSettings)
  );
  const [dailyMinutes, setDailyMinutes] = useState<number>(
    initialSettings.dailyMinutes ?? 20
  );
  const [studyGoalFocus, setStudyGoalFocus] = useState<StudyGoalFocus>(
    initialSettings.studyGoalFocus ?? "balanced"
  );
  const [saving, setSaving] = useState(false);

  const previewSettings = useMemo(
    () =>
      buildSettingsFromOnboarding(
        { proficiency, dailyMinutes, studyGoalFocus },
        initialSettings
      ),
    [proficiency, dailyMinutes, studyGoalFocus, initialSettings]
  );

  const previewPlan = useMemo(
    () => computeDailyStudyPlan(previewSettings),
    [previewSettings]
  );

  if (!open) return null;

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const updated = await saveAppSettings({
        learnerLevel: previewSettings.learnerLevel,
        furiganaMode: previewSettings.furiganaMode,
        dailyMinutes: previewSettings.dailyMinutes,
        dailyNewCards: previewSettings.dailyNewCards,
        desiredRetention: previewSettings.desiredRetention,
        studyGoalFocus: previewSettings.studyGoalFocus,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
      });
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSaving(true);
    try {
      const updated = await saveAppSettings({
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
      });
      onSaved(updated);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const furiganaLabel =
    previewSettings.furiganaMode === "all"
      ? "แสดงคำอ่านทุกคำ"
      : previewSettings.furiganaMode === "off"
        ? "ซ่อนคำอ่าน (ฝึกจำคันจิ)"
        : "ซ่อนคำที่รู้แล้วอัตโนมัติ";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="w-full max-w-2xl rounded-3xl border border-border bg-surface shadow-2xl overflow-hidden my-auto">
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4 border-b border-border/70 bg-gradient-to-r from-primary/10 via-accent/5 to-transparent">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-primary/15 text-primary mb-1.5">
              <Sparkles className="w-3 h-3" />
              <span>ปรับแผนการเรียนส่วนตัวครั้งแรก</span>
            </div>
            <h2 id="onboarding-title" className="text-lg sm:text-xl font-bold">
              {userLabel
                ? `ยินดีต้อนรับคุณ ${userLabel}! มาตั้งค่าระดับการเรียนกันครับ`
                : "ประเมินระดับภาษาและเวลาเรียนต่อวันของคุณ"}
            </h2>
            <p className="text-xs text-foreground/70 mt-0.5">
              ระบบจะนำคำตอบไปปรับลำดับการ์ด FSRS, ระดับข้อสอบ JLPT, บทความ Reader, Furigana และแผนรายวันทันที
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleSkip()}
            disabled={saving}
            aria-label="ข้ามแบบสอบถาม"
            className="p-1.5 rounded-xl border border-border hover:bg-surface-muted text-foreground/60 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Question 1: Proficiency */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-bold">
              <GraduationCap className="w-4 h-4 text-primary" />
              <span>1. ตอนนี้พื้นฐานภาษาญี่ปุ่นของคุณอยู่ระดับไหนครับ?</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PROFICIENCY_OPTIONS.map((opt) => {
                const active = proficiency === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setProficiency(opt.id)}
                    className={`text-left rounded-2xl border p-3.5 transition-all cursor-pointer ${
                      active
                        ? "border-primary bg-primary/8 ring-2 ring-primary/20"
                        : "border-border bg-background hover:bg-surface-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">{opt.label}</span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-surface-muted text-foreground/70"
                        }`}
                      >
                        {opt.badge}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/65 mt-1 leading-relaxed">
                      {opt.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Question 2: Daily Time */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Clock className="w-4 h-4 text-accent" />
              <span>2. คุณมีเวลาฝึกภาษาญี่ปุ่นได้วันละประมาณกี่นาที?</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {DAILY_TIME_OPTIONS.map((opt) => {
                const active = dailyMinutes === opt.minutes;
                return (
                  <button
                    key={opt.minutes}
                    type="button"
                    onClick={() => setDailyMinutes(opt.minutes)}
                    className={`text-left rounded-2xl border p-3 transition-all cursor-pointer ${
                      active
                        ? "border-primary bg-primary/8 ring-2 ring-primary/20"
                        : "border-border bg-background hover:bg-surface-muted"
                    }`}
                  >
                    <div className="text-sm font-bold">{opt.label}</div>
                    <div className="text-[11px] text-foreground/65 mt-0.5">
                      {opt.subtitle}
                    </div>
                    <div className="text-[11px] font-medium text-primary mt-1.5">
                      ศัพท์ใหม่ {opt.dailyNewCards} ใบ/วัน
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Question 3: Study Focus */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Target className="w-4 h-4 text-matcha" />
              <span>3. เป้าหมายหลักที่อยากเน้นมากที่สุดตอนนี้</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {STUDY_FOCUS_OPTIONS.map((opt) => {
                const active = studyGoalFocus === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStudyGoalFocus(opt.id)}
                    className={`text-left rounded-2xl border p-3 transition-all cursor-pointer ${
                      active
                        ? "border-primary bg-primary/8 ring-2 ring-primary/20"
                        : "border-border bg-background hover:bg-surface-muted"
                    }`}
                  >
                    <div className="text-xs font-bold">{opt.label}</div>
                    <div className="text-[11px] text-foreground/65 mt-0.5 leading-relaxed">
                      {opt.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Live Calculated Preview */}
          <section className="rounded-2xl border border-primary/25 bg-primary/5 p-4 space-y-2.5">
            <div className="text-xs font-bold text-primary">
              ระบบจะปรับการเรียนรู้จริงให้คุณทันทีดังนี้:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-xl bg-surface p-2.5 border border-border/70">
                <div className="text-foreground/60 text-[11px]">ระดับ JLPT</div>
                <div className="font-bold text-sm mt-0.5">
                  {previewSettings.learnerLevel}
                </div>
              </div>
              <div className="rounded-xl bg-surface p-2.5 border border-border/70">
                <div className="text-foreground/60 text-[11px]">การ์ดใหม่ / วัน</div>
                <div className="font-bold text-sm mt-0.5">
                  {previewSettings.dailyNewCards} ใบ
                </div>
              </div>
              <div className="rounded-xl bg-surface p-2.5 border border-border/70">
                <div className="text-foreground/60 text-[11px]">FSRS Retention</div>
                <div className="font-bold text-sm mt-0.5">
                  {Math.round(previewSettings.desiredRetention * 100)}%
                </div>
              </div>
              <div className="rounded-xl bg-surface p-2.5 border border-border/70">
                <div className="text-foreground/60 text-[11px]">Furigana</div>
                <div className="font-bold text-[11px] mt-1">{furiganaLabel}</div>
              </div>
            </div>
            <div className="text-[11px] text-foreground/75 flex flex-wrap gap-x-3 gap-y-1">
              {previewPlan.blocks.map((block, i) => (
                <span key={block.title}>
                  {i + 1}. {block.title} ({block.minutes} นาที)
                </span>
              ))}
            </div>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-border/70 bg-surface-muted/40">
          <button
            type="button"
            onClick={() => void handleSkip()}
            disabled={saving}
            className="text-xs text-foreground/65 hover:text-foreground underline underline-offset-2 cursor-pointer"
          >
            ข้ามไปก่อน (ปรับทีหลังได้ในตั้งค่า)
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleConfirm()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:opacity-95 disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{saving ? "กำลังบันทึกแผน..." : "บันทึกและเริ่มเรียนตามแผนนี้"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
