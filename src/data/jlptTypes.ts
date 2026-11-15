import type { JlptLevel } from "@/types/learning";

export type JlptSectionKind = "vocab" | "grammar_reading" | "listening";

export type JlptScoringBucket =
  | "vocabGrammarReading" // N5, N4 combined (0-120)
  | "langKnowledge" // N3, N2, N1 (0-60)
  | "reading" // N3, N2, N1 (0-60)
  | "listening"; // All levels (0-60)

export interface JlptQuestion {
  id: string;
  number: number;
  promptJp: string;
  /** Audio script for listening questions (spoken with Japanese TTS + clickable after reveal) */
  listeningScriptJp?: string;
  /** True for 問題1 Kanji Reading so active Furigana hides the target word's reading during exam */
  isKanjiReadingTarget?: boolean;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanationTh: string;
}

export interface JlptMondaiGroup {
  id: string;
  section: JlptSectionKind;
  scoringBucket: JlptScoringBucket;
  mondaiTitleJp: string;
  instructionJp: string;
  instructionTh: string;
  passageTitleJp?: string;
  passageJp?: string;
  questions: JlptQuestion[];
}

export interface JlptExamPaper {
  id: string;
  level: JlptLevel;
  isFullLength?: boolean;
  yearLabel: string;
  titleTh: string;
  titleJp: string;
  subtitleTh: string;
  totalMinutes: number;
  sectionTimings: { labelTh: string; minutes: number }[];
  mondaiGroups: JlptMondaiGroup[];
}

export interface JlptLevelRule {
  level: JlptLevel;
  badgeColor: string;
  totalPass: number;
  totalMax: 180;
  totalMinutes: number;
  descriptionTh: string;
  sections: {
    bucket: JlptScoringBucket;
    labelTh: string;
    min: number;
    max: number;
  }[];
}

export const JLPT_LEVEL_RULES: Record<JlptLevel, JlptLevelRule> = {
  N5: {
    level: "N5",
    badgeColor: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
    totalPass: 80,
    totalMax: 180,
    totalMinutes: 90,
    descriptionTh: "ระดับพื้นฐาน เข้าใจฮิรางานะ คาตาคานะ คันจิพื้นฐาน ~100 ตัว และบทสนทนาในชีวิตประจำวัน",
    sections: [
      { bucket: "vocabGrammarReading", labelTh: "ตัวอักษร คำศัพท์ ไวยากรณ์ และการอ่าน", min: 38, max: 120 },
      { bucket: "listening", labelTh: "การฟัง (聴解)", min: 19, max: 60 },
    ],
  },
  N4: {
    level: "N4",
    badgeColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    totalPass: 90,
    totalMax: 180,
    totalMinutes: 115,
    descriptionTh: "ระดับต้นตอนปลาย อ่านบทความสั้นในชีวิตประจำวัน และเข้าใจบทสนทนาทั่วไปที่พูดค่อนข้างช้า",
    sections: [
      { bucket: "vocabGrammarReading", labelTh: "ตัวอักษร คำศัพท์ ไวยากรณ์ และการอ่าน", min: 38, max: 120 },
      { bucket: "listening", labelTh: "การฟัง (聴解)", min: 19, max: 60 },
    ],
  },
  N3: {
    level: "N3",
    badgeColor: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    totalPass: 95,
    totalMax: 180,
    totalMinutes: 140,
    descriptionTh: "ระดับกลาง เข้าใจหัวข้อข่าวและบทความทั่วไป จับใจความสนทนาที่พูดด้วยความเร็วใกล้เคียงธรรมชาติ",
    sections: [
      { bucket: "langKnowledge", labelTh: "ความรู้ภาษา (ตัวอักษร คำศัพท์ ไวยากรณ์)", min: 19, max: 60 },
      { bucket: "reading", labelTh: "การอ่าน (読解)", min: 19, max: 60 },
      { bucket: "listening", labelTh: "การฟัง (聴解)", min: 19, max: 60 },
    ],
  },
  N2: {
    level: "N2",
    badgeColor: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    totalPass: 90,
    totalMax: 180,
    totalMinutes: 155,
    descriptionTh: "ระดับกลาง-สูง อ่านบทความหนังสือพิมพ์ นิตยสาร คำวิจารณ์ และเข้าใจการสนทนาความเร็วปกติได้หลากหลายสถานการณ์",
    sections: [
      { bucket: "langKnowledge", labelTh: "ความรู้ภาษา (ตัวอักษร คำศัพท์ ไวยากรณ์)", min: 19, max: 60 },
      { bucket: "reading", labelTh: "การอ่าน (読解)", min: 19, max: 60 },
      { bucket: "listening", labelTh: "การฟัง (聴解)", min: 19, max: 60 },
    ],
  },
  N1: {
    level: "N1",
    badgeColor: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
    totalPass: 100,
    totalMax: 180,
    totalMinutes: 165,
    descriptionTh: "ระดับสูงสุด เข้าใจบทความเชิงนามธรรม วิจารณ์เชิงลึก วรรณกรรม และเข้าใจเสียงบรรยาย/โต้วาทีความเร็วธรรมชาติ",
    sections: [
      { bucket: "langKnowledge", labelTh: "ความรู้ภาษา (ตัวอักษร คำศัพท์ ไวยากรณ์)", min: 19, max: 60 },
      { bucket: "reading", labelTh: "การอ่าน (読解)", min: 19, max: 60 },
      { bucket: "listening", labelTh: "การฟัง (聴解)", min: 19, max: 60 },
    ],
  },
};

