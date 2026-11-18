"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Award,
  Bell,
  BookMarked,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  Languages,
  MessageCircle,
  Mic,
  PlusCircle,
  SlidersHorizontal,
  Sparkles,
  Target,
} from "lucide-react";
import {
  db,
  getAppSettings,
  getJlptAttempts,
  getLearningSummary,
  getLocalDayKey,
  getMinnaProgressMap,
  getStudyAnalytics,
  mineCardToSrs,
  type StudyAnalyticsData,
} from "@/lib/db";
import { getAuthenticatedUser, getUserDisplayName } from "@/lib/supabase";
import { computeDailyStudyPlan } from "@/lib/studyPlan";
import {
  computeLearnerProgressStats,
  getDailyWordHighlight,
  getJlptLevelBadgeStyle,
  getTimeGreetingJp,
} from "@/lib/gamification";
import { DailyGoalRing } from "@/components/CelebrationEffects";
import { SpeakButton } from "@/components/SpeakButton";
import { MemoryCurvePanel } from "@/components/MemoryCurvePanel";
import { OnboardingModal } from "@/components/OnboardingModal";
import { StudyAnalyticsPanel } from "@/components/StudyAnalyticsPanel";
import { WeaknessCoachPanel } from "@/components/WeaknessCoachPanel";
import {
  CrestSealIcon,
  FlashcardDeckIcon,
} from "@/components/LuxuryIcons";
import type {
  AppSettings,
  JlptAttemptRecord,
  ReviewLogRecord,
  SrsCardRecord,
} from "@/types/learning";

interface SummaryState {
  totalCards: number;
  dueCount: number;
  newCount: number;
  learnedCount: number;
  masteredCount: number;
  todayReviews: number;
  streak: number;
  kanaMasteredCount: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<SummaryState | null>(null);
  const [cards, setCards] = useState<SrsCardRecord[]>([]);
  const [reviewLogs, setReviewLogs] = useState<ReviewLogRecord[]>([]);
  const [jlptAttempts, setJlptAttempts] = useState<JlptAttemptRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [analytics, setAnalytics] = useState<StudyAnalyticsData | null>(null);
  const [retentionTarget, setRetentionTarget] = useState(0.9);
  const [nowMs, setNowMs] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [completedMinnaCount, setCompletedMinnaCount] = useState(0);
  const [todayKey, setTodayKey] = useState("2026-11-18");
  const [greeting, setGreeting] = useState({ jp: "こんにちは", th: "สวัสดี" });
  const [dailyWordAdded, setDailyWordAdded] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [
        res,
        allCards,
        allLogs,
        attempts,
        minnaMap,
        loadedSettings,
        studyStats,
        authUser,
      ] = await Promise.all([
        getLearningSummary(),
        db.cards.toArray(),
        db.reviewLogs.toArray(),
        getJlptAttempts(),
        getMinnaProgressMap(),
        getAppSettings(),
        getStudyAnalytics(84),
        getAuthenticatedUser(),
      ]);
      if (!active) return;
      setSummary({
        totalCards: res.totalCards,
        dueCount: res.dueCount,
        newCount: res.newCount,
        learnedCount: res.learnedCount,
        masteredCount: res.masteredCount,
        todayReviews: res.todayReviews,
        streak: res.streak,
        kanaMasteredCount: res.kanaMasteredCount,
      });
      setCards(allCards);
      setReviewLogs(allLogs);
      setJlptAttempts(attempts);
      setCompletedMinnaCount(
        Object.values(minnaMap).filter((m) => m.completed).length
      );
      setSettings(loadedSettings);
      setAnalytics(studyStats);
      setRetentionTarget(loadedSettings.desiredRetention);
      setNowMs(Date.now());
      const now = new Date();
      setTodayKey(getLocalDayKey(now));
      setGreeting(getTimeGreetingJp(now.getHours()));
      setAccountName(authUser ? getUserDisplayName(authUser) : null);

