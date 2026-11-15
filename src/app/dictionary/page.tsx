"use client";

import { useEffect, useMemo, useState } from "react";
import { toHiragana } from "wanakana";
import {
  Check,
  Lightbulb,
  PenTool,
  PlusCircle,
  Search,
  Sparkles,
} from "lucide-react";
import { CORE_GRAMMAR, CORE_KANJI, CORE_VOCAB } from "@/data/coreCurriculum";
import { MINNA_LESSONS } from "@/data/minnaNoNihongo";
import { KanaWritingCanvas } from "@/components/KanaWritingCanvas";
import { PitchAccentChart } from "@/components/PitchAccentChart";
import { SpeakButton } from "@/components/SpeakButton";
import { VocabVisualCard, hasBuiltInVisual } from "@/components/VocabVisualCard";
import { db, ensureSeeded, mineCardToSrs } from "@/lib/db";
import type { JlptLevel } from "@/types/learning";

type DictTab = "vocab" | "kanji" | "grammar";
type LevelFilter = "ALL" | JlptLevel;

interface UnifiedVocabEntry {
  id: string;
  word: string;
  reading: string;
  meaningTh: string;
  meaningEn?: string;
  pos: string;
  jlpt: JlptLevel;
  pitch?: number;
  exampleSentence?: string;
  exampleReading?: string;
  exampleMeaningTh?: string;
  notes?: string;
  sourceLabel: string;
  tags: string[];
  inUserDeck: boolean;
}

interface UnifiedGrammarEntry {
  id: string;
  pattern: string;
  meaningTh: string;
  structure: string;
  explanationTh: string;
  jlpt: JlptLevel;
  sourceLabel: string;
  examples: { jp: string; reading: string; th: string }[];
}

const LEVEL_FILTERS: { id: LevelFilter; label: string }[] = [
  { id: "ALL", label: "ทั้งหมด" },
  { id: "N5", label: "N5" },
  { id: "N4", label: "N4" },
  { id: "N3", label: "N3" },
  { id: "N2", label: "N2" },
  { id: "N1", label: "N1" },
];

