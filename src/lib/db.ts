import Dexie, { type Table } from "dexie";
import type {
  AppSettings,
  CustomScenarioRecord,
  JlptAttemptRecord,
  JlptLevel,
  KaiwaHistoryRecord,
  KanaMasteryRecord,
  MinnaProgressRecord,
  QueuedShadowingRecord,
  ReviewLogRecord,
  SavedReadingPassage,
  SrsCardRecord,
  StoredKaiwaMessage,
} from "@/types/learning";
import { CORE_GRAMMAR, CORE_KANJI, CORE_VOCAB, GRADED_PASSAGES } from "@/data/coreCurriculum";
import { clearJlptLocalDrafts } from "@/lib/accountIsolation";
import { createInitialFsrsCard } from "@/lib/fsrs";

export const DEFAULT_SETTINGS: AppSettings = {
  id: "user_settings",
  desiredRetention: 0.9,
  dailyNewCards: 15,
  speechRate: 0.95,
  preferredVoiceName: "",
  furiganaMode: "unknown",
  aiProvider: "offline",
  apiKey: "",
  aiModel: "gemini-3.8-flash",
  learnerLevel: "N5",
  theme: "system",
  dailyMinutes: 20,
  studyGoalFocus: "balanced",
  onboardingCompleted: false,
};

class KotonohaDatabase extends Dexie {
  cards!: Table<SrsCardRecord, string>;
  reviewLogs!: Table<ReviewLogRecord, number>;
  settings!: Table<AppSettings, string>;
  kanaMastery!: Table<KanaMasteryRecord, string>;
  passages!: Table<SavedReadingPassage, string>;
  kaiwaHistory!: Table<KaiwaHistoryRecord, string>;
  customScenarios!: Table<CustomScenarioRecord, string>;
  shadowingQueue!: Table<QueuedShadowingRecord, string>;
  minnaProgress!: Table<MinnaProgressRecord, number>;
  jlptAttempts!: Table<JlptAttemptRecord, string>;

  constructor() {
    super("kotonoha_studio_db");
    this.version(1).stores({
      cards: "id, cardType, dueAtMs, front, reading",
      reviewLogs: "++id, cardId, dayKey, reviewedAt",
      settings: "id",
      kanaMastery: "char, script",
      passages: "id, level, createdAt",
    });
    this.version(2).stores({
      cards: "id, cardType, dueAtMs, front, reading",
      reviewLogs: "++id, cardId, dayKey, reviewedAt",
      settings: "id",
      kanaMastery: "char, script",
      passages: "id, level, createdAt",
      kaiwaHistory: "id, updatedAt",
      customScenarios: "id, createdAt",
      shadowingQueue: "id, createdAt",
    });
    this.version(3).stores({
      cards: "id, cardType, dueAtMs, front, reading",
      reviewLogs: "++id, cardId, dayKey, reviewedAt",
      settings: "id",
      kanaMastery: "char, script",
      passages: "id, level, createdAt",
      kaiwaHistory: "id, updatedAt",
      customScenarios: "id, createdAt",
      shadowingQueue: "id, createdAt",
      minnaProgress: "lesson, updatedAt",
    });
    this.version(4).stores({
      cards: "id, cardType, dueAtMs, front, reading",
      reviewLogs: "++id, cardId, dayKey, reviewedAt",
      settings: "id",
      kanaMastery: "char, script",
      passages: "id, level, createdAt",
      kaiwaHistory: "id, updatedAt",
      customScenarios: "id, createdAt",
      shadowingQueue: "id, createdAt",
      minnaProgress: "lesson, updatedAt",
      jlptAttempts: "id, examId, level, completedAt",
    });
  }
}

