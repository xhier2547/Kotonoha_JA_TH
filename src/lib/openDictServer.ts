import fs from "node:fs";
import path from "node:path";
import { toHiragana } from "wanakana";
import type { JlptLevel } from "@/types/learning";
import type { CharacterStrokeOrder } from "@/data/strokeOrders";

/** Compact tuple stored in jmdict-common.json: [word, reading, meaningEn, pos] */
type JmdictTuple = [string, string, string, string];

export interface OpenJmdictEntry {
  word: string;
  reading: string;
  meaningEn: string;
  pos: string;
}

export interface OpenKanjidicEntry {
  kanji: string;
  jlpt: JlptLevel;
  strokes: number;
  grade: number | null;
  freq: number;
  onyomi: string[];
  kunyomi: string[];
  meaningEn: string;
}

export type OpenStrokeOrderResponse = CharacterStrokeOrder & {
  viewBox: number;
  source: "kanjivg";
};

type CompactStrokeTuple = [string, number, number];

const GENERATED_DIR = path.resolve(process.cwd(), "src/data/generated");

const gCache = globalThis as unknown as {
  __kotonohaJmdict?: JmdictTuple[];
  __kotonohaJmdictMap?: Map<string, OpenJmdictEntry>;
  __kotonohaKanjidic?: OpenKanjidicEntry[];
  __kotonohaKanjivg?: Record<string, CompactStrokeTuple[]>;
};

function loadJmdict(): JmdictTuple[] {
  if (!gCache.__kotonohaJmdict) {
    const filePath = path.join(GENERATED_DIR, "jmdict-common.json");
    if (!fs.existsSync(filePath)) return [];
    gCache.__kotonohaJmdict = JSON.parse(
      fs.readFileSync(filePath, "utf8")
    ) as JmdictTuple[];
  }
  return gCache.__kotonohaJmdict;
}

function loadKanjidic(): OpenKanjidicEntry[] {
  if (!gCache.__kotonohaKanjidic) {
    const filePath = path.join(GENERATED_DIR, "kanjidic2.json");
    if (!fs.existsSync(filePath)) return [];
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
      k: string;
      j: JlptLevel;
      s: number;
      g: number | null;
      f: number;
      on: string[];
      kun: string[];
      m: string;
    }[];
    gCache.__kotonohaKanjidic = raw.map((r) => ({
      kanji: r.k,
      jlpt: r.j,
      strokes: r.s,
      grade: r.g,
      freq: r.f,
      onyomi: r.on,
      kunyomi: r.kun,
      meaningEn: r.m,
    }));
  }
  return gCache.__kotonohaKanjidic;
}

function loadKanjivg(): Record<string, CompactStrokeTuple[]> {
  if (!gCache.__kotonohaKanjivg) {
    const filePath = path.join(GENERATED_DIR, "kanjivg-strokes.json");
    if (!fs.existsSync(filePath)) return {};
    gCache.__kotonohaKanjivg = JSON.parse(
      fs.readFileSync(filePath, "utf8")
    ) as Record<string, CompactStrokeTuple[]>;
  }
  return gCache.__kotonohaKanjivg;
}

export function getOpenDictStats(): {
  jmdictCount: number;
  kanjidicCount: number;
  kanjivgCount: number;
} {
  return {
    jmdictCount: loadJmdict().length,
    kanjidicCount: loadKanjidic().length,
    kanjivgCount: Object.keys(loadKanjivg()).length,
  };
}

/** O(1) exact lookup against 22,600+ JMdict common vocabulary entries. */
export function findExactJmdictWord(
  surface: string,
  basicForm?: string,
  readingHiragana?: string
): OpenJmdictEntry | null {
  const rows = loadJmdict();
  if (!gCache.__kotonohaJmdictMap) {
    const map = new Map<string, OpenJmdictEntry>();
    for (const [word, reading, meaningEn, pos] of rows) {
      if (!map.has(word)) {
        map.set(word, { word, reading, meaningEn, pos });
      }
      if (!map.has(reading)) {
        map.set(reading, { word, reading, meaningEn, pos });
      }
    }
    gCache.__kotonohaJmdictMap = map;
  }

  const candidates = [basicForm, surface, readingHiragana].filter(
    (v): v is string => Boolean(v && v.trim())
  );
  for (const key of candidates) {
    const hit = gCache.__kotonohaJmdictMap.get(key.trim());
    if (hit) return hit;
  }
  return null;
}

