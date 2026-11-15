export interface ImportedCardRow {
  front: string;
  reading: string;
  meaningTh: string;
  meaningEn?: string;
  tags: string[];
  exampleSentence?: string;
  mnemonic?: string;
}

export function stripHtmlAndSoundTags(raw: string): string {
  return raw
    .replace(/\[sound:[^\]]+\]/gi, "")
    .replace(/<br\s*\/?>/gi, " / ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function escapeCsvCell(value: string): string {
  const safe = String(value ?? "");
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function cardsToCsv(
  cards: {
    front: string;
    reading: string;
    meaningTh: string;
    meaningEn: string;
    cardType: string;
    tags: string[];
    exampleSentence?: string;
    mnemonic?: string;
  }[]
): string {
  const header = [
    "front",
    "reading",
    "meaningTh",
    "meaningEn",
    "cardType",
    "tags",
    "exampleSentence",
    "mnemonic",
  ].join(",");

  const rows = cards.map((c) =>
    [
      c.front,
      c.reading,
      c.meaningTh,
      c.meaningEn,
      c.cardType,
      c.tags.join(" "),
      c.exampleSentence ?? "",
      c.mnemonic ?? "",
    ]
      .map(escapeCsvCell)
      .join(",")
  );

  return "\uFEFF" + [header, ...rows].join("\r\n");
}

export function cardsToAnkiTsv(
  cards: {
    front: string;
    reading: string;
    meaningTh: string;
    exampleSentence?: string;
    tags: string[];
  }[]
): string {
  const sanitizeTab = (s: string) => s.replace(/[\t\r\n]+/g, " ").trim();
  const lines = [
    "#separator:tab",
    "#html:false",
    "#tags column:4",
    ...cards.map((c) => {
      const backParts = [
        c.reading && c.reading !== c.front ? `[${c.reading}]` : "",
        c.meaningTh,
        c.exampleSentence ? `ตัวอย่าง: ${c.exampleSentence}` : "",
      ].filter(Boolean);
      return [
        sanitizeTab(c.front),
        sanitizeTab(backParts.join(" — ")),
        sanitizeTab(c.reading || c.front),
        sanitizeTab(c.tags.map((t) => t.replace(/\s+/g, "_")).join(" ")),
      ].join("\t");
    }),
  ];
  return lines.join("\n");
}

function splitCsvLine(line: string, delimiter: string): string[] {
  if (delimiter === "\t") {
    return line.split("\t").map((cell) => stripHtmlAndSoundTags(cell));
  }

  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(stripHtmlAndSoundTags(cur));
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(stripHtmlAndSoundTags(cur));
  return cells;
}

/**
 * Parses CSV, TSV, or Anki plain-text export files into importable card rows.
 */
export function parseDelimitedDeck(rawText: string): ImportedCardRow[] {
  const cleanText = rawText.replace(/^\uFEFF/, "");
  const lines = cleanText
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  let explicitSeparator: string | null = null;
  const contentLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("#")) {
      const sepMatch = line.match(/^#separator\s*:\s*(tab|comma|semicolon)/i);
      if (sepMatch) {
        const kind = sepMatch[1].toLowerCase();
        explicitSeparator = kind === "tab" ? "\t" : kind === "semicolon" ? ";" : ",";
      }
      continue;
    }
    contentLines.push(line);
  }

  if (contentLines.length === 0) return [];

  const sample = contentLines[0];
  const delimiter =
    explicitSeparator ??
    (sample.includes("\t") ? "\t" : sample.includes(";") && !sample.includes(",") ? ";" : ",");

  const parsedRows = contentLines.map((line) => splitCsvLine(line, delimiter));
  const firstRowLower = parsedRows[0].map((c) => c.toLowerCase());
  const hasHeader =
    firstRowLower.includes("front") ||
    firstRowLower.includes("word") ||
    firstRowLower.includes("meaningth") ||
    firstRowLower.includes("meaning") ||
    firstRowLower.includes("expression");

  let startIdx = 0;
  let frontIdx = 0;
  let readingIdx = -1;
  let meaningIdx = 1;
  let meaningEnIdx = -1;
  let tagsIdx = -1;
  let exampleIdx = -1;
  let mnemonicIdx = -1;

  if (hasHeader) {
    startIdx = 1;
    frontIdx = firstRowLower.findIndex((h) =>
      ["front", "word", "expression", "kanji", "jp", "vocab"].includes(h)
    );
    readingIdx = firstRowLower.findIndex((h) =>
      ["reading", "kana", "furigana", "yomikata"].includes(h)
    );
    meaningIdx = firstRowLower.findIndex((h) =>
      ["meaningth", "meaning", "back", "translation", "th"].includes(h)
    );
    meaningEnIdx = firstRowLower.findIndex((h) => ["meaningen", "en"].includes(h));
    tagsIdx = firstRowLower.findIndex((h) => ["tags", "tag"].includes(h));
    exampleIdx = firstRowLower.findIndex((h) =>
      ["examplesentence", "example", "sentence"].includes(h)
    );
    mnemonicIdx = firstRowLower.findIndex((h) => ["mnemonic", "notes", "note"].includes(h));
    if (frontIdx < 0) frontIdx = 0;
    if (meaningIdx < 0) meaningIdx = frontIdx === 0 ? 1 : 0;
  }

  const results: ImportedCardRow[] = [];
  for (let i = startIdx; i < parsedRows.length; i++) {
    const row = parsedRows[i];
    if (row.length < 2) continue;

    const front = (row[frontIdx] ?? "").trim();
    if (!front) continue;

    let reading = readingIdx >= 0 ? (row[readingIdx] ?? "").trim() : "";
    let meaning = (row[meaningIdx] ?? "").trim();
    let tagsRaw = tagsIdx >= 0 ? (row[tagsIdx] ?? "").trim() : "";

    if (!hasHeader && row.length >= 3) {
      // Heuristic for headerless 3+ column TSV/CSV (front, reading-or-meaning, meaning/tags)
      const col1 = (row[1] ?? "").trim();
      const col2 = (row[2] ?? "").trim();
      if (!reading && /^[\u3040-\u30ffー\s・]+$/.test(col1)) {
        reading = col1;
        meaning = col2;
        if (row[3] && !tagsRaw) tagsRaw = row[3].trim();
      } else if (row.length === 4 && !tagsRaw) {
        reading = row[2]?.trim() || front;
        tagsRaw = row[3]?.trim() || "";
      }
    }

    if (!meaning) meaning = front;
    const tags = Array.from(
      new Set([
        "Imported",
        ...tagsRaw
          .split(/[\s,]+/)
          .map((t) => t.trim())
          .filter(Boolean),
      ])
    );

    results.push({
      front,
      reading: reading || front,
      meaningTh: meaning,
      meaningEn: meaningEnIdx >= 0 ? row[meaningEnIdx]?.trim() : undefined,
      tags,
      exampleSentence: exampleIdx >= 0 ? row[exampleIdx]?.trim() : undefined,
      mnemonic: mnemonicIdx >= 0 ? row[mnemonicIdx]?.trim() : undefined,
    });
  }

  return results;
}
