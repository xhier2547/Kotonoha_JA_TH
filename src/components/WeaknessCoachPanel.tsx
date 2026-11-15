"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  Loader2,
  Sparkles,
  Target,
  XCircle,
} from "lucide-react";
import { analyzeLearnerWeaknesses } from "@/lib/weaknessAnalyzer";
import type {
  AppSettings,
  JlptAttemptRecord,
  ReviewLogRecord,
  SrsCardRecord,
} from "@/types/learning";

interface MiniDrillItem {
  promptJp: string;
  choices: string[];
  correctIndex: number;
  explainTh: string;
}

interface AiCoachReport {
  diagnosisTh: string;
  actionPlanTh: string[];
  miniDrills: MiniDrillItem[];
}

interface WeaknessCoachPanelProps {
  cards: SrsCardRecord[];
  reviewLogs: ReviewLogRecord[];
  jlptAttempts: JlptAttemptRecord[];
  settings: AppSettings | null;
}

export function WeaknessCoachPanel({
  cards,
  reviewLogs,
  jlptAttempts,
  settings,
}: WeaknessCoachPanelProps) {
  const analysis = useMemo(
    () =>
      analyzeLearnerWeaknesses({
        cards,
        reviewLogs,
        jlptAttempts,
      }),
    [cards, reviewLogs, jlptAttempts]
  );

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [coachReport, setCoachReport] = useState<AiCoachReport | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});

  const hasAiKey =
    Boolean(settings) &&
    settings?.aiProvider !== "offline" &&
    Boolean(settings?.apiKey?.trim());

  async function handleRequestAiCoach() {
    if (!settings || settings.aiProvider === "offline" || !settings.apiKey.trim()) {
      setErrorMsg(
        "กรุณาตั้งค่า Gemini หรือ OpenAI API Key ในหน้าตั้งค่าก่อนใช้งาน AI Coach"
      );
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSelectedAnswers({});

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "ai-coach",
          provider: settings.aiProvider,
          apiKey: settings.apiKey,
          model: settings.aiModel,
          level: settings.learnerLevel,
          againRatePct: analysis.againRatePct,
          hardWordsSummary: analysis.hardestCards.map(
            (c) => `${c.front} (${c.reading}: ${c.meaningTh}, lapses=${c.lapses})`
          ),
          weakSectionsSummary: analysis.weakJlptSections.map(
            (s) => `${s.labelTh}: ${s.avgScore}/${s.maxScore} (${s.avgPct}%)`
          ),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "ไม่สามารถเรียก AI Coach ได้");
      }

      setCoachReport({
        diagnosisTh: data.diagnosisTh ?? "",
        actionPlanTh: Array.isArray(data.actionPlanTh) ? data.actionPlanTh : [],
        miniDrills: Array.isArray(data.miniDrills) ? data.miniDrills : [],
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="studio-card animate-fade-up rounded-2xl border border-border bg-surface/90 backdrop-blur-xs p-5 sm:p-6 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary mb-1">
            <BrainCircuit className="w-3.5 h-3.5" strokeWidth={1.6} />
            <span>AI Weakness Coach & Diagnostic</span>
          </div>
          <h2 className="text-lg font-bold">วิเคราะห์จุดอ่อนการจำ & ผลสอบ JLPT</h2>
          <p className="text-xs text-foreground/65 mt-0.5">
            สรุปการ์ดที่ลืมบ่อยจาก FSRS-7 และพาร์ตข้อสอบที่คะแนนต่ำกว่าเกณฑ์ พร้อมจัดแผนแก้และควิซเฉพาะจุด
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!hasAiKey ? (
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-background text-xs font-medium hover:border-primary/40 transition-colors"
            >
              <span>ตั้งค่า AI Key</span>
              <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.6} />
            </Link>
          ) : null}
          <button
            type="button"
            onClick={handleRequestAiCoach}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:opacity-95 transition-opacity disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.6} />
            )}
            <span>
              {loading
                ? "กำลังวิเคราะห์..."
                : "ให้ AI วางแผนแก้จุดอ่อน & ออกควิซ 3 ข้อ"}
            </span>
          </button>
        </div>
      </div>

      {/* Offline Diagnostic Banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-sm text-foreground/85 flex items-start gap-2.5">
        <Target className="w-4 h-4 text-primary shrink-0 mt-0.5" strokeWidth={1.6} />
        <div className="space-y-1 flex-1">
          <div className="font-medium leading-relaxed">{analysis.recommendedFocusTh}</div>
          <div className="flex flex-wrap gap-3 text-xs text-foreground/65 pt-0.5">
            <span>การ์ดที่เคยทบทวน: {analysis.totalReviewedCards} ใบ</span>
            <span>ครั้งที่กด Again: {analysis.againRatePct}%</span>
            <span>ผลสอบ JLPT ที่บันทึก: {jlptAttempts.length} ครั้ง</span>
          </div>
        </div>
      </div>

      {/* Offline Two-Column Breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Hardest SRS Cards */}
        <div className="rounded-xl border border-border bg-background/60 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              คำศัพท์/ไวยากรณ์ที่ความคงจำต่ำ (Lapses สูง)
            </h3>
            <Link
              href="/srs"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <span>ทวนใน FSRS</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {analysis.hardestCards.length === 0 ? (
            <div className="text-xs text-foreground/60 py-4 text-center">
              ยังไม่มีการ์ดที่มีค่า Lapse สูง (หรือยังไม่ได้เริ่มทบทวนใน FSRS)
            </div>
          ) : (
            <div className="space-y-2">
              {analysis.hardestCards.slice(0, 5).map((card) => (
                <div
                  key={card.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-surface px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {card.front}{" "}
                      <span className="font-normal text-xs text-foreground/60">
                        ({card.reading})
                      </span>
                    </div>
                    <div className="text-foreground/70 truncate">{card.meaningTh}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold text-amber-600 dark:text-amber-400">
                      ลืม {card.lapses} ครั้ง
                    </div>
                    <div className="text-[11px] text-foreground/55">
                      Difficulty {card.difficulty}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weak JLPT Sections */}
        <div className="rounded-xl border border-border bg-background/60 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">วิเคราะห์รายพาร์ต JLPT</h3>
            <Link
              href="/jlpt"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <span>เข้าสู่คลังข้อสอบ</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {analysis.weakJlptSections.length === 0 ? (
            <div className="text-xs text-foreground/60 py-4 text-center">
              ยังไม่มีผลสอบ JLPT ในเครื่อง ลองทำข้อสอบจำลองสัก 1 ชุดเพื่อให้ระบบวิเคราะห์จุดอ่อน
            </div>
          ) : (
            <div className="space-y-2">
              {analysis.weakJlptSections.map((sec) => (
                <div
                  key={sec.key}
                  className="rounded-lg border border-border/80 bg-surface px-3 py-2.5 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{sec.labelTh}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        sec.status === "below_pass"
                          ? "bg-red-500/15 text-red-600 dark:text-red-400"
                          : sec.status === "needs_boost"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {sec.status === "below_pass"
                        ? "ต่ำกว่าเกณฑ์ผ่าน"
                        : sec.status === "needs_boost"
                          ? "ควรเสริมเพิ่ม"
                          : "ผ่านเกณฑ์"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-foreground/60">
                    <span>
                      เฉลี่ย {sec.avgScore}/{sec.maxScore} คะแนน (เกณฑ์ขั้นต่ำ{" "}
                      {sec.minPassScore})
                    </span>
                    <span>{sec.avgPct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        sec.status === "below_pass"
                          ? "bg-red-500"
                          : sec.status === "needs_boost"
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(4, sec.avgPct))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {errorMsg ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      ) : null}

      {/* AI Prescription & Interactive Mini-Quiz */}
      {coachReport ? (
        <div className="rounded-xl border border-primary/25 bg-background/70 p-4 sm:p-5 space-y-4">
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-primary">
              คำวินิจฉัยและแผนแก้จุดอ่อนเฉพาะคุณ
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {coachReport.diagnosisTh}
            </p>
            {coachReport.actionPlanTh.length > 0 ? (
              <ul className="space-y-1.5 pt-2">
                {coachReport.actionPlanTh.map((step, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs text-foreground/80"
                  >
                    <CheckCircle2
                      className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                      strokeWidth={1.6}
                    />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {coachReport.miniDrills.length > 0 ? (
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="text-xs font-semibold text-foreground/75">
                ควิซฝึกซ้อมแก้จุดอ่อน (คลิกเลือกคำตอบ)
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {coachReport.miniDrills.map((drill, qIdx) => {
                  const chosen = selectedAnswers[qIdx];
                  const answered = chosen !== undefined;
                  return (
                    <div
                      key={qIdx}
                      className="rounded-xl border border-border bg-surface p-3.5 space-y-2.5 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-primary">
                          ข้อที่ {qIdx + 1}
                        </div>
                        <div className="text-sm font-medium jp-text leading-relaxed">
                          {drill.promptJp}
                        </div>
                        <div className="space-y-1.5">
                          {drill.choices.map((choice, cIdx) => {
                            const isChosen = chosen === cIdx;
                            const isCorrect = cIdx === drill.correctIndex;
                            let btnStyle =
                              "border-border bg-background hover:border-primary/40";
                            if (answered) {
                              if (isCorrect) {
                                btnStyle =
                                  "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
                              } else if (isChosen) {
                                btnStyle =
                                  "border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-300";
                              }
                            }
                            return (
                              <button
                                key={cIdx}
                                type="button"
                                onClick={() =>
                                  setSelectedAnswers((prev) => ({
                                    ...prev,
                                    [qIdx]: cIdx,
                                  }))
                                }
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs jp-text flex items-center justify-between gap-2 transition-colors ${btnStyle}`}
                              >
                                <span>{choice}</span>
                                {answered && isCorrect ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                ) : answered && isChosen ? (
                                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {answered ? (
                        <div className="text-[11px] text-foreground/75 pt-2 border-t border-border/70 leading-relaxed">
                          {drill.explainTh}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