/** Searches JMdict Common entries with exact/prefix priority and Romaji normalization. */
export function searchJmdict(params: {
  query?: string;
  limit?: number;
}): { totalAvailable: number; items: OpenJmdictEntry[] } {
  const rows = loadJmdict();
  const limit = Math.min(Math.max(params.limit ?? 40, 1), 100);
  const rawQ = (params.query ?? "").trim();

  if (!rawQ) {
    return {
      totalAvailable: rows.length,
      items: rows.slice(0, limit).map(([word, reading, meaningEn, pos]) => ({
        word,
        reading,
        meaningEn,
        pos,
      })),
    };
  }

  const qLower = rawQ.toLowerCase();
  const hiraQ = /^[a-zA-Z\s-]+$/.test(rawQ) ? toHiragana(rawQ.replace(/\s+/g, "")) : "";

  const exact: OpenJmdictEntry[] = [];
  const prefix: OpenJmdictEntry[] = [];
  const partial: OpenJmdictEntry[] = [];

  for (const [word, reading, meaningEn, pos] of rows) {
    const wLower = word.toLowerCase();
    const rLower = reading.toLowerCase();
    const mLower = meaningEn.toLowerCase();

    if (wLower === qLower || rLower === qLower || (hiraQ && reading === hiraQ)) {
      exact.push({ word, reading, meaningEn, pos });
      if (exact.length >= limit) break;
    } else if (
      wLower.startsWith(qLower) ||
      rLower.startsWith(qLower) ||
      (hiraQ && reading.startsWith(hiraQ))
    ) {
      if (prefix.length < limit) {
        prefix.push({ word, reading, meaningEn, pos });
      }
    } else if (
      wLower.includes(qLower) ||
      rLower.includes(qLower) ||
      (hiraQ && reading.includes(hiraQ)) ||
      mLower.includes(qLower)
    ) {
      if (partial.length < limit) {
        partial.push({ word, reading, meaningEn, pos });
      }
    }
  }

  return {
    totalAvailable: rows.length,
    items: [...exact, ...prefix, ...partial].slice(0, limit),
  };
}

/** Searches KANJIDIC2 entries across all 2,680+ Joyo/JLPT kanji. */
export function searchKanjidic(params: {
  query?: string;
  level?: "ALL" | JlptLevel;
  limit?: number;
}): { totalAvailable: number; items: OpenKanjidicEntry[] } {
  const rows = loadKanjidic();
  const limit = Math.min(Math.max(params.limit ?? 48, 1), 120);
  const rawQ = (params.query ?? "").trim();
  const qLower = rawQ.toLowerCase();
  const hiraQ = /^[a-zA-Z\s-]+$/.test(rawQ) ? toHiragana(rawQ.replace(/\s+/g, "")) : "";

  const matches: OpenKanjidicEntry[] = [];
  for (const item of rows) {
    if (params.level && params.level !== "ALL" && item.jlpt !== params.level) {
      continue;
    }
    if (qLower) {
      const hit =
        item.kanji.includes(rawQ) ||
        item.meaningEn.toLowerCase().includes(qLower) ||
        item.onyomi.some((o) => o.includes(rawQ)) ||
        item.kunyomi.some(
          (ku) => ku.includes(rawQ) || (hiraQ && ku.includes(hiraQ))
        );
      if (!hit) continue;
    }
    matches.push(item);
    if (matches.length >= limit) break;
  }

  return {
    totalAvailable: rows.length,
    items: matches,
  };
}

/** Looks up official KanjiVG stroke paths (`viewBox="0 0 109 109"`) for any character. */
export function getKanjiVgStrokeOrder(
  char: string
): OpenStrokeOrderResponse | null {
  const clean = char.trim();
  if (!clean) return null;
  const firstChar = Array.from(clean)[0];
  const map = loadKanjivg();
  const rawStrokes = map[firstChar];
  if (!rawStrokes || rawStrokes.length === 0) return null;

  return {
    char: firstChar,
    viewBox: 109,
    source: "kanjivg",
    ruleTipTh: `ข้อมูลลำดับขีดมาตรฐาน KanjiVG (${rawStrokes.length} ขีด): ลากจากจุดหมายเลข 1 -> ${rawStrokes.length}`,
    strokes: rawStrokes.map(([d, sx, sy]) => ({
      d,
      start: [sx, sy],
    })),
  };
}
