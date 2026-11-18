"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  Eye,
  EyeOff,
  FilePlus2,
  ImagePlus,
  Languages,
  PlusCircle,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
} from "lucide-react";
import {
  db,
  ensureSeeded,
  getAppSettings,
  getLearningSummary,
  mineCardToSrs,
} from "@/lib/db";
import { findKanjiMatches, findVocabMatch } from "@/lib/vocabLookup";
import { translateJaToTh } from "@/lib/localTranslate";
import { PitchAccentChart } from "@/components/PitchAccentChart";
import { SpeakButton } from "@/components/SpeakButton";
import { VocabVisualCard, hasBuiltInVisual } from "@/components/VocabVisualCard";
import { StudyPageHero } from "@/components/StudyPageHero";
import { TextShimmer } from "@/components/ui21/TextShimmer";
import {
  compressImageFileToDataUrl,
  extractImageFromClipboard,
  requestGeneratedVocabImage,
} from "@/lib/imageUtils";
import { speakJapanese } from "@/lib/speech";
import { parseSubtitleFile } from "@/lib/subtitleParser";
import type { SavedReadingPassage, TokenizedWord } from "@/types/learning";

function extractSentenceAroundIndex(
  tokens: TokenizedWord[],
  targetIdx: number
): string {
  const delimiters = new Set(["。", "！", "？", "!", "?", "\n"]);
  let start = targetIdx;
  while (start > 0 && !delimiters.has(tokens[start - 1].surface)) {
    start -= 1;
  }
  let end = targetIdx;
  while (end < tokens.length - 1 && !delimiters.has(tokens[end].surface)) {
    end += 1;
  }
  return tokens
    .slice(start, end + 1)
    .map((t) => t.surface)
    .join("")
    .trim();
}