      const requestedOnboarding =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("onboarding") === "1";
      if (requestedOnboarding || (authUser && !loadedSettings.onboardingCompleted)) {
        setShowOnboarding(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const studyPlan = settings
    ? computeDailyStudyPlan(settings, {
        dueCount: summary?.dueCount,
        kanaMasteredCount: summary?.kanaMasteredCount,
      })
    : null;

  const xpStats = computeLearnerProgressStats({
    totalReviews: reviewLogs.length,
    learnedCount: summary?.learnedCount ?? 0,
    masteredCount: summary?.masteredCount ?? 0,
    kanaMasteredCount: summary?.kanaMasteredCount ?? 0,
    completedMinnaCount,
    jlptAttempts,
    streak: summary?.streak ?? 0,
  });

  const dailyWord = getDailyWordHighlight(
    todayKey,
    settings?.learnerLevel ?? "N5"
  );
  const dailyWordAlreadyInDeck =
    dailyWordAdded ||
    cards.some((c) => c.front === dailyWord.word && c.fsrs.reps > 0);

  const handleMineDailyWord = async () => {
    await mineCardToSrs({
      front: dailyWord.word,
      reading: dailyWord.reading,
      meaningTh: dailyWord.meaningTh,
      meaningEn: dailyWord.meaningEn,
      pitch: dailyWord.pitch,
      exampleSentence: dailyWord.exampleSentence,
      exampleReading: dailyWord.exampleReading,
      exampleMeaningTh: dailyWord.exampleMeaningTh,
      cardType: "vocab",
      tags: [dailyWord.jlpt, "Kotoba of the Day"],
    });
    setDailyWordAdded(true);
  };

  const nextAction = (() => {
    if (!summary) {
      return {
        title: "กำลังเตรียมข้อมูลการเรียน...",
        desc: "โหลดคลังคำศัพท์และสถานะ FSRS",
        href: "/srs",
        cta: "ไปที่ FSRS",
      };
    }
    if (summary.dueCount > 0) {
      return {
        title: `มีการ์ดรอทบทวน ${summary.dueCount} ใบวันนี้`,
        desc: `การทบทวนตามเวลาที่ FSRS-7 คำนวณไว้ (เป้าหมายจำได้ ${Math.round((settings?.desiredRetention ?? 0.9) * 100)}%) คือวิธีจำแม่นที่สุด`,
        href: "/srs",
        cta: "เริ่มทบทวน FSRS ทันที",
      };
    }
    const isBeginnerN5 = (settings?.learnerLevel ?? "N5") === "N5";
    if (isBeginnerN5 && summary.kanaMasteredCount < 25) {
      return {
        title: "เริ่มต้นที่รากฐาน: Kana & ระบบเสียง",
        desc: "ฝึกจำ Hiragana/Katakana ด้วยภาพจำและเกมพิมพ์ตอบเร็ว พร้อมเข้าใจ Pitch Accent ตั้งแต่วันแรก",
        href: "/kana",
        cta: "เข้าสู่ Kana Dojo",
      };
    }
    if (settings?.studyGoalFocus === "jlpt") {
      return {
        title: `ซ้อมข้อสอบ JLPT ${settings.learnerLevel} ตามเป้าหมายของคุณ`,
        desc: "ทำแบบทดสอบจับเวลาจริงพร้อมคลิกเก็บคำที่ไม่รู้เข้าคลัง FSRS ได้ทันที",
        href: "/jlpt",
        cta: `ทำข้อสอบ JLPT ${settings.learnerLevel}`,
      };
    }
    if (settings?.studyGoalFocus === "conversation") {
      return {
        title: "ฝึกพูดโต้ตอบ & ฟังในสถานการณ์จริง",
        desc: "เข้าสู่ AI Kaiwa หรือ Shadowing เพื่อพัฒนาความคล่องในการตอบโต้ทันที",
        href: "/kaiwa",
        cta: "เปิด AI Kaiwa",
      };
    }
    if (summary.learnedCount < 15) {
      return {
        title: `สะสมคลังคำศัพท์และคันจิระดับ ${settings?.learnerLevel ?? "N5"}`,
        desc: `ยังมีการ์ดใหม่อีก ${summary.newCount} ใบ (จัดลำดับตามระดับ ${settings?.learnerLevel ?? "N5"} วันละ ${settings?.dailyNewCards ?? 15} ใบ)`,
        href: "/srs",
        cta: "เรียนการ์ดใหม่ (FSRS)",
      };
    }
    return {
      title: `ฝึกอ่าน i+1 ระดับ ${settings?.learnerLevel ?? "N5"} และพูดโต้ตอบ`,
      desc: "อ่านบทความจริง ตัดคำอัตโนมัติด้วย Kuromoji แล้วฝึก Shadowing / AI Kaiwa เพื่อให้พูดคล่อง!",
      href: "/reader",
      cta: "เปิด Immersion Reader",
    };
  })();

  const phases = [
    {
      num: "Phase 1",
      title: "ตัวอักษร Kana & ระบบเสียง Pitch",
      desc: "จำ Hiragana / Katakana ด้วย Mnemonics, เกมพิมพ์ Active Recall และเข้าใจจังหวะ Mora + Pitch Accent",
      href: "/kana",
      icon: Languages,
      color: "text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20",
      metric: summary ? `จำแม่นแล้ว ${summary.kanaMasteredCount} ตัว` : "พร้อมเริ่ม",
    },
    {
      num: "Phase 2",
      title: "คลังสมอง FSRS-7 & ผันกริยา",
      desc: "เรียนคันจิแบบแยกชิ้นส่วน (Radicals), ศัพท์แกนกลาง พร้อม Pitch Accent และฝึกผันกริยาอัตโนมัติ",
      href: "/srs",
      icon: Brain,
      color: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
      metric: summary
        ? `เรียนแล้ว ${summary.learnedCount}/${summary.totalCards} ใบ`
        : "กำลังโหลด...",
    },
    {
      num: "Phase 3",
      title: "Immersion Reader & Sentence Mining",
      desc: "อ่านเนื้อหา i+1 ตัดคำด้วย Kuromoji ซ่อน Furigana เฉพาะคำที่รู้แล้ว และกด Mine ประโยคลง FSRS",
      href: "/reader",
      icon: BookOpen,
      color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      metric: "Kuromoji + Smart Furigana",
    },
    {
      num: "Phase 4",
      title: "Shadowing & คู่สนทนา AI Kaiwa",
      desc: "อัดเสียงพูดเทียบเจ้าของภาษา และฝึกคุยสถานการณ์จริงพร้อมแก้ประโยคให้เป็นธรรมชาติแบบคนญี่ปุ่น",
      href: "/kaiwa",
      icon: MessageCircle,
      color: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
      metric: "Voice + Naturalness Coach",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Premium Japanese Seigaiha Study Hub Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#162947] via-[#223e6d] to-[#6b2737] bg-seigaiha text-white p-6 sm:p-7 shadow-lg animate-fade-up">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left: Greeting + Rank + XP Progress + Actions */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs border border-white/20">
                <CrestSealIcon className="w-3.5 h-3.5 text-amber-300" />
                <span>
                  Lv.{xpStats.currentRank.level} &bull; {xpStats.currentRank.titleJp} (
                  {xpStats.currentRank.titleTh})
                </span>
              </span>
              {settings?.learnerLevel && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-200 border border-amber-300/30">
                  เป้าหมาย {settings.learnerLevel}
                </span>
              )}
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug">
                <span className="font-jp-serif text-amber-200 mr-2">{greeting.jp}</span>
                {accountName ? `คุณ${accountName}` : greeting.th} &bull; พร้อมลุยวันนี้ไหม!
              </h1>
              <p className="text-xs sm:text-sm text-white/80 mt-1">
                ทุกการ์ดที่ทบทวน บท Minna และข้อสอบ JLPT จะเพิ่ม XP เพื่อเลื่อนขั้นจาก{" "}
                <span className="font-jp">初心者</span> สู่ระดับ{" "}
                <span className="font-jp">師範</span>
              </p>
            </div>

            {/* XP Bar */}
            <div className="rounded-2xl bg-black/20 border border-white/15 p-3.5 space-y-2 backdrop-blur-xs">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-amber-200">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{xpStats.totalXp.toLocaleString()} XP สะสม</span>
                </span>
                <span className="text-white/75 font-mono text-[11px]">
                  {xpStats.nextRank
                    ? `อีก ${xpStats.xpToNextLevel.toLocaleString()} XP -> ${xpStats.nextRank.titleJp}`
                    : "สูงสุดระดับ 師範 แล้ว!"}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-white/15 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${xpStats.currentRank.gradientClass} transition-all duration-700`}
                  style={{ width: `${xpStats.progressPct}%` }}
                />
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Link
                href="/srs"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-rose-500 text-slate-950 font-bold text-xs sm:text-sm shadow-md hover:brightness-105 transition-all hover:-translate-y-0.5"
              >
                <FlashcardDeckIcon className="w-4 h-4" />
                <span>
                  ทบทวน FSRS{summary && summary.dueCount > 0 ? ` (${summary.dueCount})` : ""}
                </span>
              </Link>
              <Link
                href="/minna"
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/12 hover:bg-white/20 border border-white/20 text-xs sm:text-sm font-medium transition-colors"
              >
                <BookMarked className="w-4 h-4" />
                <span>Minna 50 บท</span>
              </Link>
              <Link
                href="/jlpt"
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/12 hover:bg-white/20 border border-white/20 text-xs sm:text-sm font-medium transition-colors"
              >
                <Award className="w-4 h-4 text-amber-300" />
                <span>ข้อสอบ JLPT</span>
              </Link>
              <Link
                href="/kaiwa"
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/12 hover:bg-white/20 border border-white/20 text-xs sm:text-sm font-medium transition-colors"
              >
                <Mic className="w-4 h-4 text-rose-300" />
                <span>AI Kaiwa</span>
              </Link>
            </div>
          </div>

          {/* Right: Daily Goal Ring + Kotoba of the Day */}
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3.5">
            <div className="rounded-2xl bg-white/10 border border-white/15 p-4 flex items-center gap-4 backdrop-blur-xs">
              <DailyGoalRing
                current={summary?.todayReviews ?? 0}
                target={studyPlan?.reviewTargetCount ?? 25}
              />
              <div className="space-y-1 min-w-0">
                <div className="text-xs font-semibold text-amber-200 uppercase tracking-wider">
                  Daily Goal Today
                </div>
                <div className="text-sm font-bold">
                  {(summary?.todayReviews ?? 0) >= (studyPlan?.reviewTargetCount ?? 25)
                    ? "ทำเป้ารายวันครบแล้ว!"
                    : `เหลืออีก ${Math.max(
                        0,
                        (studyPlan?.reviewTargetCount ?? 25) - (summary?.todayReviews ?? 0)
                      )} ครั้ง`}
                </div>
                <div className="text-xs text-white/75">
                  Streak ต่อเนื่อง {summary?.streak ?? 0} วัน • แผน{" "}
                  {studyPlan?.dailyMinutes ?? 20} นาที/วัน
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white/10 border border-white/15 p-4 space-y-2 backdrop-blur-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-amber-200 uppercase tracking-wider">
                  Kotoba ประจำวัน &bull; {dailyWord.jlpt}
                </span>
                <div className="flex items-center gap-1.5">
                  <SpeakButton text={dailyWord.word} />
                  <button
                    type="button"
                    disabled={dailyWordAlreadyInDeck}
                    onClick={() => void handleMineDailyWord()}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 disabled:opacity-75 text-[11px] font-semibold cursor-pointer"
                  >
                    {dailyWordAlreadyInDeck ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-300" />
                        <span>ในคลัง</span>
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-3 h-3 text-amber-300" />
                        <span>+ FSRS</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-jp text-xl font-bold">{dailyWord.word}</span>
                <span className="font-jp text-xs text-amber-200">{dailyWord.reading}</span>
                <span className="text-xs text-white/90 font-medium">
                  — {dailyWord.meaningTh}
                </span>
              </div>
              <div className="text-[11px] text-white/75 truncate font-jp">
                {dailyWord.exampleSentence}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Grid (Color-coded Accents) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="studio-card animate-fade-up stagger-1 rounded-2xl border border-border border-t-2 border-t-rose-500 bg-surface/95 backdrop-blur-xs p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-foreground/65 mb-1.5">
            <span>รอทบทวนวันนี้ (Due)</span>
            <span className="w-7 h-7 rounded-lg bg-rose-500/12 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Target className="w-4 h-4" strokeWidth={1.7} />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-rose-600 dark:text-rose-400">
            {summary ? summary.dueCount : "–"}
          </div>
          <div className="text-xs text-foreground/60 mt-1">
            การ์ดใหม่พร้อมเรียน {summary ? summary.newCount : "–"} ใบ
          </div>
        </div>

        <div className="studio-card animate-fade-up stagger-2 rounded-2xl border border-border border-t-2 border-t-emerald-500 bg-surface/95 backdrop-blur-xs p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-foreground/65 mb-1.5">
            <span>ทบทวนวันนี้</span>
            <span className="w-7 h-7 rounded-lg bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" strokeWidth={1.7} />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {summary ? summary.todayReviews : "–"}
          </div>
          <div className="text-xs text-foreground/60 mt-1">
            จำได้คล่องแล้ว {summary ? summary.masteredCount : "–"} ใบ
          </div>
        </div>

        <div className="studio-card animate-fade-up stagger-3 rounded-2xl border border-border border-t-2 border-t-indigo-500 bg-surface/95 backdrop-blur-xs p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-foreground/65 mb-1.5">
            <span>คำ/คันจิที่เคยเรียน</span>
            <span className="w-7 h-7 rounded-lg bg-indigo-500/12 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Brain className="w-4 h-4" strokeWidth={1.7} />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-indigo-600 dark:text-indigo-400">
            {summary ? summary.learnedCount : "–"}
          </div>
          <div className="text-xs text-foreground/60 mt-1">
            จากคลังทั้งหมด {summary ? summary.totalCards : "–"} ใบ
          </div>
        </div>

        <div className="studio-card animate-fade-up stagger-4 rounded-2xl border border-border border-t-2 border-t-amber-500 bg-surface/95 backdrop-blur-xs p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-foreground/65 mb-1.5">
            <span>ความต่อเนื่อง (Streak)</span>
            <span className="w-7 h-7 rounded-lg bg-amber-500/12 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Flame className="w-4 h-4" strokeWidth={1.7} />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400">
            {summary ? `${summary.streak} วัน` : "–"}
          </div>
          <div className="text-xs text-foreground/60 mt-1 flex items-center justify-between gap-1">
            <span>Kana แม่น {summary ? summary.kanaMasteredCount : "–"} ตัว</span>
            {settings?.learnerLevel && (
              <span
                className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${getJlptLevelBadgeStyle(
                  settings.learnerLevel
                )}`}
              >
                {settings.learnerLevel}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Personalized Daily Study Plan */}
      {studyPlan && (
        <section className="rounded-2xl border border-primary/25 bg-surface/95 p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  แผนการเรียนส่วนตัววันนี้ • {studyPlan.dailyMinutes} นาที/วัน • ระดับ{" "}
                  {studyPlan.learnerLevel} ({studyPlan.focusLabelTh})
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-foreground/70">
                <span>
                  เป้าทบทวนวันนี้:{" "}
                  <strong className="text-foreground">
                    {summary?.todayReviews ?? 0} / {studyPlan.reviewTargetCount}
                  </strong>{" "}
                  ครั้ง
                </span>
                <span>•</span>
                <span>การ์ดใหม่ {studyPlan.dailyNewCards} ใบ/วัน</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <Link
                href="/settings#reminder"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-background hover:bg-surface-muted text-xs font-medium"
              >
                <Bell className="w-3.5 h-3.5 text-primary" />
                <span>ตั้งเวลาเตือน / .ics</span>
              </Link>
              <button
                type="button"
                onClick={() => setShowOnboarding(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-background hover:bg-surface-muted text-xs font-medium cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                <span>ปรับระดับ &amp; เวลาเรียน</span>
              </button>
            </div>
          </div>

          <div className="w-full h-2 rounded-full bg-surface-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{
                width: `${Math.min(
                  100,
                  Math.round(
                    ((summary?.todayReviews ?? 0) /
                      Math.max(1, studyPlan.reviewTargetCount)) *
                    100
                  )
                )}%`,
              }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            {studyPlan.blocks.map((block, idx) => (
              <Link
                key={block.title}
                href={block.href}
                className="group rounded-xl bg-background hover:bg-surface-muted/70 p-4 border border-border transition-colors flex flex-col justify-between gap-2.5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-primary mb-1">
                    <span>
                      ช่วงที่ {idx + 1} · {block.minutes} นาที
                    </span>
                  </div>
                  <div className="font-bold text-sm">{block.title}</div>
                  <p className="text-foreground/70 text-xs leading-relaxed mt-1">
                    {block.detail}
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                  <span>{block.cta}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Memory Curve + Flashcard Schedule Widget */}
      <div className="animate-fade-up stagger-2">
        <MemoryCurvePanel
          cards={cards}
          nowMs={nowMs}
          desiredRetention={retentionTarget}
          onStartFlashcard={() => router.push("/srs")}
          startLabel="เปิดแฟลชการ์ดทบทวน"
          compact
        />
      </div>

      {/* 84-Day Study Activity Heatmap + 7-Day Review Forecast */}
      <StudyAnalyticsPanel analytics={analytics} />

      {/* AI Weakness Coach & JLPT Diagnostic */}
      <WeaknessCoachPanel
        cards={cards}
        reviewLogs={reviewLogs}
        jlptAttempts={jlptAttempts}
        settings={settings}
      />

      {/* Recommended Next Action */}
      <section className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-surface to-surface p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            ก้าวถัดไปที่แนะนำสำหรับคุณ
          </div>
          <h2 className="text-lg sm:text-xl font-bold">{nextAction.title}</h2>
          <p className="text-sm text-foreground/75 max-w-2xl">{nextAction.desc}</p>
        </div>
        <Link
          href={nextAction.href}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm shrink-0 hover:opacity-95 transition-opacity shadow-sm"
        >
          <span>{nextAction.cta}</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* Minna no Nihongo & JLPT Exam Highlights */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="studio-card rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <BookMarked className="w-4 h-4" strokeWidth={1.6} />
              <span>みんなの日本語 • Textbook Companion (ครบ 50 บท: เล่ม 1–2)</span>
            </div>
            <h2 className="text-base font-bold">
              อ่านหนังสือ Minna no Nihongo คู่กับเว็บ เก็บคำศัพท์ทุกบทลง FSRS
            </h2>
            <p className="text-xs text-foreground/75 leading-relaxed">
              สรุปรูปประโยค ข้อควรระวังคนไทย คำศัพท์ประจำบท พร้อมแฟลชการ์ด 3 มิติและโน้ตส่วนตัว
            </p>
          </div>
          <Link
            href="/minna"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-amber-500/40 bg-surface hover:bg-amber-500/10 text-xs sm:text-sm font-semibold self-start transition-colors"
          >
            <span>เปิดคู่มือ Minna</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="studio-card rounded-2xl border border-primary/30 bg-primary/5 p-5 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Award className="w-4 h-4" strokeWidth={1.6} />
              <span>JLPT Full Exam Simulator • N5 – N1 (หลายปี/หลายชุด)</span>
            </div>
            <h2 className="text-base font-bold">
              ตะลุยข้อสอบวัดระดับ N5 ถึง N1 ครบทุกพาร์ตพร้อมคลิกเก็บคำศัพท์
            </h2>
            <p className="text-xs text-foreground/75 leading-relaxed">
              มีปุ่มเปิด-ปิดคำอ่าน (Furigana) เผื่อลืมคันจิ คลิกคำไหนก็ได้เพื่อเพิ่มเข้าคลังคำศัพท์ FSRS ทันที
            </p>
          </div>
          <Link
            href="/jlpt"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-95 text-xs sm:text-sm font-semibold self-start transition-opacity"
          >
            <span>เข้าสู่สนามสอบ JLPT</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* 4-Phase Roadmap */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">เส้นทาง 4 ระยะสู่การพูดภาษาญี่ปุ่นอย่างเป็นธรรมชาติ</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {phases.map((phase) => {
            const Icon = phase.icon;
            return (
              <Link
                key={phase.num}
                href={phase.href}
                className="group rounded-2xl border border-border bg-surface p-5 hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${phase.color}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {phase.num}
                    </span>
                    <span className="text-xs text-foreground/60 font-medium">
                      {phase.metric}
                    </span>
                  </div>
                  <h3 className="text-base font-bold group-hover:text-primary transition-colors">
                    {phase.title}
                  </h3>
                  <p className="text-sm text-foreground/70 leading-relaxed">{phase.desc}</p>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                  <span>เข้าสู่บทเรียน</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Onboarding Modal for First Login / Plan Customization */}
      {settings && (
        <OnboardingModal
          open={showOnboarding}
          initialSettings={settings}
          userLabel={accountName}
          onClose={() => setShowOnboarding(false)}
          onSaved={(updated) => {
            setSettings(updated);
            setRetentionTarget(updated.desiredRetention);
            setShowOnboarding(false);
          }}
        />
      )}
    </div>
  );
}