export default function DictionaryPage() {
  const [tab, setTab] = useState<DictTab>("vocab");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("ALL");
  const [query, setQuery] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [userCards, setUserCards] = useState<UnifiedVocabEntry[]>([]);
  const [activeKanjiPractice, setActiveKanjiPractice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      await ensureSeeded();
      const cards = await db.cards.toArray();
      if (!active) return;

      const mapped: UnifiedVocabEntry[] = cards.map((c) => {
        const jlptTag =
          (c.tags.find((t) => /^N[1-5]$/.test(t)) as JlptLevel | undefined) ?? "N5";
        return {
          id: `user:${c.id}`,
          word: c.front,
          reading: c.reading,
          meaningTh: c.meaningTh,
          meaningEn: c.meaningEn,
          pos: c.cardType === "kanji" ? "คันจิ (FSRS)" : "คำศัพท์ในคลัง",
          jlpt: jlptTag,
          pitch: c.pitch,
          exampleSentence: c.exampleSentence,
          exampleReading: c.exampleReading,
          exampleMeaningTh: c.exampleMeaningTh,
          notes: c.mnemonic,
          sourceLabel: "คลัง FSRS ของคุณ",
          tags: c.tags,
          inUserDeck: true,
        };
      });
      setUserCards(mapped);
    })();
    return () => {
      active = false;
    };
  }, []);

  const unifiedVocab = useMemo(() => {
    const byKey = new Map<string, UnifiedVocabEntry>();

    for (const c of userCards) {
      byKey.set(`${c.word}|${c.reading}`, c);
    }

    for (const v of CORE_VOCAB) {
      const key = `${v.word}|${v.reading}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          id: `core:${v.id}`,
          word: v.word,
          reading: v.reading,
          meaningTh: v.meaningTh,
          meaningEn: v.meaningEn,
          pos: v.pos,
          jlpt: v.jlpt,
          pitch: v.pitch,
          exampleSentence: v.exampleSentence,
          exampleReading: v.exampleReading,
          exampleMeaningTh: v.exampleMeaningTh,
          notes: v.notes,
          sourceLabel: "หลักสูตรหลัก",
          tags: [v.jlpt, v.category],
          inUserDeck: false,
        });
      }
    }

    for (const lesson of MINNA_LESSONS) {
      for (const mv of lesson.vocab) {
        const key = `${mv.word}|${mv.reading}`;
        if (!byKey.has(key)) {
          byKey.set(key, {
            id: `minna:${lesson.lesson}:${mv.word}`,
            word: mv.word,
            reading: mv.reading,
            meaningTh: mv.meaningTh,
            pos: mv.pos,
            jlpt: lesson.jlpt,
            notes: mv.note,
            sourceLabel: `Minna บทที่ ${lesson.lesson}`,
            tags: ["Minna", `บทที่ ${lesson.lesson}`, lesson.jlpt],
            inUserDeck: false,
          });
        }
      }
    }

    return Array.from(byKey.values());
  }, [userCards]);

  const unifiedGrammar = useMemo<UnifiedGrammarEntry[]>(() => {
    const coreList: UnifiedGrammarEntry[] = CORE_GRAMMAR.map((g) => ({
      id: g.id,
      pattern: g.pattern,
      meaningTh: g.meaningTh,
      structure: g.structure,
      explanationTh: g.explanationTh,
      jlpt: g.jlpt,
      sourceLabel: "Core Curriculum",
      examples: g.examples,
    }));

    const minnaList: UnifiedGrammarEntry[] = MINNA_LESSONS.flatMap((lesson) =>
      lesson.grammarPoints.map((gp, idx) => ({
        id: `minna-g-${lesson.lesson}-${idx}`,
        pattern: gp.pattern,
        meaningTh: lesson.titleTh,
        structure: gp.structure,
        explanationTh: `${gp.explanationTh} (เคล็ดลับคนไทย: ${gp.tipForThaiTh})`,
        jlpt: lesson.jlpt,
        sourceLabel: `Minna บทที่ ${lesson.lesson}`,
        examples: gp.examples,
      }))
    );

    return [...coreList, ...minnaList];
  }, []);

  const hiraQuery = useMemo(() => {
    const q = query.trim();
    if (!q) return "";
    return /^[a-zA-Z\s]+$/.test(q) ? toHiragana(q) : q;
  }, [query]);

  const filteredVocab = useMemo(() => {
    const q = query.trim().toLowerCase();
    return unifiedVocab.filter((v) => {
      if (levelFilter !== "ALL" && v.jlpt !== levelFilter) return false;
      if (!q) return true;
      return (
        v.word.toLowerCase().includes(q) ||
        v.reading.toLowerCase().includes(q) ||
        (hiraQuery && v.reading.includes(hiraQuery)) ||
        v.meaningTh.toLowerCase().includes(q) ||
        (v.meaningEn && v.meaningEn.toLowerCase().includes(q)) ||
        v.sourceLabel.toLowerCase().includes(q)
      );
    });
  }, [unifiedVocab, query, hiraQuery, levelFilter]);

  const filteredKanji = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CORE_KANJI.filter((k) => {
      if (levelFilter !== "ALL" && k.jlpt !== levelFilter) return false;
      if (!q) return true;
      return (
        k.kanji.includes(q) ||
        k.meaningTh.toLowerCase().includes(q) ||
        k.meaningEn.toLowerCase().includes(q) ||
        k.onyomi.some((o) => o.includes(q)) ||
        k.kunyomi.some((ku) => ku.includes(q) || (hiraQuery && ku.includes(hiraQuery)))
      );
    });
  }, [query, hiraQuery, levelFilter]);

  const filteredGrammar = useMemo(() => {
    const q = query.trim().toLowerCase();
    return unifiedGrammar.filter((g) => {
      if (levelFilter !== "ALL" && g.jlpt !== levelFilter) return false;
      if (!q) return true;
      return (
        g.pattern.toLowerCase().includes(q) ||
        g.meaningTh.toLowerCase().includes(q) ||
        g.explanationTh.toLowerCase().includes(q) ||
        g.sourceLabel.toLowerCase().includes(q)
      );
    });
  }, [unifiedGrammar, query, levelFilter]);

  const handleAddVocab = async (v: UnifiedVocabEntry) => {
    await mineCardToSrs({
      front: v.word,
      reading: v.reading,
      meaningTh: v.meaningTh,
      meaningEn: v.meaningEn,
      pitch: v.pitch,
      exampleSentence: v.exampleSentence,
      exampleReading: v.exampleReading,
      exampleMeaningTh: v.exampleMeaningTh,
      mnemonic: v.notes,
      cardType: "vocab",
      tags: Array.from(new Set([...v.tags, v.jlpt])),
    });
    setAddedIds((prev) => new Set(prev).add(v.id));
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold text-primary uppercase tracking-wider">
          Unified Reference & Kanji Practice
        </div>
        <h1 className="text-2xl font-bold mt-0.5">
          พจนานุกรม คันจิ (Radicals + คัดลายมือ) & ไวยากรณ์
        </h1>
        <p className="text-sm text-foreground/70 mt-1">
          รวมคำศัพท์หลัก, Minna no Nihongo ครบ 50 บท และการ์ด FSRS ของคุณในที่เดียว พร้อมกรองตามระดับ JLPT
        </p>
      </div>

      {/* Search + Tabs + JLPT Filter */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-foreground/45 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาคำศัพท์, คันจิ, ความหมาย, หรือพิมพ์ Romaji เช่น taberu, naruhodo..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="inline-flex rounded-xl border border-border bg-surface p-1 self-start">
            {[
              { id: "vocab", label: `คำศัพท์ (${filteredVocab.length})` },
              { id: "kanji", label: `คันจิ (${filteredKanji.length})` },
              { id: "grammar", label: `ไวยากรณ์ (${filteredGrammar.length})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id as DictTab)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  tab === t.id
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/70 hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-foreground/60 mr-1">ระดับ JLPT:</span>
          {LEVEL_FILTERS.map((lv) => (
            <button
              key={lv.id}
              type="button"
              onClick={() => setLevelFilter(lv.id)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                levelFilter === lv.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface text-foreground/65 hover:text-foreground"
              }`}
            >
              {lv.label}
            </button>
          ))}
        </div>
      </div>

      {/* VOCAB LIST */}
      {tab === "vocab" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredVocab.slice(0, 80).map((v) => {
            const isAdded = v.inUserDeck || addedIds.has(v.id);
            return (
              <div
                key={v.id}
                className="rounded-2xl border border-border bg-surface p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-jp text-2xl font-bold">{v.word}</span>
                      <span className="font-jp text-sm text-primary">{v.reading}</span>
                    </div>
                    <div className="text-sm font-semibold mt-1">{v.meaningTh}</div>
                    <div className="text-xs text-foreground/55 mt-0.5">
                      {v.meaningEn ? `${v.meaningEn} • ` : ""}
                      {v.pos} • {v.jlpt} • <span className="text-primary">{v.sourceLabel}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <SpeakButton text={v.word} />
                    <button
                      type="button"
                      onClick={() => void handleAddVocab(v)}
                      disabled={isAdded}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-muted disabled:opacity-80 text-xs font-medium cursor-pointer"
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-matcha" />
                          <span className="text-matcha">ใน FSRS</span>
                        </>
                      ) : (
                        <>
                          <PlusCircle className="w-3.5 h-3.5 text-primary" />
                          <span>FSRS</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {typeof v.pitch === "number" && (
                  <PitchAccentChart reading={v.reading} pitch={v.pitch} compact />
                )}

                {hasBuiltInVisual(v.word, v.tags) && (
                  <VocabVisualCard word={v.word} tags={v.tags} compact />
                )}

                {v.exampleSentence && (
                  <div className="rounded-xl bg-surface-muted p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-jp font-medium">{v.exampleSentence}</span>
                      <SpeakButton text={v.exampleSentence} />
                    </div>
                    {v.exampleMeaningTh && (
                      <div className="text-foreground/70">{v.exampleMeaningTh}</div>
                    )}
                  </div>
                )}

                {v.notes && (
                  <div className="text-xs text-foreground/75 bg-gold/5 border border-gold/20 rounded-lg px-3 py-2 flex items-start gap-2">
                    <Lightbulb className="w-3.5 h-3.5 text-gold shrink-0 mt-0.5" />
                    <span>{v.notes}</span>
                  </div>
                )}
              </div>
            );
          })}

          {filteredVocab.length > 80 && (
            <div className="md:col-span-2 text-center text-xs text-foreground/60 py-2">
              แสดง 80 รายการแรกจากทั้งหมด {filteredVocab.length} รายการ — พิมพ์คำค้นเพื่อเจาะจงเพิ่มเติม
            </div>
          )}

          {filteredVocab.length === 0 && (
            <div className="md:col-span-2 rounded-2xl border border-border bg-surface p-8 text-center text-sm text-foreground/65">
              ไม่พบคำศัพท์ที่ตรงกับเงื่อนไขการค้นหา ลองเปลี่ยนระดับ JLPT เป็น &ldquo;ทั้งหมด&rdquo; หรือค้นหาด้วยคำอ่าน
            </div>
          )}
        </div>
      )}

      {/* KANJI LIST */}
      {tab === "kanji" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredKanji.map((k) => {
            const practiceOpen = activeKanjiPractice === k.kanji;
            return (
              <div
                key={k.id}
                className="rounded-2xl border border-border bg-surface p-5 space-y-3"
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-jp text-4xl font-bold shrink-0">
                    {k.kanji}
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-base">{k.meaningTh}</div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs px-2 py-0.5 rounded bg-surface-muted">
                          {k.jlpt} • {k.strokes} ขีด
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveKanjiPractice(practiceOpen ? null : k.kanji)
                          }
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium cursor-pointer transition-colors ${
                            practiceOpen
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background hover:bg-surface-muted"
                          }`}
                        >
                          <PenTool className="w-3 h-3" />
                          <span>{practiceOpen ? "ปิดกระดาน" : "ฝึกคัด"}</span>
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-foreground/60">{k.meaningEn}</div>
                    <div className="text-xs font-jp text-foreground/80">
                      On: {k.onyomi.join(", ") || "-"} | Kun: {k.kunyomi.join(", ") || "-"}
                    </div>
                  </div>
                </div>

                {practiceOpen && (
                  <KanaWritingCanvas
                    key={k.kanji}
                    char={k.kanji}
                    strokesCount={k.strokes}
                    label="ฝึกคัดคันจิ"
                  />
                )}

                <div className="flex flex-wrap gap-1.5 text-xs">
                  <span className="text-foreground/60">Radicals:</span>
                  {k.radicals.map((r) => (
                    <span key={r} className="px-2 py-0.5 rounded bg-surface-muted font-jp">
                      {r}
                    </span>
                  ))}
                </div>

                <div className="rounded-xl bg-gold/5 border border-gold/25 p-3 text-xs leading-relaxed">
                  <span className="font-semibold text-gold inline-flex items-center gap-1 mr-1">
                    <Sparkles className="w-3 h-3" /> Mnemonic:
                  </span>
                  {k.mnemonicTh}
                </div>

                {hasBuiltInVisual(k.kanji) && (
                  <VocabVisualCard word={k.kanji} compact />
                )}

                <div className="space-y-1.5">
                  {k.examples.map((ex) => (
                    <div
                      key={ex.word}
                      className="flex items-center justify-between text-xs bg-surface-muted rounded-lg px-3 py-1.5"
                    >
                      <span>
                        <strong className="font-jp">{ex.word}</strong>{" "}
                        <span className="font-jp text-foreground/65">({ex.reading})</span> —{" "}
                        {ex.meaningTh}
                      </span>
                      <SpeakButton text={ex.word} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* GRAMMAR LIST */}
      {tab === "grammar" && (
        <div className="space-y-4">
          {filteredGrammar.map((g) => (
            <div
              key={g.id}
              className="rounded-2xl border border-border bg-surface p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-jp text-xl font-bold text-primary">
                    {g.pattern}
                  </h2>
                  <p className="text-sm font-semibold">{g.meaningTh}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-medium">
                    {g.sourceLabel}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-surface-muted font-medium">
                    {g.jlpt}
                  </span>
                </div>
              </div>

              <div className="text-xs font-mono bg-surface-muted px-3 py-2 rounded-lg">
                โครงสร้าง: {g.structure}
              </div>

              <p className="text-sm text-foreground/80 leading-relaxed">
                {g.explanationTh}
              </p>

              <div className="space-y-2">
                {g.examples.map((ex) => (
                  <div
                    key={ex.jp}
                    className="rounded-xl border border-border p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-jp text-sm font-semibold">{ex.jp}</div>
                      <div className="font-jp text-xs text-foreground/60">
                        {ex.reading}
                      </div>
                      <div className="text-xs text-foreground/80 mt-0.5">{ex.th}</div>
                    </div>
                    <SpeakButton text={ex.jp} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
