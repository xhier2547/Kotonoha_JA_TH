import type {
  CardType,
  JlptAttemptRecord,
  JlptLevel,
  ReviewLogRecord,
  SrsCardRecord,
} from "@/types/learning";

export type JlptSectionKey =
  | "vocabGrammarReading"
  | "langKnowledge"
  | "reading"
  | "listening";

export interface HardCardSummary {
  id: string;
  front: string;
  reading: string;
  meaningTh: string;
  cardType: CardType;
  lapses: number;
  difficulty: number;
  stability: number;
  reps: number;
  tags: string[];
}

export interface WeakJlptSectionSummary {
  key: JlptSectionKey;
  labelTh: string;
  levelSample: JlptLevel;
  avgScore: number;
  maxScore: number;
  minPassScore: number;
  avgPct: number;
  attempts: number;
  status: "below_pass" | "needs_boost" | "solid";
}

export interface WeaknessAnalysis {
  totalReviewedCards: number;
  totalReviewLogs: number;
  againRatePct: number;
  hardestCards: HardCardSummary[];
  strugglingTags: { tag: string; count: number }[];
  weakJlptSections: WeakJlptSectionSummary[];
  latestJlptAttempt: JlptAttemptRecord | null;
  hasSufficientData: boolean;
  recommendedFocusTh: string;
}

const SECTION_META: Record<
  JlptSectionKey,
  { labelTh: string; maxScore: number; minPassScore: number }
> = {
  vocabGrammarReading: {
    labelTh: "คำศัพท์ ไวยากรณ์ และการอ่าน (N4/N5)",
    maxScore: 120,
    minPassScore: 38,
  },
  langKnowledge: {
    labelTh: "ความรู้ภาษา (คำศัพท์และไวยากรณ์ N1-N3)",
    maxScore: 60,
    minPassScore: 19,
  },
  reading: {
    labelTh: "การอ่านจับใจความ (読解 N1-N3)",
    maxScore: 60,
    minPassScore: 19,
  },
  listening: {
    labelTh: "การฟัง (聴解)",
    maxScore: 60,
    minPassScore: 19,
  },
};

/**
 * Analyze FSRS memory trouble spots and JLPT mock exam section performance.
 * Pure client/server-safe helper used both for offline diagnosis and AI Coach prompts.
 */