export default function ReaderPage() {
  const [passages, setPassages] = useState<SavedReadingPassage[]>([]);
  const [activePassage, setActivePassage] = useState<SavedReadingPassage | null>(null);
  const [customText, setCustomText] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const [tokens, setTokens] = useState<TokenizedWord[]>([]);
  const [tokenizing, setTokenizing] = useState(false);
  const [furiganaMode, setFuriganaMode] = useState<"all" | "unknown" | "off">("unknown");
  const [showTranslation, setShowTranslation] = useState(false);

  const [knownFronts, setKnownFronts] = useState<Set<string>>(new Set());
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [mineMeaning, setMineMeaning] = useState("");
  const [minedNotice, setMinedNotice] = useState<string | null>(null);
  const [wordTranslating, setWordTranslating] = useState(false);
  const [mineImageDataUrl, setMineImageDataUrl] = useState<string | undefined>(
    undefined
  );
  const [generatingImg, setGeneratingImg] = useState(false);

  // AI Story state
  const [aiTopic, setAiTopic] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      await ensureSeeded();
      const [allPassages, summary, settings] = await Promise.all([
        db.passages.toArray(),
        getLearningSummary(),
        getAppSettings(),
      ]);
      if (!active) return;
      setPassages(allPassages);
      setKnownFronts(summary.knownFronts);
      setFuriganaMode(settings.furiganaMode);
      if (allPassages.length > 0) {
        const matchedPassage =
          allPassages.find((p) => p.level === settings.learnerLevel) ??
          allPassages[0];
        setActivePassage((prev) => prev ?? matchedPassage);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const activeContent = activePassage?.content ?? "";

  useEffect(() => {
    if (!activeContent) return;
    let active = true;
    fetch("/api/tokenize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: activeContent }),
    })
      .then((res) => (res.ok ? res.json() : { tokens: [] }))
      .then((data: { tokens?: TokenizedWord[] }) => {
        if (!active) return;
        setTokens(data.tokens ?? []);
        setSelectedIdx(null);
        setMinedNotice(null);
        setTokenizing(false);
      })
      .catch(() => {
        if (active) setTokenizing(false);
      });
    return () => {
      active = false;
    };
  }, [activeContent]);

  const selectedToken = selectedIdx !== null ? tokens[selectedIdx] : null;

  const matchedDictEntry = useMemo(() => {
    if (!selectedToken) return null;
    return findVocabMatch(
      selectedToken.surface,
      selectedToken.basicForm,
      selectedToken.readingHiragana
    );
  }, [selectedToken]);

  const relatedKanji = useMemo(() => {
    if (!selectedToken) return [];
    return findKanjiMatches(selectedToken.surface);
  }, [selectedToken]);

  const sentenceContext = useMemo(() => {
    if (selectedIdx === null) return "";
    return extractSentenceAroundIndex(tokens, selectedIdx);
  }, [tokens, selectedIdx]);

  const handleSelectToken = (tok: TokenizedWord, idx: number) => {
    setSelectedIdx(idx);
    setMinedNotice(null);
    setMineImageDataUrl(undefined);
    const matched = findVocabMatch(
      tok.surface,
      tok.basicForm,
      tok.readingHiragana
    );
    setMineMeaning(matched?.meaningTh ?? "");
    speakJapanese(tok.surface);
  };

  const handleTranslateWordLocal = async () => {
    if (!selectedToken) return;
    const word = selectedToken.basicForm || selectedToken.surface;
    setWordTranslating(true);
    try {
      const res = await translateJaToTh(word);
      if (res?.translation) {
        setMineMeaning(res.translation);
      }
    } finally {
      setWordTranslating(false);
    }
  };

  const handleTranslateSentenceLocal = async () => {
    if (!sentenceContext) return;
    setWordTranslating(true);
    try {
      const res = await translateJaToTh(sentenceContext);
      if (res?.translation) {
        setMineMeaning((prev) => prev || res.translation);
      }
    } finally {
      setWordTranslating(false);
    }
  };

  const handleAttachImageFile = async (file: Blob | null) => {
    if (!file) return;
    const dataUrl = await compressImageFileToDataUrl(file);
    setMineImageDataUrl(dataUrl);
  };

  const handleSubtitleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const raw = await file.text();
    const parsed = parseSubtitleFile(file.name, raw);
    if (!parsed.content) return;
    setCustomTitle(parsed.title);
    setCustomText(parsed.content);
  };

  const handleLoadCustomText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim()) return;
    const customPassage: SavedReadingPassage = {
      id: `custom-${Date.now()}`,
      title:
        customTitle.trim() ||
        `ข้อความที่นำเข้า (${customText.trim().slice(0, 18)}...)`,
      level: "N4",
      content: customText.trim(),
      createdAt: new Date().toISOString(),
      isCustom: true,
    };
    await db.passages.put(customPassage);
    setPassages((prev) => [customPassage, ...prev]);
    setActivePassage(customPassage);
    setCustomText("");
    setCustomTitle("");
    setShowCustomInput(false);
  };

  const handleMineSentence = async () => {
    if (!selectedToken) return;
    const word = selectedToken.basicForm || selectedToken.surface;
    const meaning =
      mineMeaning.trim() ||
      matchedDictEntry?.meaningTh ||
      `คำศัพท์จากบทอ่าน (${selectedToken.pos})`;

    const res = await mineCardToSrs({
      front: word,
      reading: selectedToken.readingHiragana,
      meaningTh: meaning,
      meaningEn: matchedDictEntry?.meaningEn,
      pitch: matchedDictEntry?.pitch,
      imageDataUrl: mineImageDataUrl,
      visualKey: word,
      exampleSentence: sentenceContext,
      exampleMeaningTh: activePassage?.translationTh,
      cardType: "sentence",
      tags: ["Mined", activePassage?.level ?? "Reader"],
    });

    const summary = await getLearningSummary();
    setKnownFronts(summary.knownFronts);
    setMinedNotice(
      res.created
        ? `บันทึก "${word}" พร้อมประโยคลงใน FSRS แล้ว!`
        : `คำว่า "${word}" มีอยู่ใน FSRS แล้ว`
    );
  };

  const handleGenerateAiStory = async () => {
    setAiError(null);
    const settings = await getAppSettings();
    if (settings.aiProvider === "offline" || !settings.apiKey.trim()) {
      setAiError(
        "โหมดสร้างบทความอัตโนมัติต้องใส่ Gemini หรือ OpenAI API Key ในหน้า 'ตั้งค่า' ก่อนครับ (หรือเลือกอ่านบทความ i+1 ที่มีให้ด้านล่างได้เลย)"
      );
      return;
    }

    setAiLoading(true);
    try {
      const knownList = Array.from(knownFronts).slice(0, 40);
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "story",
          provider: settings.aiProvider,
          apiKey: settings.apiKey,
          model: settings.aiModel,
          level: settings.learnerLevel,
          knownWords: knownList,
          topic: aiTopic.trim() || "การท่องเที่ยวและคุยกับเพื่อนในญี่ปุ่น",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "สร้างบทความไม่สำเร็จ");
      }
      const d = json.data as {
        title: string;
        content: string;
        translationTh: string;
      };
      const newPassage: SavedReadingPassage = {
        id: `ai-${Date.now()}`,
        title: d.title,
        level: settings.learnerLevel,
        content: d.content,
        translationTh: d.translationTh,
        createdAt: new Date().toISOString(),
        isCustom: true,
      };
      await db.passages.put(newPassage);
      setPassages((prev) => [newPassage, ...prev]);
      setActivePassage(newPassage);
      setAiTopic("");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <StudyPageHero
        tone="matcha"
        kanjiWatermark="読解"
        eyebrow="Phase 3 • Comprehensible Input (i+1) & Sentence Mining"
        title="Immersion Reader & Sentence Miner"
        subtitle="ตัดคำภาษาญี่ปุ่นอัตโนมัติด้วย Kuromoji คลิกคำศัพท์เพื่อดูความหมายและบันทึกทั้งประโยคลง FSRS"
        actions={
          <button
            type="button"
            onClick={() => setShowCustomInput((s) => !s)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs sm:text-sm font-semibold backdrop-blur-xs cursor-pointer transition-colors"
          >
            <FilePlus2 className="w-4 h-4 text-emerald-200" />
            <span>วางข้อความ / นำเข้าซับ .SRT</span>
          </button>
        }
      />

      {/* Custom Text & Subtitle Input Drawer */}
      {showCustomInput && (
        <form
          onSubmit={handleLoadCustomText}
          className="rounded-2xl border border-primary/30 bg-surface p-5 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="block text-sm font-bold">
              วางข้อความญี่ปุ่น หรืออัปโหลดไฟล์ซับไตเติล (.srt / .vtt / .txt)
            </label>
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 text-xs font-medium cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>นำเข้าไฟล์ .SRT / .VTT / .TXT</span>
              <input
                type="file"
                accept=".srt,.vtt,.txt"
                onChange={handleSubtitleFileUpload}
                className="hidden"
              />
            </label>
          </div>
          <input
            type="text"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="ชื่อบทอ่าน / ชื่อตอนอนิเมะ (ไม่บังคับ)..."
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <textarea
            rows={5}
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="เช่น 日本の電車はとても時間どおりに来ます... หรือเลือกไฟล์ .srt ด้านบน"
            className="w-full rounded-xl border border-border bg-background p-3 text-base font-jp focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCustomInput(false)}
              className="px-4 py-2 rounded-xl border border-border text-xs font-medium cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium cursor-pointer"
            >
              วิเคราะห์ด้วย Kuromoji & เปิดอ่าน
            </button>
          </div>
        </form>
      )}

      {/* Passage Selector & AI i+1 Story Bar */}
      <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {passages.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActivePassage(p)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                activePassage?.id === p.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface-muted border-border text-foreground/75 hover:text-foreground"
              }`}
            >
              {p.title}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
          <input
            type="text"
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            placeholder="หัวข้อที่อยากให้ AI แต่งบทอ่าน i+1 (เช่น สั่งกาแฟ, คุยเรื่องอนิเมะ)..."
            className="flex-1 px-3.5 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="button"
            disabled={aiLoading}
            onClick={handleGenerateAiStory}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-foreground text-background text-xs font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {aiLoading ? (
              <TextShimmer
                text="กำลังแต่งเรื่อง i+1..."
                baseColor="color-mix(in srgb, var(--background) 65%, transparent)"
                shimmerColor="var(--background)"
                className="text-xs font-medium"
              />
            ) : (
              <span>ให้ AI แต่งเรื่อง i+1</span>
            )}
          </button>
        </div>
        {aiError && (
          <div className="text-xs text-accent bg-accent/10 border border-accent/25 rounded-xl px-3 py-2">
            {aiError}
          </div>
        )}
      </div>

      {/* Main Reader Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reading Canvas */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-surface p-5 sm:p-7 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="font-bold text-sm">
                {activePassage?.title ?? "เลือกบทอ่าน"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activePassage && (
                <SpeakButton text={activePassage.content} label="ฟังทั้งบทความ" />
              )}

              <select
                value={furiganaMode}
                onChange={(e) =>
                  setFuriganaMode(e.target.value as "all" | "unknown" | "off")
                }
                className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs font-medium"
                aria-label="Furigana mode"
              >
                <option value="unknown">Furigana: เฉพาะคำที่ยังไม่เคยเรียน</option>
                <option value="all">Furigana: แสดงทั้งหมด</option>
                <option value="off">Furigana: ซ่อนทั้งหมด</option>
              </select>

              {activePassage?.translationTh && (
                <button
                  type="button"
                  onClick={() => setShowTranslation((s) => !s)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-surface-muted cursor-pointer"
                >
                  {showTranslation ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                  <span>คำแปลไทย</span>
                </button>
              )}
            </div>
          </div>

          {tokenizing ? (
            <div className="py-12 text-center text-sm text-foreground/60">
              กำลังวิเคราะห์คำด้วย Kuromoji...
            </div>
          ) : (
            <div className="font-jp text-xl sm:text-2xl leading-[2.35] tracking-wide select-text">
              {tokens.map((tok, idx) => {
                const isKnown =
                  knownFronts.has(tok.basicForm) || knownFronts.has(tok.surface);
                const showRuby =
                  tok.hasKanji &&
                  tok.readingHiragana &&
                  tok.readingHiragana !== tok.surface &&
                  (furiganaMode === "all" ||
                    (furiganaMode === "unknown" && !isKnown));
                const isSelected = selectedIdx === idx;
                const isPunct = tok.pos === "記号";

                if (isPunct) {
                  return <span key={idx}>{tok.surface}</span>;
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectToken(tok, idx)}
                    className={`inline-block rounded px-0.5 transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-primary/20 text-primary ring-1 ring-primary"
                        : isKnown && tok.isContentWord
                          ? "hover:bg-matcha/15 border-b border-dotted border-matcha/50"
                          : tok.isContentWord
                            ? "hover:bg-primary/10 border-b border-dotted border-primary/40"
                            : "hover:bg-surface-muted"
                    }`}
                  >
                    {showRuby ? (
                      <ruby>
                        {tok.surface}
                        <rt className="text-foreground/65">{tok.readingHiragana}</rt>
                      </ruby>
                    ) : (
                      tok.surface
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {showTranslation && activePassage?.translationTh && (
            <div className="rounded-xl bg-surface-muted p-4 text-sm text-foreground/85 leading-relaxed border border-border">
              <div className="text-xs font-semibold text-foreground/60 mb-1">
                คำแปลภาษาไทย
              </div>
              {activePassage.translationTh}
            </div>
          )}

          <div className="text-[11px] text-foreground/55 flex flex-wrap gap-4 pt-2 border-t border-border">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 border-b-2 border-dotted border-matcha" />
              เส้นประเขียว = คำที่คุณเคยเรียนแล้วใน FSRS (ซ่อน Furigana อัตโนมัติ)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 border-b-2 border-dotted border-primary" />
              เส้นประน้ำเงิน = คลิกเพื่อดูคำอ่าน &amp; Mine ประโยค
            </span>
          </div>
        </div>

        {/* Word Inspector & Sentence Miner */}
        <div
          onPaste={(e) => {
            const img = extractImageFromClipboard(e.clipboardData);
            if (img) {
              e.preventDefault();
              void handleAttachImageFile(img);
            }
          }}
          className="rounded-2xl border border-border bg-surface p-5 h-fit sticky top-20 space-y-4"
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            Word Inspector & Sentence Miner
          </div>

          {!selectedToken ? (
            <div className="py-10 text-center text-sm text-foreground/60 space-y-2">
              <p>คลิกที่คำศัพท์ใดก็ได้ในบทอ่าน</p>
              <p className="text-xs">
                เพื่อดูรากศัพท์ คำอ่าน ระดับเสียง Pitch Accent และบันทึกทั้งประโยคลงใน FSRS
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-jp text-3xl font-bold text-primary">
                    {selectedToken.surface}
                  </div>
                  {selectedToken.basicForm !== selectedToken.surface && (
                    <div className="text-xs text-foreground/65 mt-0.5 font-jp">
                      รูปพจนานุกรม (Basic Form):{" "}
                      <span className="font-semibold">{selectedToken.basicForm}</span>
                    </div>
                  )}
                  <div className="font-jp text-sm text-foreground/80 mt-0.5">
                    {selectedToken.readingHiragana} • {selectedToken.pos}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => speakJapanese(selectedToken.surface)}
                  className="p-2 rounded-xl border border-border hover:bg-surface-muted cursor-pointer"
                  title="ฟังเสียงคำนี้"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>

              {matchedDictEntry ? (
                <div className="space-y-3 rounded-xl bg-surface-muted/70 p-3.5 border border-border">
                  <div>
                    <div className="text-xs text-foreground/60">ความหมายในคลัง</div>
                    <div className="font-bold text-sm mt-0.5">
                      {matchedDictEntry.meaningTh}
                    </div>
                    <div className="text-xs text-foreground/60">
                      {matchedDictEntry.meaningEn}
                    </div>
                  </div>
                  <PitchAccentChart
                    reading={matchedDictEntry.reading}
                    pitch={matchedDictEntry.pitch}
                    compact
                  />
                </div>
              ) : (
                <div className="rounded-xl bg-surface-muted/60 p-3 border border-border space-y-2">
                  <div className="text-xs text-foreground/65">
                    ยังไม่มีคำนี้ในคลังคำศัพท์หลัก กดแปลคำหรือประโยคได้ทันที:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={wordTranslating}
                      onClick={() => void handleTranslateWordLocal()}
                      className="px-2.5 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs font-medium inline-flex items-center gap-1.5 hover:bg-primary/15 cursor-pointer disabled:opacity-50"
                    >
                      <Languages className="w-3.5 h-3.5" />
                      <span>{wordTranslating ? "กำลังแปล..." : "แปลคำนี้ (Local)"}</span>
                    </button>
                    <button
                      type="button"
                      disabled={wordTranslating}
                      onClick={() => void handleTranslateSentenceLocal()}
                      className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs font-medium inline-flex items-center gap-1.5 hover:bg-surface-muted cursor-pointer disabled:opacity-50"
                    >
                      <Languages className="w-3.5 h-3.5" />
                      <span>แปลประโยค</span>
                    </button>
                  </div>
                </div>
              )}

              {(mineImageDataUrl ||
                hasBuiltInVisual(
                  selectedToken.basicForm || selectedToken.surface,
                  matchedDictEntry ? [matchedDictEntry.category] : undefined
                )) && (
                <VocabVisualCard
                  word={selectedToken.basicForm || selectedToken.surface}
                  tags={matchedDictEntry ? [matchedDictEntry.category] : undefined}
                  imageDataUrl={mineImageDataUrl}
                  compact
                />
              )}

              {relatedKanji.length > 0 && (
                <div className="rounded-xl border border-border bg-background p-3 space-y-1.5">
                  <div className="text-[11px] font-semibold text-foreground/60">
                    คันจิในคำนี้ ({relatedKanji.length})
                  </div>
                  <div className="space-y-1.5">
                    {relatedKanji.map((k) => (
                      <div key={k.id} className="text-xs flex items-start gap-2">
                        <span className="font-jp font-bold text-primary text-base leading-none">
                          {k.kanji}
                        </span>
                        <span className="text-foreground/80">
                          {k.meaningTh} —{" "}
                          <span className="text-foreground/60">{k.mnemonicTh}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-dashed border-border p-2.5 flex flex-wrap items-center justify-between gap-2 bg-background/50">
                <span className="text-[11px] text-foreground/65">
                  วางรูป (<kbd className="px-1 rounded bg-surface-muted">Ctrl+V</kbd>) หรือสร้างด้วย AI
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={generatingImg}
                    onClick={async () => {
                      setGeneratingImg(true);
                      try {
                        const s = await getAppSettings();
                        const url = await requestGeneratedVocabImage({
                          word: selectedToken.basicForm || selectedToken.surface,
                          reading: selectedToken.readingHiragana,
                          meaningTh: mineMeaning.trim() || matchedDictEntry?.meaningTh,
                          meaningEn: matchedDictEntry?.meaningEn,
                          provider: s.aiProvider,
                          apiKey: s.apiKey,
                        });
                        setMineImageDataUrl(url);
                      } catch {
                        // ignore transient image failure
                      } finally {
                        setGeneratingImg(false);
                      }
                    }}
                    className="px-2 py-1 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs inline-flex items-center gap-1 hover:bg-primary/15 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{generatingImg ? "กำลังวาด..." : "สร้างรูป AI"}</span>
                  </button>
                  {mineImageDataUrl && (
                    <button
                      type="button"
                      onClick={() => setMineImageDataUrl(undefined)}
                      className="p-1.5 rounded-lg border border-border text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                      title="ลบรูป"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <label className="px-2.5 py-1 rounded-lg border border-border bg-surface text-xs inline-flex items-center gap-1 hover:bg-surface-muted cursor-pointer">
                    <ImagePlus className="w-3.5 h-3.5" />
                    <span>เลือกรูป</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        void handleAttachImageFile(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-border p-3 space-y-1.5 bg-background">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-foreground/60">
                    ประโยคบริบทที่จะถูก Mine
                  </span>
                  <SpeakButton text={sentenceContext} />
                </div>
                <p className="font-jp text-sm leading-relaxed">{sentenceContext}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/75">
                  ความหมายสำหรับบันทึกการ์ด FSRS
                </label>
                <input
                  type="text"
                  value={mineMeaning}
                  onChange={(e) => setMineMeaning(e.target.value)}
                  placeholder="พิมพ์ความหมายภาษาไทย..."
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <button
                type="button"
                onClick={handleMineSentence}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium inline-flex items-center justify-center gap-2 hover:opacity-95 transition-opacity cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Mine Sentence ลง FSRS</span>
              </button>

              {minedNotice && (
                <div className="text-xs text-matcha bg-matcha/10 border border-matcha/30 rounded-xl px-3 py-2 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>{minedNotice}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
