import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import JSZip from "jszip";

const CACHE_DIR = path.resolve(process.cwd(), ".cache-data");
const OUT_DIR = path.resolve(process.cwd(), "src/data/generated");

const JMDICT_URL =
  "https://github.com/scriptin/jmdict-simplified/releases/download/3.6.2%2B20261116213322/jmdict-eng-common-3.6.2+20261116213322.json.zip";
const KANJIDIC_URL =
  "https://github.com/scriptin/jmdict-simplified/releases/download/3.6.2%2B20261116213322/kanjidic2-en-3.6.2+20261116213322.json.zip";
const KANJIVG_URL =
  "https://github.com/KanjiVG/kanjivg/releases/download/r20260714/kanjivg-20260714.xml.gz";

async function ensureCachedFile(fileName, url) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const filePath = path.join(CACHE_DIR, fileName);
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
    return filePath;
  }
  console.log(`Downloading ${url}...`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buf);
  return filePath;
}

function mapPosLabel(posTags) {
  if (!Array.isArray(posTags) || posTags.length === 0) return "คำศัพท์";
  const first = posTags[0];
  if (first.startsWith("v5")) return "Godan (V1)";
  if (first === "v1" || first.startsWith("v1-")) return "Ichidan (V2)";
  if (first === "vs" || first.startsWith("vs-")) return "Suru Verb";
  if (first === "vk") return "Kuru Verb";
  if (first === "adj-i" || first === "adj-ix") return "i-Adj";
  if (first === "adj-na") return "na-Adj";
  if (first === "adv" || first === "adv-to") return "Adverb";
  if (first === "prt") return "Particle";
  if (first === "conj") return "Conjunction";
  if (first === "exp") return "Expression";
  if (first.startsWith("n")) return "Noun";
  return first;
}

function mapJlptLevel(misc) {
  const oldLevel = misc?.jlptLevel;
  const grade = misc?.grade;
  const freq = misc?.frequency ?? 9999;

  if (oldLevel === 4) return "N5";
  if (oldLevel === 3) return "N4";
  if (oldLevel === 2) return grade && grade <= 4 ? "N3" : "N2";
  if (oldLevel === 1) return "N1";

  // Remaining Joyo / frequent kanji mapped sensibly by school grade & frequency
  if (grade === 1 || freq <= 250) return "N5";
  if (grade === 2 || freq <= 600) return "N4";
  if (grade === 3 || grade === 4 || freq <= 1200) return "N3";
  if (grade === 5 || grade === 6 || freq <= 1900) return "N2";
  return "N1";
}