export interface JlptScoreReport {
  totalScaledScore: number;
  totalMax: 180;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  sectionResults: {
    bucket: JlptScoringBucket;
    labelTh: string;
    rawCorrect: number;
    rawTotal: number;
    scaledScore: number;
    minRequired: number;
    maxScore: number;
    sectionPassed: boolean;
  }[];
}

export function calculateJlptScores(
  exam: JlptExamPaper,
  answers: Record<string, number>
): JlptScoreReport {
  const rule = JLPT_LEVEL_RULES[exam.level];
  const counts: Record<JlptScoringBucket, { correct: number; total: number }> = {
    vocabGrammarReading: { correct: 0, total: 0 },
    langKnowledge: { correct: 0, total: 0 },
    reading: { correct: 0, total: 0 },
    listening: { correct: 0, total: 0 },
  };

  let correctCount = 0;
  let totalQuestions = 0;

  for (const group of exam.mondaiGroups) {
    // For N4/N5, combine langKnowledge/reading/vocabGrammarReading into vocabGrammarReading if tagged
    const bucket: JlptScoringBucket =
      (exam.level === "N5" || exam.level === "N4") &&
      group.scoringBucket !== "listening"
        ? "vocabGrammarReading"
        : group.scoringBucket;

    for (const q of group.questions) {
      totalQuestions += 1;
      counts[bucket].total += 1;
      if (answers[q.id] === q.correctIndex) {
        correctCount += 1;
        counts[bucket].correct += 1;
      }
    }
  }

  const sectionResults = rule.sections.map((sec) => {
    const raw = counts[sec.bucket];
    const scaled =
      raw.total > 0 ? Math.round((raw.correct / raw.total) * sec.max) : 0;
    return {
      bucket: sec.bucket,
      labelTh: sec.labelTh,
      rawCorrect: raw.correct,
      rawTotal: raw.total,
      scaledScore: scaled,
      minRequired: sec.min,
      maxScore: sec.max,
      sectionPassed: scaled >= sec.min,
    };
  });

  const totalScaledScore = sectionResults.reduce((acc, s) => acc + s.scaledScore, 0);
  const passed =
    totalScaledScore >= rule.totalPass &&
    sectionResults.every((s) => s.sectionPassed);

  return {
    totalScaledScore,
    totalMax: 180,
    passed,
    correctCount,
    totalQuestions,
    sectionResults,
  };
}
