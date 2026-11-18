import { CORE_VOCAB } from "@/data/coreCurriculum";
import type { JlptAttemptRecord, JlptLevel, VocabEntry } from "@/types/learning";

export interface RankTier {
  level: number;
  titleJp: string;
  titleTh: string;
  kanjiSeal: string;
  minXp: number;
  badgeClass: string;
  gradientClass: string;
}

export const XP_RANK_TIERS: RankTier[] = [
  {
    level: 1,
    titleJp: "初級 I・初心者",
    titleTh: "ผู้เริ่มต้น",
    kanjiSeal: "初",
    minXp: 0,
    badgeClass:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    gradientClass: "from-emerald-500 to-teal-500",
  },
  {
    level: 2,
    titleJp: "初級 II・見習い",
    titleTh: "ผู้ฝึกหัด",
    kanjiSeal: "習",
    minXp: 300,
    badgeClass:
      "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    gradientClass: "from-sky-500 to-indigo-500",
  },
  {
    level: 3,
    titleJp: "中級 I・学習者",
    titleTh: "นักศึกษาภาษา",
    kanjiSeal: "学",
    minXp: 1000,
    badgeClass:
      "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    gradientClass: "from-indigo-500 to-violet-500",
  },
  {
    level: 4,
    titleJp: "中級 II・修行中",
    titleTh: "ผู้มุ่งมั่น",
    kanjiSeal: "修",
    minXp: 2500,
    badgeClass:
      "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
    gradientClass: "from-violet-500 to-rose-500",
  },
  {
    level: 5,
    titleJp: "上級 I・熟練者",
    titleTh: "ผู้เชี่ยวชาญ",
    kanjiSeal: "熟",
    minXp: 5500,
    badgeClass:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35",
    gradientClass: "from-amber-500 to-orange-500",
  },
  {
    level: 6,
    titleJp: "上級 II・達人",
    titleTh: "ปรมาจารย์",
    kanjiSeal: "達",
    minXp: 10000,
    badgeClass:
      "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35",
    gradientClass: "from-rose-500 to-amber-500",
  },
  {
    level: 7,
    titleJp: "師範・言の葉の匠",
    titleTh: "ครุผู้ทรงคุณ",
    kanjiSeal: "匠",
    minXp: 20000,
    badgeClass:
      "bg-gradient-to-r from-amber-500/20 to-rose-500/20 text-rose-700 dark:text-amber-300 border-amber-500/40",
    gradientClass: "from-amber-400 via-rose-500 to-indigo-600",
  },
];

export interface LearnerProgressStats {
  totalXp: number;
  currentRank: RankTier;
  nextRank: RankTier | null;
  progressPct: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
}

/** Computes XP & Japanese rank progression deterministically from real learning progress. */
export function computeLearnerProgressStats(params: {
  totalReviews: number;
  learnedCount: number;
  masteredCount: number;
  kanaMasteredCount: number;
  completedMinnaCount: number;
  jlptAttempts: Pick<JlptAttemptRecord, "passed">[];
  streak: number;
}): LearnerProgressStats {
  const passedCount = params.jlptAttempts.filter((a) => a.passed).length;
  const totalXp = Math.max(
    0,
    params.totalReviews * 10 +
      params.learnedCount * 15 +
      params.masteredCount * 25 +
      params.kanaMasteredCount * 15 +
      params.completedMinnaCount * 120 +
      params.jlptAttempts.length * 150 +
      passedCount * 200 +
      params.streak * 30
  );

  let currentRank = XP_RANK_TIERS[0];
  let nextRank: RankTier | null = XP_RANK_TIERS[1] ?? null;

  for (let i = 0; i < XP_RANK_TIERS.length; i++) {
    if (totalXp >= XP_RANK_TIERS[i].minXp) {
      currentRank = XP_RANK_TIERS[i];
      nextRank = XP_RANK_TIERS[i + 1] ?? null;
    }
  }

  if (!nextRank) {
    return {
      totalXp,
      currentRank,
      nextRank: null,
      progressPct: 100,
      xpIntoLevel: totalXp - currentRank.minXp,
      xpToNextLevel: 0,
    };
  }

  const span = Math.max(1, nextRank.minXp - currentRank.minXp);
  const xpIntoLevel = totalXp - currentRank.minXp;
  const progressPct = Math.min(100, Math.max(0, Math.round((xpIntoLevel / span) * 100)));

  return {
    totalXp,
    currentRank,
    nextRank,
    progressPct,
    xpIntoLevel,
    xpToNextLevel: Math.max(0, nextRank.minXp - totalXp),
  };
}

/** Deterministic Word-of-the-Day matched to the learner's target JLPT level. */
export function getDailyWordHighlight(
  dayKey: string,
  learnerLevel: JlptLevel
): VocabEntry {
  const pool = CORE_VOCAB.filter((v) => v.jlpt === learnerLevel);
  const source = pool.length > 0 ? pool : CORE_VOCAB;
  let hash = 0;
  for (let i = 0; i < dayKey.length; i++) {
    hash = (hash * 31 + dayKey.charCodeAt(i)) >>> 0;
  }
  return source[hash % source.length];
}

/** Distinct semantic badge classes per JLPT level so N5-N1 stand out at a glance. */
export function getJlptLevelBadgeStyle(level: JlptLevel): string {
  switch (level) {
    case "N5":
      return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    case "N4":
      return "bg-sky-500/12 text-sky-700 dark:text-sky-300 border-sky-500/30";
    case "N3":
      return "bg-violet-500/12 text-violet-700 dark:text-violet-300 border-violet-500/30";
    case "N2":
      return "bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/35";
    case "N1":
      return "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/35";
  }
}

export function getTimeGreetingJp(hour: number): { jp: string; th: string } {
  if (hour >= 5 && hour < 11) {
    return { jp: "おはようございます", th: "สวัสดีตอนเช้า" };
  }
  if (hour >= 11 && hour < 18) {
    return { jp: "こんにちは", th: "สวัสดีตอนบ่าย" };
  }
  return { jp: "こんばんは", th: "สวัสดีตอนค่ำ" };
}
