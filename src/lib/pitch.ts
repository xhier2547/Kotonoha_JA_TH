import type { PitchType } from "@/types/learning";

const SMALL_YOOON = new Set([
  "ゃ", "ゅ", "ょ", "ぁ", "ぃ", "ぅ", "ぇ", "ぉ",
  "ャ", "ュ", "ョ", "ァ", "ィ", "ゥ", "ェ", "ォ",
  "ゎ", "ヮ",
]);

/**
 * Splits a Japanese kana string into morae (e.g. "きょう" -> ["きょ", "う"], "がっこう" -> ["が", "っ", "こ", "う"]).
 */
export function splitMorae(kana: string): string[] {
  const morae: string[] = [];
  for (const ch of kana.trim()) {
    if (SMALL_YOOON.has(ch) && morae.length > 0) {
      morae[morae.length - 1] += ch;
    } else if (/\s/.test(ch)) {
      continue;
    } else {
      morae.push(ch);
    }
  }
  return morae;
}

export function classifyPitch(pitch: number, moraCount: number): PitchType {
  if (pitch === 0) return "heiban";
  if (pitch === 1) return "atamadaka";
  if (pitch >= moraCount) return "odaka";
  return "nakadaka";
}

export function getPitchLabelTh(pitch: number, moraCount: number): {
  type: PitchType;
  label: string;
  badgeColor: string;
  description: string;
} {
  const type = classifyPitch(pitch, moraCount);
  switch (type) {
    case "heiban":
      return {
        type,
        label: `[0] 平板 Heiban (ราบเรียบ)`,
        badgeColor: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
        description: "เริ่มต่ำ พยางค์ที่ 2 ขึ้นสูง และค้างสูงไปจนถึงคำช่วย (は/が)",
      };
    case "atamadaka":
      return {
        type,
        label: `[1] 頭高 Atamadaka (สูงต้น)`,
        badgeColor: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
        description: "พยางค์แรกสูง แล้วตกลงต่ำทันทีตั้งแต่พยางค์ที่ 2",
      };
    case "odaka":
      return {
        type,
        label: `[${pitch}] 尾高 Odaka (ตกท้าย)`,
        badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
        description: "ขึ้นสูงจากพยางค์ 2 ไปจนจบคำ แล้วตกต่ำที่คำช่วยข้างหลัง",
      };
    case "nakadaka":
      return {
        type,
        label: `[${pitch}] 中高 Nakadaka (สูงกลาง)`,
        badgeColor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
        description: `ขึ้นสูงที่พยางค์ 2 และตกลงต่ำหลังพยางค์ที่ ${pitch}`,
      };
  }
}

/**
 * Returns boolean[] (true = High, false = Low) for each mora + 1 trailing particle slot.
 */
export function computePitchContour(moraCount: number, pitch: number): boolean[] {
  if (moraCount <= 0) return [];
  const pattern: boolean[] = [];

  if (pitch === 0) {
    // L H H ... (particle H)
    for (let i = 0; i < moraCount + 1; i++) {
      pattern.push(i !== 0);
    }
  } else if (pitch === 1) {
    // H L L ... (particle L)
    for (let i = 0; i < moraCount + 1; i++) {
      pattern.push(i === 0);
    }
  } else {
    // L H ... H (up to index pitch-1) L ...
    for (let i = 0; i < moraCount + 1; i++) {
      if (i === 0) {
        pattern.push(false);
      } else if (i < pitch) {
        pattern.push(true);
      } else {
        pattern.push(false);
      }
    }
  }
  return pattern;
}
