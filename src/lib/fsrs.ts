import {
  DefaultScheduler,
  Rating,
  type DefaultSchedulerCard,
  type DefaultScheduler as DefaultSchedulerType,
} from "ts-fsrs";
import type { SerializedFsrsCard } from "@/types/learning";

type SchedulerType = DefaultSchedulerType<"FSRS-7">;
type RawCard = DefaultSchedulerCard<"FSRS-7">;

let schedulerCache: { retention: number; instance: SchedulerType } | null = null;

export async function getFsrsScheduler(desiredRetention = 0.9): Promise<SchedulerType> {
  if (schedulerCache && Math.abs(schedulerCache.retention - desiredRetention) < 0.001) {
    return schedulerCache.instance;
  }
  const instance = await DefaultScheduler<"FSRS-7">({
    version: "FSRS-7",
    desiredRetention,
    enableFuzz: false,
  });
  schedulerCache = { retention: desiredRetention, instance };
  return instance;
}

export function serializeCard(card: RawCard): SerializedFsrsCard {
  return {
    stability: card.stability,
    stabilityFast: card.stabilityFast ?? 0,
    difficulty: card.difficulty,
    state: card.state,
    scheduleStatus: card.scheduleStatus,
    dueAt: card.dueAt.toISOString(),
    lastReviewAt: card.lastReviewAt ? card.lastReviewAt.toISOString() : null,
    cardId: String(card.cardId),
    reps: card.reps,
    lapses: card.lapses,
    scheduledDays: card.scheduledDays,
    learningStep: card.learningStep,
  };
}

export function deserializeCard(card: SerializedFsrsCard): RawCard {
  return {
    ...card,
    dueAt: new Date(card.dueAt),
    lastReviewAt: card.lastReviewAt ? new Date(card.lastReviewAt) : null,
  } as RawCard;
}

export async function createInitialFsrsCard(
  cardId: string,
  desiredRetention = 0.9,
  now = new Date()
): Promise<SerializedFsrsCard> {
  const scheduler = await getFsrsScheduler(desiredRetention);
  const card = scheduler.newCard({ cardId, now });
  return serializeCard(card);
}

export interface PreviewOption {
  rating: 1 | 2 | 3 | 4;
  labelTh: string;
  subLabel: string;
  intervalLabel: string;
  dueAt: Date;
}

export function formatIntervalTh(scheduledDays: number, dueAt: Date, now: Date): string {
  const diffMs = Math.max(0, dueAt.getTime() - now.getTime());
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 60) {
    return `${Math.max(1, diffMinutes)} นาที`;
  }
  const diffHours = diffMs / 3600000;
  if (diffHours < 24) {
    return `${Math.round(diffHours)} ชม.`;
  }
  const days = Math.max(1, Math.round(scheduledDays || diffHours / 24));
  if (days < 30) {
    return `${days} วัน`;
  }
  if (days < 365) {
    const months = (days / 30).toFixed(1).replace(/\.0$/, "");
    return `${months} เดือน`;
  }
  const years = (days / 365).toFixed(1).replace(/\.0$/, "");
  return `${years} ปี`;
}

export async function previewFsrsCard(
  serialized: SerializedFsrsCard,
  desiredRetention = 0.9,
  now = new Date()
): Promise<PreviewOption[]> {
  const scheduler = await getFsrsScheduler(desiredRetention);
  const raw = deserializeCard(serialized);
  const items = Array.from(scheduler.preview({ card: raw, now }));

  const meta: Record<number, { labelTh: string; subLabel: string }> = {
    [Rating.Again]: { labelTh: "จำไม่ได้", subLabel: "Again (1)" },
    [Rating.Hard]: { labelTh: "ยาก", subLabel: "Hard (2)" },
    [Rating.Good]: { labelTh: "จำได้", subLabel: "Good (3)" },
    [Rating.Easy]: { labelTh: "ง่ายมาก", subLabel: "Easy (4)" },
  };

  return items
    .filter((item) => item.grade >= 1 && item.grade <= 4)
    .map((item) => ({
      rating: item.grade as 1 | 2 | 3 | 4,
      labelTh: meta[item.grade]?.labelTh ?? "Review",
      subLabel: meta[item.grade]?.subLabel ?? String(item.grade),
      intervalLabel: formatIntervalTh(item.card.scheduledDays, item.card.dueAt, now),
      dueAt: item.card.dueAt,
    }));
}

export async function reviewFsrsCard(
  serialized: SerializedFsrsCard,
  rating: 1 | 2 | 3 | 4,
  desiredRetention = 0.9,
  now = new Date()
): Promise<{ updated: SerializedFsrsCard; scheduledDays: number; dueAtMs: number }> {
  const scheduler = await getFsrsScheduler(desiredRetention);
  const raw = deserializeCard(serialized);
  const result = scheduler.review({
    card: raw,
    now,
    grade: rating as 1 | 2 | 3 | 4,
  });
  const updated = serializeCard(result.card);
  return {
    updated,
    scheduledDays: result.card.scheduledDays,
    dueAtMs: result.card.dueAt.getTime(),
  };
}

// ============================================================
// Memory Curve (Ebbinghaus + FSRS Power-Law Retrievability)
// R(t, S) = (1 + t / (9 * S))^(-1)
// When t == S, Retrievability R drops precisely to 90% (0.90)
// ============================================================

export interface MemoryMilestone {
  day: number;
  stageTh: string;
  labelTh: string;
  descTh: string;
  expectedStabilityDays: number;
}

