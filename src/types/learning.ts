export type JlptLevel = "N5" | "N4" | "N3" | "N2" | "N1";

export type PitchType = "heiban" | "atamadaka" | "nakadaka" | "odaka";

export interface VocabEntry {
  id: string;
  word: string;
  reading: string; // Hiragana/Katakana
  pitch: number; // 0 = Heiban, 1 = Atamadaka, >1 = drop after mora N
  pos: string;
  jlpt: JlptLevel;
  category: string;
  meaningTh: string;
  meaningEn: string;
  exampleSentence: string;
  exampleReading: string;
  exampleMeaningTh: string;
  notes?: string;
}

export interface KanjiEntry {
  id: string;
  kanji: string;
  meaningTh: string;
  meaningEn: string;
  onyomi: string[];
  kunyomi: string[];
  radicals: string[];
  mnemonicTh: string;
  strokes: number;
  jlpt: JlptLevel;
  examples: { word: string; reading: string; meaningTh: string }[];
}

export interface GrammarEntry {
  id: string;
  pattern: string;
  reading: string;
  meaningTh: string;
  meaningEn: string;
  jlpt: JlptLevel;
  structure: string;
  explanationTh: string;
  examples: { jp: string; reading: string; th: string }[];
}

export interface SerializedFsrsCard {
  stability: number;
  stabilityFast: number;
  difficulty: number;
  state: number;
  scheduleStatus: "new" | "learning" | "review";
  dueAt: string; // ISO string
  lastReviewAt: string | null;
  cardId: string;
  reps: number;
  lapses: number;
  scheduledDays: number;
  learningStep: number;
}

export type CardType = "vocab" | "kanji" | "sentence" | "grammar";

export interface SrsCardRecord {
  id: string;
  cardType: CardType;
  front: string; // Word, Kanji, Sentence, or Grammar pattern
  reading: string;
  meaningTh: string;
  meaningEn: string;
  pitch?: number;
  mnemonic?: string;
  radicals?: string[];
  imageDataUrl?: string;
  visualKey?: string;
  exampleSentence?: string;
  exampleReading?: string;
  exampleMeaningTh?: string;
  tags: string[];
  createdAt: string;
  dueAtMs: number; // Indexed timestamp for due queries
  fsrs: SerializedFsrsCard;
}

export interface ReviewLogRecord {
  id?: number;
  cardId: string;
  rating: number; // 1=Again, 2=Hard, 3=Good, 4=Easy
  reviewedAt: string; // ISO
  dayKey: string; // YYYY-MM-DD
  scheduledDays: number;
}

export interface KanaMasteryRecord {
  char: string; // e.g. あ, ア
  script: "hiragana" | "katakana";
  attempts: number;
  correct: number;
  lastPracticedAt: string;
}

export interface SavedReadingPassage {
  id: string;
  title: string;
  level: JlptLevel;
  content: string;
  translationTh?: string;
  createdAt: string;
  isCustom?: boolean;
}

export type AiProvider = "offline" | "gemini" | "openai";

export type ThemePreference = "system" | "light" | "dark";

export interface AppSettings {
  id: "user_settings";
  desiredRetention: number;
  dailyNewCards: number;
  speechRate: number;
  preferredVoiceName: string;
  furiganaMode: "all" | "unknown" | "off";
  aiProvider: AiProvider;
  apiKey: string;
  aiModel: string;
  learnerLevel: JlptLevel;
  theme?: ThemePreference;
}

export interface TokenizedWord {
  surface: string;
  basicForm: string;
  readingHiragana: string;
  pos: string;
  posDetail: string;
  hasKanji: boolean;
  isContentWord: boolean;
}

export interface StoredKaiwaMessage {
  id: string;
  role: "user" | "assistant";
  textJp: string;
  reading?: string;
  textTh?: string;
  tokens?: TokenizedWord[];
  feedback?: {
    isNatural?: boolean;
    grammarFeedbackTh: string;
    naturalRewriteJp?: string;
    naturalRewriteReading?: string;
    tipTh?: string;
  };
}

export interface KaiwaHistoryRecord {
  id: string; // scenarioId
  messages: StoredKaiwaMessage[];
  updatedAt: string;
}

export interface CustomScenarioRecord {
  id: string;
  title: string;
  style: string;
  level: "N5" | "N4" | "N3";
  persona: string;
  openingJp: string;
  openingReading: string;
  openingTh: string;
  createdAt: string;
}

export interface QueuedShadowingRecord {
  id: string;
  title: string;
  level: "N5" | "N4" | "N3";
  style: "สุภาพ (丁寧語)" | "กันเอง (タメ口)";
  japanese: string;
  reading: string;
  meaningTh: string;
  nuanceTh: string;
  createdAt: string;
}

export interface MinnaProgressRecord {
  lesson: number;
  completed: boolean;
  notes?: string;
  updatedAt: string;
}

export interface JlptAttemptRecord {
  id: string;
  examId: string;
  level: JlptLevel;
  examTitle: string;
  totalScaledScore: number; // out of 180
  sectionScores: {
    vocabGrammarReading?: number; // N4/N5 (0-120)
    langKnowledge?: number; // N1-N3 (0-60)
    reading?: number; // N1-N3 (0-60)
    listening: number; // 0-60
  };
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  durationSec: number;
  completedAt: string;
}