export const db = new KotonohaDatabase();

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (typeof window === "undefined") return;
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    const existingSettings = await db.settings.get("user_settings");
    if (!existingSettings) {
      await db.settings.put(DEFAULT_SETTINGS);
    }

    const existingCardIds = new Set(
      (await db.cards.toCollection().primaryKeys()).map(String)
    );
    const now = new Date();
    const cardsToInsert: SrsCardRecord[] = [];

    // Seed Core + Extra Vocabulary (incremental: only missing IDs)
    for (const v of CORE_VOCAB) {
      if (existingCardIds.has(v.id)) continue;
      const fsrs = await createInitialFsrsCard(v.id, 0.9, now);
      cardsToInsert.push({
        id: v.id,
        cardType: "vocab",
        front: v.word,
        reading: v.reading,
        meaningTh: v.meaningTh,
        meaningEn: v.meaningEn,
        pitch: v.pitch,
        visualKey: v.word,
        mnemonic: v.notes,
        exampleSentence: v.exampleSentence,
        exampleReading: v.exampleReading,
        exampleMeaningTh: v.exampleMeaningTh,
        tags: [v.jlpt, v.category, v.pos],
        createdAt: now.toISOString(),
        dueAtMs: new Date(fsrs.dueAt).getTime(),
        fsrs,
      });
    }

    // Seed Core + Extra Kanji
    for (const k of CORE_KANJI) {
      if (existingCardIds.has(k.id)) continue;
      const fsrs = await createInitialFsrsCard(k.id, 0.9, now);
      cardsToInsert.push({
        id: k.id,
        cardType: "kanji",
        front: k.kanji,
        reading: [...k.kunyomi, ...k.onyomi].join(" / "),
        meaningTh: k.meaningTh,
        meaningEn: k.meaningEn,
        visualKey: k.kanji,
        mnemonic: k.mnemonicTh,
        radicals: k.radicals,
        exampleSentence: k.examples[0]
          ? `${k.examples[0].word} (${k.examples[0].reading})`
          : undefined,
        exampleMeaningTh: k.examples[0]?.meaningTh,
        tags: [k.jlpt, "Kanji", `${k.strokes} ขีด`],
        createdAt: now.toISOString(),
        dueAtMs: new Date(fsrs.dueAt).getTime(),
        fsrs,
      });
    }

    // Seed Core + Extra Grammar
    for (const g of CORE_GRAMMAR) {
      if (existingCardIds.has(g.id)) continue;
      const fsrs = await createInitialFsrsCard(g.id, 0.9, now);
      cardsToInsert.push({
        id: g.id,
        cardType: "grammar",
        front: g.pattern,
        reading: g.reading,
        meaningTh: g.meaningTh,
        meaningEn: g.meaningEn,
        mnemonic: g.explanationTh,
        exampleSentence: g.examples[0]?.jp,
        exampleReading: g.examples[0]?.reading,
        exampleMeaningTh: g.examples[0]?.th,
        tags: [g.jlpt, "Grammar", g.structure],
        createdAt: now.toISOString(),
        dueAtMs: new Date(fsrs.dueAt).getTime(),
        fsrs,
      });
    }

    if (cardsToInsert.length > 0) {
      await db.cards.bulkPut(cardsToInsert);
    }

    const existingPassageIds = new Set(
      (await db.passages.toCollection().primaryKeys()).map(String)
    );
    const missingPassages = GRADED_PASSAGES.filter((p) => !existingPassageIds.has(p.id));
    if (missingPassages.length > 0) {
      await db.passages.bulkPut(missingPassages);
    }
  })();

  return seedPromise;
}

export async function getAppSettings(): Promise<AppSettings> {
  await ensureSeeded();
  const s = await db.settings.get("user_settings");
  if (!s) return DEFAULT_SETTINGS;
  const normalized: AppSettings = { ...DEFAULT_SETTINGS, ...s };
  if (
    normalized.aiProvider === "gemini" &&
    (!normalized.aiModel || normalized.aiModel === "gemini-2.5-flash")
  ) {
    const migrated = { ...normalized, aiModel: "gemini-3.8-flash" };
    await db.settings.put(migrated);
    return migrated;
  }
  return normalized;
}

export const DB_MUTATED_EVENT = "kotonoha-db-mutated";

export function emitDbMutated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DB_MUTATED_EVENT));
  }
}

export async function saveAppSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettings();
  const updated: AppSettings = { ...current, ...partial, id: "user_settings" };
  await db.settings.put(updated);
  emitDbMutated();
  return updated;
}