export const MEMORY_CURVE_MILESTONES: MemoryMilestone[] = [
  {
    day: 0,
    stageTh: "ครั้งที่ 1",
    labelTh: "เรียนครั้งแรก (Day 0)",
    descTh: "สมองเริ่มสร้างร่องรอยความจำระยะสั้น หากไม่ทวนเลย ความจำจะตกลงเร็วใน 24–48 ชม.",
    expectedStabilityDays: 0.9,
  },
  {
    day: 1,
    stageTh: "รอบ 1 วัน",
    labelTh: "ทบทวนหลัง 1 วัน",
    descTh: "ดึงความจำกลับก่อนตกเกณฑ์ 90% เส้นกราฟเริ่มชันน้อยลงและเก็บไว้ได้นานขึ้น",
    expectedStabilityDays: 2.2,
  },
  {
    day: 2,
    stageTh: "รอบ 2 วัน",
    labelTh: "ทบทวนอีก 2 วันถัดมา",
    descTh: "จุดเชื่อมความจำระยะสั้นสู่ระยะกลาง ค่า Stability เพิ่มขึ้นเป็น ~4–5 วัน",
    expectedStabilityDays: 5.0,
  },
  {
    day: 5,
    stageTh: "รอบ 5 วัน",
    labelTh: "ทบทวนหลังผ่านไป 5 วัน",
    descTh: "การนึกคำออกหลังเว้นช่วง 5 วันช่วยยืนยันความจำ ทำให้รอบถัดไปยืดเป็น ~2 สัปดาห์",
    expectedStabilityDays: 14.0,
  },
  {
    day: 14,
    stageTh: "รอบ 14 วัน",
    labelTh: "ทบทวนสัปดาห์ที่ 2",
    descTh: "คำศัพท์เข้าสู่ความจำระยะยาวอย่างมั่นคง ใช้เวลาแค่เสี้ยววินาทีในการนึกออก",
    expectedStabilityDays: 32.0,
  },
  {
    day: 30,
    stageTh: "รอบ 30+ วัน",
    labelTh: "ทบทวนรายเดือน",
    descTh: "กราฟการลืมแทบแบนราบ (90%+ นานหลายเดือน) พร้อมใช้งานจริงในการอ่านและพูด",
    expectedStabilityDays: 75.0,
  },
];

/**
 * FSRS Power-Law Forgetting Curve:
 * R(t) = (1 + t / (9 * S))^(-1)
 */
export function computeRetrievability(
  stabilityDays: number,
  elapsedDays: number
): number {
  if (stabilityDays <= 0) return elapsedDays <= 0 ? 1 : 0;
  const t = Math.max(0, elapsedDays);
  const r = Math.pow(1 + t / (9 * stabilityDays), -1);
  return Math.max(0, Math.min(1, r));
}

/**
 * Current estimated recall probability (0..1) for a serialized FSRS card.
 * Returns null if the card has never been reviewed yet.
 */
export function getCardRetrievability(
  card: SerializedFsrsCard,
  nowMs = Date.now()
): number | null {
  if (card.reps <= 0 || !card.lastReviewAt) return null;
  const lastMs = Date.parse(card.lastReviewAt);
  if (Number.isNaN(lastMs)) return null;
  const elapsedDays = Math.max(0, (nowMs - lastMs) / 86_400_000);
  const effectiveStability = Math.max(card.stability, 0.25);
  return computeRetrievability(effectiveStability, elapsedDays);
}

export interface CurvePoint {
  day: number;
  retention: number; // 0..100
}

export function buildSingleDecaySeries(
  stabilityDays: number,
  maxDays = 30,
  steps = 48
): CurvePoint[] {
  const s = Math.max(stabilityDays, 0.25);
  const points: CurvePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const day = (maxDays * i) / steps;
    points.push({
      day,
      retention: Math.round(computeRetrievability(s, day) * 1000) / 10,
    });
  }
  return points;
}

/**
 * Builds an illustrative multi-review Ebbinghaus/FSRS sawtooth curve across
 * Day 0 -> Day 1 -> Day 2 -> Day 5 -> Day 14 -> Day 30 showing memory jumps
 * back to ~100% and decays progressively slower after each spaced review.
 */
export function buildSpacedSawtoothSeries(maxDays = 32): {
  unreviewed: CurvePoint[];
  spaced: CurvePoint[];
  reviewDays: { day: number; stabilityAfter: number }[];
} {
  const unreviewed = buildSingleDecaySeries(0.95, maxDays, 64);

  const schedule: { start: number; end: number; stability: number }[] = [
    { start: 0, end: 1, stability: 1.0 },
    { start: 1, end: 3, stability: 2.1 },
    { start: 3, end: 8, stability: 5.0 },
    { start: 8, end: 22, stability: 14.0 },
    { start: 22, end: maxDays, stability: 34.0 },
  ];

  const spaced: CurvePoint[] = [];
  for (const seg of schedule) {
    const subSteps = 14;
    for (let i = 0; i <= subSteps; i++) {
      const day = seg.start + ((seg.end - seg.start) * i) / subSteps;
      const dt = day - seg.start;
      spaced.push({
        day,
        retention: Math.round(computeRetrievability(seg.stability, dt) * 1000) / 10,
      });
    }
  }

  return {
    unreviewed,
    spaced,
    reviewDays: [
      { day: 1, stabilityAfter: 2.1 },
      { day: 3, stabilityAfter: 5.0 },
      { day: 8, stabilityAfter: 14.0 },
      { day: 22, stabilityAfter: 34.0 },
    ],
  };
}
