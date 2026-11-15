export type SpeakerGender = "female" | "male" | "narrator";

export interface DialogueTurn {
  speakerLabel: string;
  gender: SpeakerGender;
  text: string;
}

const FEMALE_KEYWORDS = [
  "女",
  "女性",
  "母",
  "娘",
  "姉",
  "妹",
  "妻",
  "彼女",
  "花子",
  "さくら",
  "佐藤",
  "山田",
  "田中",
  "アナウンサー女",
];

const MALE_KEYWORDS = [
  "男",
  "男性",
  "父",
  "息子",
  "兄",
  "弟",
  "夫",
  "彼",
  "太郎",
  "健太",
  "ミラー",
  "ワット",
  "課長",
  "部長",
  "先生",
  "教授",
  "医者",
  "店員",
  "駅員",
];

const NARRATOR_KEYWORDS = [
  "状況",
  "ナレーション",
  "質問",
  "問い",
  "アナウンス",
  "放送",
];

export function inferSpeakerGender(
  label: string,
  alternatingIndex: number
): SpeakerGender {
  const clean = label.trim();
  if (!clean) return "narrator";
  if (NARRATOR_KEYWORDS.some((kw) => clean.includes(kw))) return "narrator";
  if (clean === "女" || clean.startsWith("女") || FEMALE_KEYWORDS.some((kw) => clean === kw)) {
    return "female";
  }
  if (clean === "男" || clean.startsWith("男") || MALE_KEYWORDS.some((kw) => clean === kw)) {
    return "male";
  }
  if (/^[AB12]$/.test(clean)) {
    return clean === "A" || clean === "1" ? "female" : "male";
  }
  return alternatingIndex % 2 === 0 ? "female" : "male";
}

/**
 * Splits a Japanese listening/dialogue script into clean spoken turns,
 * stripping speaker prefixes (`男：`, `女：`, `店員:`, etc.) so TTS never reads them literally.
 */
export function parseDialogueTurns(script: string): DialogueTurn[] {
  const rawLines = script
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const turns: DialogueTurn[] = [];
  let speakerIdx = 0;

  for (const line of rawLines) {
    // Match prefixes like `男：...`, `女性:...`, `田中さん：...`, `[女] ...`
    const colonMatch = line.match(/^([^\s：:「（(]{1,12})[：:]\s*(.+)$/);
    const bracketMatch = !colonMatch
      ? line.match(/^[【\[]([^】\]]{1,12})[】\]]\s*(.+)$/)
      : null;

    if (colonMatch) {
      const speakerLabel = colonMatch[1].trim();
      const spokenText = colonMatch[2].trim();
      if (spokenText) {
        turns.push({
          speakerLabel,
          gender: inferSpeakerGender(speakerLabel, speakerIdx++),
          text: spokenText,
        });
      }
    } else if (bracketMatch) {
      const speakerLabel = bracketMatch[1].trim();
      const spokenText = bracketMatch[2].trim();
      if (spokenText) {
        turns.push({
          speakerLabel,
          gender: inferSpeakerGender(speakerLabel, speakerIdx++),
          text: spokenText,
        });
      }
    } else {
      turns.push({
        speakerLabel: "",
        gender: "narrator",
        text: line,
      });
    }
  }

  return turns;
}