export function getLocalDayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function mineCardToSrs(params: {
  front: string;
  reading: string;
  meaningTh: string;
  meaningEn?: string;
  cardType?: "vocab" | "sentence" | "kanji" | "grammar";
  pitch?: number;
  imageDataUrl?: string;
  visualKey?: string;
  exampleSentence?: string;
  exampleReading?: string;
  exampleMeaningTh?: string;
  mnemonic?: string;
  tags?: string[];
}): Promise<{ created: boolean; card: SrsCardRecord }> {
  await ensureSeeded();
  const existing = await db.cards.where("front").equals(params.front).first();
  if (existing) {
    if (params.imageDataUrl && !existing.imageDataUrl) {
      await db.cards.update(existing.id, { imageDataUrl: params.imageDataUrl });
      return { created: false, card: { ...existing, imageDataUrl: params.imageDataUrl } };
    }
    return { created: false, card: existing };
  }

  const settings = await getAppSettings();
  const now = new Date();
  const id = `mined-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const fsrs = await createInitialFsrsCard(id, settings.desiredRetention, now);

  const newCard: SrsCardRecord = {
    id,
    cardType: params.cardType ?? "sentence",
    front: params.front,
    reading: params.reading,
    meaningTh: params.meaningTh,
    meaningEn: params.meaningEn ?? "",
    pitch: params.pitch,
    imageDataUrl: params.imageDataUrl,
    visualKey: params.visualKey ?? params.front,
    mnemonic: params.mnemonic,
    exampleSentence: params.exampleSentence,
    exampleReading: params.exampleReading,
    exampleMeaningTh: params.exampleMeaningTh,
    tags: params.tags ?? ["Mined"],
    createdAt: now.toISOString(),
    dueAtMs: new Date(fsrs.dueAt).getTime(),
    fsrs,
  };

  await db.cards.put(newCard);
  emitDbMutated();
  return { created: true, card: newCard };
}

export async function updateCardImage(cardId: string, imageDataUrl?: string): Promise<void> {
  await ensureSeeded();
  await db.cards.update(cardId, { imageDataUrl });
  emitDbMutated();
}

export async function getLearningSummary() {
  await ensureSeeded();
  const nowMs = Date.now();
  const allCards = await db.cards.toArray();
  const logs = await db.reviewLogs.toArray();
  const kanaList = await db.kanaMastery.toArray();

  const dueCards = allCards.filter((c) => c.fsrs.reps > 0 && c.dueAtMs <= nowMs);
  const newCards = allCards.filter((c) => c.fsrs.reps === 0);
  const masteredCards = allCards.filter(
    (c) => c.fsrs.reps > 0 && c.fsrs.scheduledDays >= 7
  );
  const knownFronts = new Set(
    allCards.filter((c) => c.fsrs.reps > 0).map((c) => c.front)
  );

  const todayKey = getLocalDayKey();
  const todayReviews = logs.filter((l) => l.dayKey === todayKey).length;

  // Calculate streak
  const daySet = new Set(logs.map((l) => l.dayKey));
  let streak = 0;
  const cursor = new Date();
  if (!daySet.has(getLocalDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (daySet.has(getLocalDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const kanaMasteredCount = kanaList.filter(
    (k) => k.attempts >= 2 && k.correct / k.attempts >= 0.75
  ).length;

  return {
    totalCards: allCards.length,
    dueCount: dueCards.length,
    newCount: newCards.length,
    learnedCount: allCards.filter((c) => c.fsrs.reps > 0).length,
    masteredCount: masteredCards.length,
    todayReviews,
    streak,
    kanaMasteredCount,
    knownFronts,
  };
}

export interface DatabaseSnapshot {
  exportedAt: string;
  version: number;
  cards: SrsCardRecord[];
  reviewLogs: ReviewLogRecord[];
  settings: AppSettings[];
  kanaMastery: KanaMasteryRecord[];
  passages: SavedReadingPassage[];
  kaiwaHistory: KaiwaHistoryRecord[];
  customScenarios: CustomScenarioRecord[];
  shadowingQueue: QueuedShadowingRecord[];
  minnaProgress: MinnaProgressRecord[];
  jlptAttempts: JlptAttemptRecord[];
}

export async function exportDatabaseSnapshot(options?: {
  stripSecrets?: boolean;
}): Promise<DatabaseSnapshot> {
  await ensureSeeded();
  const [
    cards,
    reviewLogs,
    settings,
    kanaMastery,
    passages,
    kaiwaHistory,
    customScenarios,
    shadowingQueue,
    minnaProgress,
    jlptAttempts,
  ] = await Promise.all([
    db.cards.toArray(),
    db.reviewLogs.toArray(),
    db.settings.toArray(),
    db.kanaMastery.toArray(),
    db.passages.toArray(),
    db.kaiwaHistory.toArray(),
    db.customScenarios.toArray(),
    db.shadowingQueue.toArray(),
    db.minnaProgress.toArray(),
    db.jlptAttempts.toArray(),
  ]);

  const cleanSettings = options?.stripSecrets
    ? settings.map((s) => ({ ...s, apiKey: "" }))
    : settings;

  return {
    exportedAt: new Date().toISOString(),
    version: 4,
    cards,
    reviewLogs,
    settings: cleanSettings,
    kanaMastery,
    passages,
    kaiwaHistory,
    customScenarios,
    shadowingQueue,
    minnaProgress,
    jlptAttempts,
  };
}

export async function exportDatabaseJson(): Promise<string> {
  const snapshot = await exportDatabaseSnapshot();
  return JSON.stringify(snapshot, null, 2);
}

export async function importDatabaseSnapshot(
  parsed: Partial<DatabaseSnapshot>,
  options?: { preserveLocalApiKey?: boolean }
): Promise<{
  cards: number;
  reviewLogs: number;
  minnaLessons: number;
  jlptAttempts: number;
}> {
  if (!parsed || !Array.isArray(parsed.cards)) {
    throw new Error("รูปแบบไฟล์ Backup ไม่ถูกต้อง");
  }

  let incomingSettings = Array.isArray(parsed.settings) ? parsed.settings : [];
  if (options?.preserveLocalApiKey && incomingSettings.length > 0) {
    const localSettings = await db.settings.get("user_settings");
    if (localSettings?.apiKey) {
      incomingSettings = incomingSettings.map((s) =>
        s.id === "user_settings" && !s.apiKey ? { ...s, apiKey: localSettings.apiKey } : s
      );
    }
  }

  await db.transaction(
    "rw",
    [
      db.cards,
      db.reviewLogs,
      db.settings,
      db.kanaMastery,
      db.passages,
      db.kaiwaHistory,
      db.customScenarios,
      db.shadowingQueue,
      db.minnaProgress,
      db.jlptAttempts,
    ],
    async () => {
      await db.cards.clear();
      await db.reviewLogs.clear();
      await db.kanaMastery.clear();
      await db.passages.clear();
      await db.kaiwaHistory.clear();
      await db.customScenarios.clear();
      await db.shadowingQueue.clear();
      await db.minnaProgress.clear();
      await db.jlptAttempts.clear();

      if (parsed.cards?.length) await db.cards.bulkPut(parsed.cards);
      if (parsed.reviewLogs?.length) await db.reviewLogs.bulkPut(parsed.reviewLogs);
      if (incomingSettings.length) await db.settings.bulkPut(incomingSettings);
      if (parsed.kanaMastery?.length) await db.kanaMastery.bulkPut(parsed.kanaMastery);
      if (parsed.passages?.length) await db.passages.bulkPut(parsed.passages);
      if (Array.isArray(parsed.kaiwaHistory) && parsed.kaiwaHistory.length) {
        await db.kaiwaHistory.bulkPut(parsed.kaiwaHistory);
      }
      if (Array.isArray(parsed.customScenarios) && parsed.customScenarios.length) {
        await db.customScenarios.bulkPut(parsed.customScenarios);
      }
      if (Array.isArray(parsed.shadowingQueue) && parsed.shadowingQueue.length) {
        await db.shadowingQueue.bulkPut(parsed.shadowingQueue);
      }
      if (Array.isArray(parsed.minnaProgress) && parsed.minnaProgress.length) {
        await db.minnaProgress.bulkPut(parsed.minnaProgress);
      }
      if (Array.isArray(parsed.jlptAttempts) && parsed.jlptAttempts.length) {
        await db.jlptAttempts.bulkPut(parsed.jlptAttempts);
      }
    }
  );
  return {
    cards: parsed.cards?.length ?? 0,
    reviewLogs: parsed.reviewLogs?.length ?? 0,
    minnaLessons: Array.isArray(parsed.minnaProgress) ? parsed.minnaProgress.length : 0,
    jlptAttempts: Array.isArray(parsed.jlptAttempts) ? parsed.jlptAttempts.length : 0,
  };
}

export async function importDatabaseJson(jsonText: string) {
  const parsed = JSON.parse(jsonText) as Partial<DatabaseSnapshot>;
  return importDatabaseSnapshot(parsed);
}

/** Wipes all user learning tables and re-seeds clean starter content for Guest/account switch. */
export async function resetLocalStudyData(options?: {
  preserveApiKey?: boolean;
}): Promise<void> {
  const previousSettings = options?.preserveApiKey
    ? await db.settings.get("user_settings")
    : undefined;

  await db.transaction(
    "rw",
    [
      db.cards,
      db.reviewLogs,
      db.settings,
      db.kanaMastery,
      db.passages,
      db.kaiwaHistory,
      db.customScenarios,
      db.shadowingQueue,
      db.minnaProgress,
      db.jlptAttempts,
    ],
    async () => {
      await db.cards.clear();
      await db.reviewLogs.clear();
      await db.settings.clear();
      await db.kanaMastery.clear();
      await db.passages.clear();
      await db.kaiwaHistory.clear();
      await db.customScenarios.clear();
      await db.shadowingQueue.clear();
      await db.minnaProgress.clear();
      await db.jlptAttempts.clear();
    }
  );

  seedPromise = null;
  await ensureSeeded();

  if (options?.preserveApiKey && previousSettings) {
    await db.settings.put({
      ...DEFAULT_SETTINGS,
      aiProvider: previousSettings.aiProvider,
      apiKey: previousSettings.apiKey,
      aiModel: previousSettings.aiModel,
      theme: previousSettings.theme ?? DEFAULT_SETTINGS.theme,
    });
  }

  clearJlptLocalDrafts();
}

export async function getKaiwaHistory(scenarioId: string): Promise<StoredKaiwaMessage[]> {
  await ensureSeeded();
  const record = await db.kaiwaHistory.get(scenarioId);
  return record?.messages ?? [];
}

export async function saveKaiwaHistory(
  scenarioId: string,
  messages: StoredKaiwaMessage[]
): Promise<void> {
  await ensureSeeded();
  await db.kaiwaHistory.put({
    id: scenarioId,
    messages: messages.slice(-60),
    updatedAt: new Date().toISOString(),
  });
}

export async function clearKaiwaHistory(scenarioId: string): Promise<void> {
  await ensureSeeded();
  await db.kaiwaHistory.delete(scenarioId);
}

export async function getCustomScenarios(): Promise<CustomScenarioRecord[]> {
  await ensureSeeded();
  return db.customScenarios.orderBy("createdAt").reverse().toArray();
}

export async function saveCustomScenario(
  scenario: Omit<CustomScenarioRecord, "id" | "createdAt"> & { id?: string }
): Promise<CustomScenarioRecord> {
  await ensureSeeded();
  const record: CustomScenarioRecord = {
    ...scenario,
    id: scenario.id ?? `custom-sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  await db.customScenarios.put(record);
  return record;
}

