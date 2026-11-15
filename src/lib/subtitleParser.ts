export interface ParsedSubtitleResult {
  title: string;
  content: string;
  lineCount: number;
}

const TIMESTAMP_RE =
  /^\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?\s*-->\s*\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?/;

/**
 * Cleans `.srt`, `.vtt`, or `.txt` subtitle files into readable Japanese lines
 * suitable for Kuromoji tokenization and sentence mining.
 */
export function parseSubtitleFile(
  filename: string,
  rawContent: string
): ParsedSubtitleResult {
  const cleanTitle = filename.replace(/\.(srt|vtt|txt)$/i, "").trim() || "ซับไตเติลที่นำเข้า";
  const normalized = rawContent.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");

  const keptLines: string[] = [];
  let lastLine = "";

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    // Skip WEBVTT headers / metadata blocks
    if (/^(WEBVTT|NOTE|STYLE|REGION)\b/i.test(trimmed)) continue;
    // Skip cue index lines
    if (/^\d+$/.test(trimmed)) continue;
    // Skip timestamp lines
    if (TIMESTAMP_RE.test(trimmed)) continue;

    const cleaned = trimmed
      .replace(/\{\\[^}]+\}/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/（[^）]*声[^）]*）|\[(?:音楽|拍手|笑い|SE)[^\]]*\]/g, "")
      .trim();

    if (!cleaned || cleaned === lastLine) continue;
    keptLines.push(cleaned);
    lastLine = cleaned;
  }

  return {
    title: cleanTitle,
    content: keptLines.join("\n"),
    lineCount: keptLines.length,
  };
}