export function analyzeLearnerWeaknesses(params: {
  cards: SrsCardRecord[];
  reviewLogs: ReviewLogRecord[];
  jlptAttempts: JlptAttemptRecord[];
}): WeaknessAnalysis {
  const { cards, reviewLogs, jlptAttempts } = params;

  const reviewedCards = cards.filter((c) => c.fsrs.reps > 0);
  const againCount = reviewLogs.filter((l) => l.rating === 1).length;
  const againRatePct =
    reviewLogs.length > 0 ? Math.round((againCount / reviewLogs.length) * 100) : 0;

  const hardestCards: HardCardSummary[] = reviewedCards
    .filter(
      (c) =>
        c.fsrs.lapses > 0 ||
        c.fsrs.difficulty >= 5.5 ||
        (c.fsrs.reps >= 2 && c.fsrs.stability < 3)
    )
    .map((c) => ({
      card: c,
      riskScore:
        c.fsrs.lapses * 3 +
        c.fsrs.difficulty -
        Math.min(c.fsrs.stability, 10) * 0.5,
    }))
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8)
    .map(({ card }) => ({
      id: card.id,
      front: card.front,
      reading: card.reading,
      meaningTh: card.meaningTh,
      cardType: card.cardType,
      lapses: card.fsrs.lapses,
      difficulty: Number(card.fsrs.difficulty.toFixed(1)),
      stability: Number(card.fsrs.stability.toFixed(1)),
      reps: card.fsrs.reps,
      tags: card.tags,
    }));

  const tagCounts = new Map<string, number>();
  for (const card of hardestCards) {
    for (const tag of card.tags) {
      if (!tag) continue;
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const strugglingTags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const sortedAttempts = [...jlptAttempts].sort(
    (a, b) =>
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );
  const latestJlptAttempt = sortedAttempts[0] ?? null;

  const sectionBuckets = new Map<
    JlptSectionKey,
    { sum: number; count: number; levelSample: JlptLevel }
  >();

  for (const attempt of sortedAttempts) {
    const scores = attempt.sectionScores;
    const keys: JlptSectionKey[] = [
      "vocabGrammarReading",
      "langKnowledge",
      "reading",
      "listening",
    ];
    for (const key of keys) {
      const value = scores[key];
      if (typeof value !== "number") continue;
      const existing = sectionBuckets.get(key);
      if (existing) {
        existing.sum += value;
        existing.count += 1;
      } else {
        sectionBuckets.set(key, {
          sum: value,
          count: 1,
          levelSample: attempt.level,
        });
      }
    }
  }

  const weakJlptSections: WeakJlptSectionSummary[] = Array.from(
    sectionBuckets.entries()
  )
    .map(([key, bucket]) => {
      const meta = SECTION_META[key];
      const avgScore = Math.round(bucket.sum / bucket.count);
      const avgPct = Math.round((avgScore / meta.maxScore) * 100);
      const status: WeakJlptSectionSummary["status"] =
        avgScore < meta.minPassScore
          ? "below_pass"
          : avgPct < 60
            ? "needs_boost"
            : "solid";
      return {
        key,
        labelTh: meta.labelTh,
        levelSample: bucket.levelSample,
        avgScore,
        maxScore: meta.maxScore,
        minPassScore: meta.minPassScore,
        avgPct,
        attempts: bucket.count,
        status,
      };
    })
    .sort((a, b) => a.avgPct - b.avgPct);

  const hasSufficientData =
    hardestCards.length > 0 ||
    reviewLogs.length >= 5 ||
    sortedAttempts.length > 0;

  let recommendedFocusTh =
    "เริ่มทบทวนแฟลชการ์ด SRS หรือทำข้อสอบจำลอง JLPT อย่างน้อย 1 ชุด เพื่อให้ระบบวิเคราะห์จุดอ่อนเฉพาะบุคคลได้แม่นยำ";

  const lowestSection = weakJlptSections[0];
  if (lowestSection && lowestSection.status !== "solid") {
    const topCardHint = hardestCards[0]
      ? ` และคำศัพท์ที่ลืมบ่อยที่สุดคือ "${hardestCards[0].front}" (${hardestCards[0].meaningTh})`
      : "";
    recommendedFocusTh = `พาร์ต JLPT ที่ควรเร่งเสริมที่สุดคือ "${lowestSection.labelTh}" (เฉลี่ย ${lowestSection.avgScore}/${lowestSection.maxScore} คะแนน, ${lowestSection.avgPct}%)${topCardHint}`;
  } else if (hardestCards.length > 0) {
    const sampleWords = hardestCards
      .slice(0, 3)
      .map((c) => c.front)
      .join(", ");
    recommendedFocusTh = `พบคำ/ไวยากรณ์ที่ความคงจำลดลงเร็ว ${hardestCards.length} รายการ (อัตราการกด Again ${againRatePct}%) — แนะนำย้ำคำกลุ่ม ${sampleWords} ด้วยการแต่งประโยคและทบทวนสั้นๆ`;
  } else if (reviewLogs.length >= 5) {
    recommendedFocusTh = `ภาพรวมความจำอยู่ในเกณฑ์ดีมาก (อัตราการกด Again เพียง ${againRatePct}%) สามารถเพิ่มความท้าทายด้วยข้อสอบจำลอง JLPT หรืออ่านบทความเพิ่มคำศัพท์ใหม่ได้`;
  }

  return {
    totalReviewedCards: reviewedCards.length,
    totalReviewLogs: reviewLogs.length,
    againRatePct,
    hardestCards,
    strugglingTags,
    weakJlptSections,
    latestJlptAttempt,
    hasSufficientData,
    recommendedFocusTh,
  };
}