function parsePathStart(d) {
  const m = d.match(/^\s*[Mm]\s*(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
  if (!m) return [54.5, 54.5];
  return [Number(Number(m[1]).toFixed(1)), Number(Number(m[2]).toFixed(1))];
}

function isPracticalKanaOrKanji(cp) {
  // Include Hiragana (3041..3096), Katakana (30A1..30F6), or CJK Unified Ideographs
  return (
    (cp >= 0x3041 && cp <= 0x3096) ||
    (cp >= 0x30a1 && cp <= 0x30f6) ||
    (cp >= 0x4e00 && cp <= 0x9fff)
  );
}

async function ingestJmdict(zipPath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
  const jsonName = Object.keys(zip.files)[0];
  const raw = JSON.parse(await zip.files[jsonName].async("string"));

  const compact = [];
  const seen = new Set();

  for (const entry of raw.words ?? []) {
    const kList = Array.isArray(entry.kanji) ? entry.kanji : [];
    const rList = Array.isArray(entry.kana) ? entry.kana : [];
    const preferredK = kList.find((k) => k.common) ?? kList[0];
    const preferredR = rList.find((r) => r.common) ?? rList[0];

    const word = (preferredK?.text || preferredR?.text || "").trim();
    const reading = (preferredR?.text || word).trim();
    if (!word || !reading) continue;

    const firstSense = entry.sense?.[0];
    const glosses = (firstSense?.gloss ?? [])
      .filter((g) => g.lang === "eng" && g.text)
      .slice(0, 3)
      .map((g) => g.text.trim());
    if (glosses.length === 0) continue;

    const dedupeKey = `${word}|${reading}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const pos = mapPosLabel(firstSense?.partOfSpeech);
    // Compact tuple: [word, reading, meaningEn, pos]
    compact.push([word, reading, glosses.join("; "), pos]);
  }

  return compact;
}

async function ingestKanjidic(zipPath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
  const jsonName = Object.keys(zip.files)[0];
  const raw = JSON.parse(await zip.files[jsonName].async("string"));

  const entries = [];
  const targetCharSet = new Set();

  for (const ch of raw.characters ?? []) {
    const misc = ch.misc ?? {};
    const hasCurriculumStatus =
      Boolean(misc.jlptLevel) ||
      (typeof misc.grade === "number" && misc.grade <= 8) ||
      (typeof misc.frequency === "number" && misc.frequency <= 2500);
    if (!hasCurriculumStatus) continue;

    const group = ch.readingMeaning?.groups?.[0];
    const readings = group?.readings ?? [];
    const on = readings
      .filter((r) => r.type === "ja_on")
      .slice(0, 4)
      .map((r) => r.value);
    const kun = readings
      .filter((r) => r.type === "ja_kun")
      .slice(0, 4)
      .map((r) => r.value);
    const meanings = (group?.meanings ?? [])
      .filter((m) => m.lang === "en")
      .slice(0, 4)
      .map((m) => m.value);

    const strokes = misc.strokeCounts?.[0] ?? 1;
    const jlpt = mapJlptLevel(misc);
    const freq = misc.frequency ?? 9999;

    targetCharSet.add(ch.literal);
    entries.push({
      k: ch.literal,
      j: jlpt,
      s: strokes,
      g: misc.grade ?? null,
      f: freq,
      on,
      kun,
      m: meanings.join("; "),
    });
  }

  entries.sort((a, b) => a.f - b.f || a.s - b.s);
  return { entries, targetCharSet };
}

function ingestKanjivg(gzPath, targetKanjiSet) {
  const xml = zlib.gunzipSync(fs.readFileSync(gzPath)).toString("utf8");
  const blocks = xml.matchAll(
    /<kanji id="kvg:kanji_([0-9a-fA-F]+)">([\s\S]*?)<\/kanji>/g
  );

  const map = {};
  let count = 0;

  for (const match of blocks) {
    const hex = match[1];
    // Skip variant sub-ids with dashes/non-standard >5 hex
    if (!/^[0-9a-fA-F]{4,5}$/.test(hex)) continue;
    const cp = Number.parseInt(hex, 16);
    if (!isPracticalKanaOrKanji(cp)) continue;

    const char = String.fromCodePoint(cp);
    const isKana = cp <= 0x30f6;
    if (!isKana && !targetKanjiSet.has(char)) continue;

    const body = match[2];
    const paths = [];
    for (const pMatch of body.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)) {
      const d = pMatch[1].trim();
      paths.push([d, ...parsePathStart(d)]);
    }
    if (paths.length === 0) continue;

    map[char] = paths;
    count += 1;
  }

  return { map, count };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const [jmdictZip, kanjidicZip, kanjivgGz] = await Promise.all([
    ensureCachedFile("jmdict-common.zip", JMDICT_URL),
    ensureCachedFile("kanjidic2.zip", KANJIDIC_URL),
    ensureCachedFile("kanjivg.xml.gz", KANJIVG_URL),
  ]);

  console.log("Parsing JMdict Common...");
  const jmdict = await ingestJmdict(jmdictZip);
  const jmdictOut = path.join(OUT_DIR, "jmdict-common.json");
  fs.writeFileSync(jmdictOut, JSON.stringify(jmdict));

  console.log("Parsing KANJIDIC2...");
  const { entries: kanjidic, targetCharSet } = await ingestKanjidic(kanjidicZip);
  const kanjidicOut = path.join(OUT_DIR, "kanjidic2.json");
  fs.writeFileSync(kanjidicOut, JSON.stringify(kanjidic));

  console.log("Parsing KanjiVG Stroke Orders...");
  const { map: kanjivg, count: kanjivgCount } = ingestKanjivg(
    kanjivgGz,
    targetCharSet
  );
  const kanjivgOut = path.join(OUT_DIR, "kanjivg-strokes.json");
  fs.writeFileSync(kanjivgOut, JSON.stringify(kanjivg));

  const formatMb = (p) => (fs.statSync(p).size / (1024 * 1024)).toFixed(2);
  console.log("Done!");
  console.log(`- JMdict Common: ${jmdict.length} entries (${formatMb(jmdictOut)} MB)`);
  console.log(`- KANJIDIC2: ${kanjidic.length} kanji (${formatMb(kanjidicOut)} MB)`);
  console.log(`- KanjiVG SVG: ${kanjivgCount} characters (${formatMb(kanjivgOut)} MB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
