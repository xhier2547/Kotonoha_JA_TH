import { CORE_KANJI, CORE_VOCAB } from "@/data/coreCurriculum";
import { MINNA_LESSONS } from "@/data/minnaNoNihongo";
import type { KanjiEntry, VocabEntry } from "@/types/learning";

let cachedWordMap: Map<string, VocabEntry> | null = null;
let cachedReadingMap: Map<string, VocabEntry> | null = null;

function ensureVocabIndexes() {
  if (cachedWordMap && cachedReadingMap) {
    return { wordMap: cachedWordMap, readingMap: cachedReadingMap };
  }

  const wordMap = new Map<string, VocabEntry>();
  const readingMap = new Map<string, VocabEntry>();

  const register = (entry: VocabEntry) => {
    if (entry.word && !wordMap.has(entry.word)) {
      wordMap.set(entry.word, entry);
    }
    if (entry.reading && !readingMap.has(entry.reading)) {
      readingMap.set(entry.reading, entry);
    }
  };

  // Priority 1: CORE_VOCAB
  for (const v of CORE_VOCAB) {
    register(v);
  }

  // Priority 2: All 50 chapters of Minna no Nihongo vocabulary
  for (const lesson of MINNA_LESSONS) {
    for (let i = 0; i < lesson.vocab.length; i++) {
      const item = lesson.vocab[i];
      register({
        id: `minna-${lesson.lesson}-${i}`,
        word: item.word,
        reading: item.reading,
        pitch: 0,
        pos: item.pos,
        jlpt: lesson.jlpt,
        category: `Minna บทที่ ${lesson.lesson}`,
        meaningTh: item.meaningTh,
        meaningEn: item.meaningTh,
        exampleSentence: "",
        exampleReading: "",
        exampleMeaningTh: "",
        notes: item.note,
      });
    }
  }

  // Priority 3: Kanji word examples (covers common adjectives/nouns like 小さい, 大きい)
  for (const k of CORE_KANJI) {
    for (let i = 0; i < k.examples.length; i++) {
      const ex = k.examples[i];
      register({
        id: `kanji-ex-${k.id}-${i}`,
        word: ex.word,
        reading: ex.reading,
        pitch: 0,
        pos: "คำศัพท์คันจิ",
        jlpt: k.jlpt,
        category: `Kanji ${k.kanji}`,
        meaningTh: ex.meaningTh,
        meaningEn: ex.meaningTh,
        exampleSentence: "",
        exampleReading: "",
        exampleMeaningTh: "",
      });
    }
  }

  cachedWordMap = wordMap;
  cachedReadingMap = readingMap;
  return { wordMap, readingMap };
}

/**
 * Matches a tokenized word surface/basic form/reading against local dictionaries
 * (CORE_VOCAB -> Minna 50 chapters -> CORE_KANJI examples).
 * Exact written-form matches always take priority over reading-only matches.
 */
export function findVocabMatch(
  surface: string,
  basicForm?: string,
  readingHiragana?: string
): VocabEntry | null {
  const candidates = [basicForm, surface, readingHiragana].filter(
    (s): s is string => Boolean(s && s.trim())
  );
  if (candidates.length === 0) return null;

  const { wordMap, readingMap } = ensureVocabIndexes();

  for (const c of candidates) {
    const exact = wordMap.get(c);
    if (exact) return exact;
  }

  for (const c of candidates) {
    const byReading = readingMap.get(c);
    if (byReading) return byReading;
  }

  return null;
}

/** Returns CORE_KANJI entries corresponding to kanji characters present in text. */
export function findKanjiMatches(text: string): KanjiEntry[] {
  if (!text) return [];
  const chars = Array.from(text);
  return CORE_KANJI.filter((k) => chars.includes(k.kanji));
}