export async function deleteCustomScenario(id: string): Promise<void> {
  await ensureSeeded();
  await db.customScenarios.delete(id);
}

export async function enqueueShadowing(
  item: Omit<QueuedShadowingRecord, "id" | "createdAt">
): Promise<QueuedShadowingRecord> {
  await ensureSeeded();
  const record: QueuedShadowingRecord = {
    ...item,
    id: `qsh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  await db.shadowingQueue.put(record);
  return record;
}

export async function getQueuedShadowing(): Promise<QueuedShadowingRecord[]> {
  await ensureSeeded();
  return db.shadowingQueue.orderBy("createdAt").reverse().toArray();
}

export async function deleteQueuedShadowing(id: string): Promise<void> {
  await ensureSeeded();
  await db.shadowingQueue.delete(id);
}

export async function getMinnaProgressMap(): Promise<
  Record<number, MinnaProgressRecord>
> {
  await ensureSeeded();
  const rows = await db.minnaProgress.toArray();
  const map: Record<number, MinnaProgressRecord> = {};
  for (const r of rows) {
    map[r.lesson] = r;
  }
  return map;
}

export async function saveMinnaLessonProgress(
  lesson: number,
  patch: { completed?: boolean; notes?: string }
): Promise<MinnaProgressRecord> {
  await ensureSeeded();
  const prev = await db.minnaProgress.get(lesson);
  const record: MinnaProgressRecord = {
    lesson,
    completed: patch.completed ?? prev?.completed ?? false,
    notes: patch.notes !== undefined ? patch.notes : prev?.notes,
    updatedAt: new Date().toISOString(),
  };
  await db.minnaProgress.put(record);
  emitDbMutated();
  return record;
}

export async function bulkMineMinnaVocab(
  lesson: number,
  items: { word: string; reading: string; meaningTh: string; pos?: string }[]
): Promise<{ added: number; total: number }> {
  await ensureSeeded();
  let added = 0;
  for (const item of items) {
    const res = await mineCardToSrs({
      front: item.word,
      reading: item.reading,
      meaningTh: item.meaningTh,
      visualKey: item.word,
      cardType: "vocab",
      tags: ["Minna", `บทที่ ${lesson}`, item.pos ?? "คำศัพท์"],
    });
    if (res.created) added += 1;
  }
  return { added, total: items.length };
}

/** Adds Minna lesson grammar patterns as `cardType: "grammar"` cards in FSRS. */
export async function bulkMineMinnaGrammar(
  lesson: number,
  jlpt: JlptLevel,
  grammarPoints: {
    pattern: string;
    structure: string;
    explanationTh: string;
    tipForThaiTh: string;
    examples: { jp: string; reading: string; th: string }[];
  }[]
): Promise<{ added: number; total: number }> {
  await ensureSeeded();
  let added = 0;
  for (const gp of grammarPoints) {
    const firstEx = gp.examples[0];
    const res = await mineCardToSrs({
      front: gp.pattern,
      reading: gp.structure,
      meaningTh: gp.explanationTh,
      mnemonic: gp.tipForThaiTh,
      exampleSentence: firstEx?.jp,
      exampleReading: firstEx?.reading,
      exampleMeaningTh: firstEx?.th,
      cardType: "grammar",
      tags: ["Minna", `บทที่ ${lesson}`, "Grammar", jlpt],
    });
    if (res.created) added += 1;
  }
  return { added, total: grammarPoints.length };
}

export async function getJlptAttempts(): Promise<JlptAttemptRecord[]> {
  await ensureSeeded();
  return db.jlptAttempts.orderBy("completedAt").reverse().toArray();
}

export async function saveJlptAttempt(
  attempt: Omit<JlptAttemptRecord, "id" | "completedAt">
): Promise<JlptAttemptRecord> {
  await ensureSeeded();
  const record: JlptAttemptRecord = {
    ...attempt,
    id: `jlpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    completedAt: new Date().toISOString(),
  };
  await db.jlptAttempts.put(record);
  emitDbMutated();
  return record;
}

