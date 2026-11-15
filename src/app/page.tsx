"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Award,
  BookMarked,
  BookOpen,
  Brain,
  CheckCircle2,
  Flame,
  Languages,
  MessageCircle,
  Mic,
  Target,
} from "lucide-react";
import {
  db,
  getAppSettings,
  getJlptAttempts,
  getLearningSummary,
  getStudyAnalytics,
  type StudyAnalyticsData,
} from "@/lib/db";
import { MemoryCurvePanel } from "@/components/MemoryCurvePanel";
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

  useEffect(() => {
    let active = true;
    void (async () => {
      const [res, allCards, allLogs, attempts, loadedSettings, studyStats] =
        await Promise.all([
          getLearningSummary(),
          db.cards.toArray(),
          db.reviewLogs.toArray(),
          getJlptAttempts(),
          getAppSettings(),
          getStudyAnalytics(84),
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
      setSettings(loadedSettings);
      setAnalytics(studyStats);
      setRetentionTarget(loadedSettings.desiredRetention);
      setNowMs(Date.now());
    })();
    return () => {
      active = false;
    };
  }, []);

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
        desc: "การทบทวนตามเวลาที่ FSRS-7 คำนวณไว้ คือวิธีจำคำศัพท์ให้แม่นที่สุดโดยใช้เวลาน้อยที่สุด",
        href: "/srs",
        cta: "เริ่มทบทวน FSRS ทันที",
      };
    }
    if (summary.kanaMasteredCount < 25) {
      return {
        title: "เริ่มต้นที่รากฐาน: Kana & ระบบเสียง",
        desc: "ฝึกจำ Hiragana/Katakana ด้วยภาพจำและเกมพิมพ์ตอบเร็ว พร้อมเข้าใจ Pitch Accent ตั้งแต่วันแรก",
        href: "/kana",
        cta: "เข้าสู่ Kana Dojo",
      };
    }
    if (summary.learnedCount < 15) {
      return {
        title: "สะสมคลังคำศัพท์และคันจิแกนกลาง",
        desc: `ยังมีการ์ดใหม่อีก ${summary.newCount} ใบที่พร้อมให้เรียนรู้ พร้อมฝึกผันกริยาให้คล่องปาก`,
        href: "/srs",
        cta: "เรียนการ์ดใหม่ (FSRS)",
      };
    }
    return {
      title: "ฝึกอ่าน i+1 และฝึกพูดโต้ตอบธรรมชาติ",
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
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 animate-fade-up">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/15 mb-2">
            <CrestSealIcon className="w-3.5 h-3.5" />
            <span>Zero to Natural Japanese Fluency</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            สวัสดี! พร้อมฝึกภาษาญี่ปุ่นวันนี้หรือยังครับ{" "}
            <span className="font-jp-serif text-primary">頑張ろう</span>
          </h1>
          <p className="text-sm text-foreground/70 mt-1">
            ระบบฝึกส่วนตัวครบวงจร: ปูพื้นฐาน Kana &rarr; แฟลชการ์ดตาม Memory Curve &rarr; อ่าน <span className="font-mono">i+1</span> &rarr; พูดเป็นธรรมชาติ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/minna"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 text-sm font-medium transition-all hover:-translate-y-0.5"
          >
            <BookMarked className="w-4 h-4" strokeWidth={1.6} />
            <span>เรียนตามหนังสือ Minna</span>
          </Link>
          <Link
            href="/jlpt"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-surface hover:bg-surface-muted text-sm font-medium transition-all hover:-translate-y-0.5"
          >
            <Award className="w-4 h-4 text-primary" strokeWidth={1.6} />
            <span>ข้อสอบ JLPT N5–N1</span>
          </Link>
          <Link
            href="/shadowing"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-surface hover:bg-surface-muted text-sm font-medium transition-all hover:-translate-y-0.5"
          >
            <Mic className="w-4 h-4 text-accent" strokeWidth={1.6} />
            <span>ฝึก Shadowing</span>
          </Link>
          <Link
            href="/srs"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:opacity-95 transition-all hover:-translate-y-0.5"
          >
            <FlashcardDeckIcon className="w-4 h-4" />
            <span>
              ทบทวนแฟลชการ์ด{summary && summary.dueCount > 0 ? ` (${summary.dueCount})` : ""}
            </span>
          </Link>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="studio-card animate-fade-up stagger-1 rounded-2xl border border-border bg-surface/90 backdrop-blur-xs p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-foreground/60 mb-1">
            <span>รอทบทวนวันนี้ (Due)</span>
            <Target className="w-4 h-4 text-accent" strokeWidth={1.6} />
          </div>
          <div className="text-2xl sm:text-3xl font-bold">
            {summary ? summary.dueCount : "–"}
          </div>
          <div className="text-xs text-foreground/60 mt-1">
            การ์ดใหม่พร้อมเรียน {summary ? summary.newCount : "–"} ใบ
          </div>
        </div>

        <div className="studio-card animate-fade-up stagger-2 rounded-2xl border border-border bg-surface/90 backdrop-blur-xs p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-foreground/60 mb-1">
            <span>ทบทวนวันนี้</span>
            <CheckCircle2 className="w-4 h-4 text-matcha" strokeWidth={1.6} />
          </div>
          <div className="text-2xl sm:text-3xl font-bold">
            {summary ? summary.todayReviews : "–"}
          </div>
          <div className="text-xs text-foreground/60 mt-1">
            จำได้คล่องแล้ว {summary ? summary.masteredCount : "–"} ใบ
          </div>
        </div>

        <div className="studio-card animate-fade-up stagger-3 rounded-2xl border border-border bg-surface/90 backdrop-blur-xs p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-foreground/60 mb-1">
            <span>คำ/คันจิที่เคยเรียน</span>
            <Brain className="w-4 h-4 text-primary" strokeWidth={1.6} />
          </div>
          <div className="text-2xl sm:text-3xl font-bold">
            {summary ? summary.learnedCount : "–"}
          </div>
          <div className="text-xs text-foreground/60 mt-1">
            จากคลังทั้งหมด {summary ? summary.totalCards : "–"} ใบ
          </div>
        </div>

        <div className="studio-card animate-fade-up stagger-4 rounded-2xl border border-border bg-surface/90 backdrop-blur-xs p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-foreground/60 mb-1">
            <span>ความต่อเนื่อง (Streak)</span>
            <Flame className="w-4 h-4 text-gold" strokeWidth={1.6} />
          </div>
          <div className="text-2xl sm:text-3xl font-bold">
            {summary ? `${summary.streak} วัน` : "–"}
          </div>
          <div className="text-xs text-foreground/60 mt-1">
            Kana แม่น {summary ? summary.kanaMasteredCount : "–"} ตัว
          </div>
        </div>
      </section>

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

      {/* Study Routine Guide */}
      <section className="rounded-2xl border border-border bg-surface-muted/50 p-5 sm:p-6 space-y-3">
        <h2 className="text-base font-bold">ตารางฝึกประจำวันแนะนำ (วันละ 30–45 นาที)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl bg-surface p-4 border border-border">
            <div className="font-semibold text-primary mb-1">1. เช้า / ก่อนเริ่ม (10-15 นาที)</div>
            <p className="text-foreground/75 text-xs leading-relaxed">
              เคลียร์การ์ด FSRS ที่ค้างอยู่ + เรียนคำศัพท์/คันจิใหม่ 10-15 ใบ เพื่อรักษา Retention 90%
            </p>
          </div>
          <div className="rounded-xl bg-surface p-4 border border-border">
            <div className="font-semibold text-matcha mb-1">2. กลางวัน (10-15 นาที)</div>
            <p className="text-foreground/75 text-xs leading-relaxed">
              อ่านบทความ <span className="font-mono">i+1</span> ใน Immersion Reader ปิด Furigana คำที่รู้แล้ว และกด Mine ประโยคใหม่เข้าคลัง
            </p>
          </div>
          <div className="rounded-xl bg-surface p-4 border border-border">
            <div className="font-semibold text-accent mb-1">3. เย็น / ก่อนนอน (10-15 นาที)</div>
            <p className="text-foreground/75 text-xs leading-relaxed">
              ฝึกผันกริยา 2 นาที + Shadowing อัดเสียงเทียบเจ้าของภาษา + คุย Roleplay ใน AI Kaiwa
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