export interface StudyAnalyticsData {
  heatmapDays: { dayKey: string; reviews: number; exams: number; total: number }[];
  forecast7Days: { dayKey: string; labelTh: string; count: number }[];
  totalReviewsAllTime: number;
  activeDaysCount: number;
}

export async function getStudyAnalytics(days = 84): Promise<StudyAnalyticsData> {
  await ensureSeeded();
  const [logs, cards, exams] = await Promise.all([
    db.reviewLogs.toArray(),
    db.cards.toArray(),
    db.jlptAttempts.toArray(),
  ]);

  const reviewByDay = new Map<string, number>();
  for (const log of logs) {
    reviewByDay.set(log.dayKey, (reviewByDay.get(log.dayKey) ?? 0) + 1);
  }

  const examsByDay = new Map<string, number>();
  for (const ex of exams) {
    const k = getLocalDayKey(new Date(ex.completedAt));
    examsByDay.set(k, (examsByDay.get(k) ?? 0) + 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const heatmapDays: StudyAnalyticsData["heatmapDays"] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = getLocalDayKey(d);
    const reviews = reviewByDay.get(key) ?? 0;
    const examCount = examsByDay.get(key) ?? 0;
    heatmapDays.push({
      dayKey: key,
      reviews,
      exams: examCount,
      total: reviews + examCount * 5,
    });
  }

  // 7-day FSRS due forecast (Today + next 6 days)
  const todayStartMs = today.getTime();
  const oneDayMs = 86_400_000;
  const forecastBuckets = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(todayStartMs + idx * oneDayMs);
    return {
      dayKey: getLocalDayKey(d),
      labelTh: idx === 0 ? "วันนี้" : idx === 1 ? "พรุ่งนี้" : `+${idx} วัน`,
      count: 0,
    };
  });

  for (const c of cards) {
    if (c.fsrs.reps <= 0) continue;
    const diffDays = Math.floor((c.dueAtMs - todayStartMs) / oneDayMs);
    const bucketIdx = diffDays <= 0 ? 0 : diffDays;
    if (bucketIdx < 7) {
      forecastBuckets[bucketIdx].count += 1;
    }
  }

  const activeDaysCount = heatmapDays.filter((h) => h.reviews > 0 || h.exams > 0).length;

  return {
    heatmapDays,
    forecast7Days: forecastBuckets,
    totalReviewsAllTime: logs.length,
    activeDaysCount,
  };
}
