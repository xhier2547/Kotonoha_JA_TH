"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toHiragana } from "wanakana";
import {
  AlertTriangle,
  BookCheck,
  BookOpen,
  Check,
  CheckCircle2,
  Languages,
  ListChecks,
  MessageSquare,
  Mic,
  NotebookPen,
  PlusCircle,
  Search,
  Sparkles,
  Square,
  Volume2,
} from "lucide-react";
import { MINNA_LESSONS, type MinnaLesson } from "@/data/minnaNoNihongo";
import {
  bulkMineMinnaGrammar,
  bulkMineMinnaVocab,
  db,
  enqueueShadowing,
  ensureSeeded,
  getAppSettings,
  getLearningSummary,
  getMinnaProgressMap,
  mineCardToSrs,
  saveMinnaLessonProgress,
} from "@/lib/db";
import { fetchJapaneseReading, translateJaToTh } from "@/lib/localTranslate";
import { SpeakButton } from "@/components/SpeakButton";
import { VocabVisualCard, hasBuiltInVisual } from "@/components/VocabVisualCard";
import { FlashcardSessionModal } from "@/components/FlashcardSessionModal";
import { FlashcardDeckIcon } from "@/components/LuxuryIcons";
import { StudyPageHero } from "@/components/StudyPageHero";
import { inferSpeakerGender } from "@/lib/dialogueParser";
import { speakJapaneseDialogue, stopSpeaking } from "@/lib/speech";
import type { MinnaProgressRecord, SrsCardRecord } from "@/types/learning";

type LessonSubTab = "grammar" | "vocab" | "kaiwa" | "quiz";

export default function MinnaPage() {
  const router = useRouter();
  const [activeLessonNum, setActiveLessonNum] = useState(1);
  const [subTab, setSubTab] = useState<LessonSubTab>("grammar");
  const [lessonSearch, setLessonSearch] = useState("");
  const [progressMap, setProgressMap] = useState<Record<number, MinnaProgressRecord>>({});
  const [knownFronts, setKnownFronts] = useState<Set<string>>(new Set());
  const [customLessonCards, setCustomLessonCards] = useState<SrsCardRecord[]>([]);

  // Bulk & Single Mining feedback
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [flashcardOpen, setFlashcardOpen] = useState(false);

  // Add vocab from book form
  const [bookWord, setBookWord] = useState("");
  const [bookReading, setBookReading] = useState("");
  const [bookMeaning, setBookMeaning] = useState("");
  const [bookNote, setBookNote] = useState("");
  const [bookTranslating, setBookTranslating] = useState(false);
  const [bookSaveNotice, setBookSaveNotice] = useState<string | null>(null);
  const [useRomajiIme, setUseRomajiIme] = useState(false);

  // Lesson quiz & notes state
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [lessonNoteDraft, setLessonNoteDraft] = useState("");
  const [noteSavedNotice, setNoteSavedNotice] = useState(false);
  const [playingKaiwaTurn, setPlayingKaiwaTurn] = useState<number | null>(null);

  const initialLessonAppliedRef = useRef(false);

  const fetchMinnaData = useCallback(async (lessonNum: number) => {
    await ensureSeeded();
    const [pMap, summary, allCards, settings] = await Promise.all([
      getMinnaProgressMap(),
      getLearningSummary(),
      db.cards.toArray(),
      getAppSettings(),
    ]);
    const chapterTag = `บทที่ ${lessonNum}`;
    return {
      pMap,
      settings,
      knownFronts: summary.knownFronts,
      customCards: allCards.filter(
        (c) => c.tags.includes("Minna") && c.tags.includes(chapterTag)
      ),
      note: pMap[lessonNum]?.notes ?? "",
    };
  }, []);

  const loadMinnaData = useCallback(
    async (lessonNum: number) => {
      const data = await fetchMinnaData(lessonNum);
      setProgressMap(data.pMap);
      setKnownFronts(data.knownFronts);
      setCustomLessonCards(data.customCards);
      setLessonNoteDraft(data.note);
    },
    [fetchMinnaData]
  );

  useEffect(() => {
    let active = true;
    void fetchMinnaData(activeLessonNum).then((data) => {
      if (!active) return;
      if (!initialLessonAppliedRef.current) {
        initialLessonAppliedRef.current = true;
        if (
          Object.keys(data.pMap).length === 0 &&
          data.settings.learnerLevel !== "N5" &&
          activeLessonNum === 1
        ) {
          setActiveLessonNum(26);
          return;
        }
      }
      setProgressMap(data.pMap);
      setKnownFronts(data.knownFronts);
      setCustomLessonCards(data.customCards);
      setLessonNoteDraft(data.note);
    });
    return () => {
      active = false;
    };
  }, [activeLessonNum, fetchMinnaData]);

  const activeLesson: MinnaLesson = useMemo(
    () =>
      MINNA_LESSONS.find((l) => l.lesson === activeLessonNum) ?? MINNA_LESSONS[0],
    [activeLessonNum]
  );

  const filteredLessons = useMemo(() => {
    const q = lessonSearch.trim().toLowerCase();
    if (!q) return MINNA_LESSONS;
    return MINNA_LESSONS.filter(
      (l) =>
        `บทที่ ${l.lesson}`.includes(q) ||
        String(l.lesson) === q ||
        l.titleTh.toLowerCase().includes(q) ||
        l.titleJp.includes(q) ||
        l.summaryTh.toLowerCase().includes(q) ||
        l.grammarPoints.some((g) => g.pattern.toLowerCase().includes(q))
    );
  }, [lessonSearch]);

  const completedCount = useMemo(
    () => Object.values(progressMap).filter((p) => p.completed).length,
    [progressMap]
  );

  const handleSelectLesson = (num: number) => {
    setActiveLessonNum(num);
    setBulkStatus(null);
    setBookSaveNotice(null);
    setQuizAnswers({});
    setNoteSavedNotice(false);
  };

  const handleToggleCompleted = async () => {
    const current = Boolean(progressMap[activeLessonNum]?.completed);
    const saved = await saveMinnaLessonProgress(activeLessonNum, {
      completed: !current,
    });
    setProgressMap((prev) => ({ ...prev, [activeLessonNum]: saved }));
  };

  const handleBulkMineLesson = async () => {
    setBulkLoading(true);
    setBulkStatus(null);
    try {
      const res = await bulkMineMinnaVocab(activeLessonNum, activeLesson.vocab);
      await loadMinnaData(activeLessonNum);
      setBulkStatus(
        res.added > 0
          ? `เพิ่มศัพท์ใหม่ ${res.added} คำจากบทที่ ${activeLessonNum} ลงคลัง FSRS แล้ว!`
          : `คำศัพท์ทั้ง ${res.total} คำของบทที่ ${activeLessonNum} อยู่ในคลัง FSRS แล้ว`
      );
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkMineGrammarLesson = async () => {
    setBulkLoading(true);
    setBulkStatus(null);
    try {
      const res = await bulkMineMinnaGrammar(
        activeLessonNum,
        activeLesson.jlpt,
        activeLesson.grammarPoints
      );
      await loadMinnaData(activeLessonNum);
      setBulkStatus(
        res.added > 0
          ? `เพิ่มไวยากรณ์ใหม่ ${res.added} รูปแบบจากบทที่ ${activeLessonNum} ลงคลัง FSRS แล้ว!`
          : `ไวยากรณ์ทั้ง ${res.total} รูปแบบของบทที่ ${activeLessonNum} อยู่ในคลัง FSRS แล้ว`
      );
    } finally {
      setBulkLoading(false);
    }
  };

  const handleMineSingleGrammar = async (
    gp: MinnaLesson["grammarPoints"][number]
  ) => {
    const firstEx = gp.examples[0];
    const res = await mineCardToSrs({
      front: gp.pattern,
      reading: gp.structure,
      meaningTh: gp.explanationTh,
      mnemonic: gp.tipForThaiTh,
      exampleSentence: firstEx?.jp,
      exampleReading: firstEx?.reading,
      exampleMeaningTh: firstEx?.th,
      cardType: "grammar",
      tags: ["Minna", `บทที่ ${activeLessonNum}`, "Grammar", activeLesson.jlpt],
    });
    await loadMinnaData(activeLessonNum);
    setBulkStatus(
      res.created
        ? `เพิ่มไวยากรณ์ "${gp.pattern}" ลงคลัง FSRS แล้ว!`
        : `ไวยากรณ์ "${gp.pattern}" อยู่ในคลัง FSRS แล้ว`
    );
  };

  const handleMineSingleWord = async (v: MinnaLesson["vocab"][number]) => {
    await mineCardToSrs({
      front: v.word,
      reading: v.reading,
      meaningTh: v.meaningTh,
      visualKey: v.word,
      cardType: "vocab",
      tags: ["Minna", `บทที่ ${activeLessonNum}`, v.pos],
    });
    await loadMinnaData(activeLessonNum);
  };

  const handleMineExampleSentence = async (jp: string, reading: string, th: string) => {
    await mineCardToSrs({
      front: jp,
      reading,
      meaningTh: th,
      cardType: "sentence",
      tags: ["Minna", `บทที่ ${activeLessonNum}`, activeLesson.jlpt],
    });
    await loadMinnaData(activeLessonNum);
    setBulkStatus(`บันทึกประโยค "${jp}" ลง FSRS แล้ว!`);
  };

  const handleSendToShadowing = async (jp: string, reading: string, th: string) => {
    const saved = await enqueueShadowing({
      title: `Minna บทที่ ${activeLessonNum}`,
      level: activeLesson.jlpt,
      style: activeLessonNum === 20 ? "กันเอง (タメ口)" : "สุภาพ (丁寧語)",
      japanese: jp,
      reading,
      meaningTh: th,
      nuanceTh: activeLesson.titleTh,
    });
    router.push(`/shadowing?queueId=${encodeURIComponent(saved.id)}`);
  };

  const handleAutoFillBookWord = async () => {
    if (!bookWord.trim()) return;
    setBookTranslating(true);
    try {
      const [reading, translated] = await Promise.all([
        fetchJapaneseReading(bookWord.trim()),
        translateJaToTh(bookWord.trim()),
      ]);
      if (reading) setBookReading(reading);
      if (translated?.translation) setBookMeaning(translated.translation);
    } finally {
      setBookTranslating(false);
    }
  };

  const handleSaveBookWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookWord.trim() || !bookMeaning.trim()) return;
    const cleanWord = bookWord.trim();
    const res = await mineCardToSrs({
      front: cleanWord,
      reading: bookReading.trim() || cleanWord,
      meaningTh: bookMeaning.trim(),
      mnemonic: bookNote.trim() || undefined,
      visualKey: cleanWord,
      cardType: "vocab",
      tags: ["Minna", `บทที่ ${activeLessonNum}`, "จากหนังสือ"],
    });
    setBookWord("");
    setBookReading("");
    setBookMeaning("");
    setBookNote("");
    setBookSaveNotice(
      res.created
        ? `เก็บคำว่า "${cleanWord}" เข้าบทที่ ${activeLessonNum} และคลัง FSRS แล้ว!`
        : `คำว่า "${cleanWord}" มีอยู่ในคลังแล้ว`
    );
    await loadMinnaData(activeLessonNum);
  };

  const handleSaveLessonNotes = async () => {
    const saved = await saveMinnaLessonProgress(activeLessonNum, {
      notes: lessonNoteDraft,
    });
    setProgressMap((prev) => ({ ...prev, [activeLessonNum]: saved }));
    setNoteSavedNotice(true);
    setTimeout(() => setNoteSavedNotice(false), 2000);
  };

  const isCompleted = Boolean(progressMap[activeLessonNum]?.completed);

  return (
    <div className="space-y-6">
      <StudyPageHero
        tone="amber"
        kanjiWatermark="日本"
        eyebrow="Textbook Companion • みんなの日本語 (เล่ม 1–2)"
        title="คู่มือเรียนตามหนังสือ Minna no Nihongo"
        subtitle="อ่านหนังสือคู่กับเว็บได้ทันที: สรุปไวยากรณ์ภาษาไทยแบบเจาะลึก จุดที่คนไทยมักพลาด คำศัพท์ประจำบท และเก็บศัพท์/ไวยากรณ์เข้า FSRS"
        actions={
          <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-xs shrink-0 space-y-1.5 backdrop-blur-xs">
            <div className="font-semibold flex items-center justify-between gap-4 text-white">
              <span>ความคืบหน้าหนังสือ</span>
              <span className="text-amber-200 font-bold">
                {completedCount} / {MINNA_LESSONS.length} บท
              </span>
            </div>
            <div className="w-44 h-2 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-300 to-emerald-400 transition-all"
                style={{
                  width: `${Math.round((completedCount / MINNA_LESSONS.length) * 100)}%`,
                }}
              />
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: Chapter Selector */}
        <div className="lg:col-span-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-foreground/45 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={lessonSearch}
              onChange={(e) => setLessonSearch(e.target.value)}
              placeholder="ค้นหาบท หรือไวยากรณ์ (เช่น รูป て, 14, あげます)..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="rounded-2xl border border-border bg-surface p-2 space-y-1 max-h-[620px] overflow-y-auto">
            {filteredLessons.map((l) => {
              const active = l.lesson === activeLessonNum;
              const done = Boolean(progressMap[l.lesson]?.completed);
              return (
                <button
                  key={l.lesson}
                  type="button"
                  onClick={() => handleSelectLesson(l.lesson)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 transition-colors cursor-pointer flex items-start gap-2.5 ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-surface-muted text-foreground"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                      active
                        ? "bg-white/20 text-white"
                        : done
                          ? "bg-matcha/15 text-matcha"
                          : "bg-surface-muted text-foreground/75"
                    }`}
                  >
                    {done ? <Check className="w-3.5 h-3.5" /> : l.lesson}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 text-[10px] opacity-80">
                      <span>{l.book}</span>
                      <span>{l.jlpt}</span>
                    </div>
                    <div className="text-xs font-semibold line-clamp-1 mt-0.5">
                      {l.titleTh}
                    </div>
                    <div className="font-jp text-[11px] opacity-75 truncate">
                      {l.titleJp}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Workspace: Active Lesson */}
        <div className="lg:col-span-8 space-y-5">
          {/* Active Lesson Banner */}
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <span className="px-2 py-0.5 rounded-md bg-primary/10">
                    {activeLesson.book}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-surface-muted text-foreground/75">
                    {activeLesson.jlpt}
                  </span>
                  <span className="font-jp">{activeLesson.titleJp}</span>
                </div>
                <h2 className="text-xl font-bold mt-1.5">{activeLesson.titleTh}</h2>
                <p className="text-xs text-foreground/75 mt-1 leading-relaxed">
                  {activeLesson.summaryTh}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFlashcardOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium shadow-sm hover:opacity-95 transition-all hover:-translate-y-0.5 cursor-pointer"
                >
                  <FlashcardDeckIcon className="w-3.5 h-3.5" />
                  <span>ทบทวนแฟลชการ์ดบทนี้</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleToggleCompleted()}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                    isCompleted
                      ? "bg-matcha/15 border-matcha/40 text-matcha"
                      : "bg-background border-border hover:bg-surface-muted"
                  }`}
                >
                  <BookCheck className="w-3.5 h-3.5" />
                  <span>{isCompleted ? "เรียนจบบทนี้แล้ว" : "ทำเครื่องหมายว่าอ่านจบ"}</span>
                </button>
                <button
                  type="button"
                  disabled={bulkLoading}
                  onClick={() => void handleBulkMineLesson()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary text-xs font-medium hover:bg-primary/15 cursor-pointer disabled:opacity-50"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>
                    {bulkLoading ? "กำลังเก็บ..." : "เก็บศัพท์ทั้งบทเข้า FSRS"}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={bulkLoading}
                  onClick={() => void handleBulkMineGrammarLesson()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-background hover:bg-surface-muted text-xs font-medium cursor-pointer disabled:opacity-50"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-matcha" />
                  <span>เก็บไวยากรณ์ทั้งบทเข้า FSRS</span>
                </button>
              </div>
            </div>

            {bulkStatus && (
              <div className="text-xs text-matcha bg-matcha/10 border border-matcha/30 rounded-xl px-3 py-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{bulkStatus}</span>
              </div>
            )}

            {/* Sub-Tabs */}
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
              {[
                { id: "grammar", label: "รูปประโยค & ไวยากรณ์", icon: BookOpen },
                {
                  id: "vocab",
                  label: `คำศัพท์ & เก็บศัพท์ (${activeLesson.vocab.length + customLessonCards.length})`,
                  icon: Sparkles,
                },
                { id: "kaiwa", label: "บทสนทนาประจำบท", icon: MessageSquare },
                { id: "quiz", label: "เช็กความเข้าใจ & โน้ต", icon: ListChecks },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSubTab(t.id as LessonSubTab)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      subTab === t.id
                        ? "bg-foreground text-background"
                        : "bg-surface-muted/70 text-foreground/75 hover:bg-surface-muted"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SUBTAB 1: GRAMMAR GUIDE */}
          {subTab === "grammar" && (
            <div className="space-y-4">
              {activeLesson.grammarPoints.map((gp, idx) => {
                const grammarInSrs = knownFronts.has(gp.pattern);
                return (
                <div
                  key={idx}
                  className="rounded-2xl border border-border bg-surface p-5 space-y-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                        หัวข้อไวยากรณ์ {idx + 1}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleMineSingleGrammar(gp)}
                        className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-border bg-background hover:bg-surface-muted cursor-pointer"
                      >
                        {grammarInSrs ? (
                          <>
                            <Check className="w-3 h-3 text-matcha" />
                            <span className="text-matcha font-medium">เก็บไวยากรณ์แล้ว (FSRS)</span>
                          </>
                        ) : (
                          <>
                            <PlusCircle className="w-3 h-3 text-primary" />
                            <span>เก็บไวยากรณ์เข้า FSRS</span>
                          </>
                        )}
                      </button>
                    </div>
                    <h3 className="font-jp text-lg font-bold mt-0.5">{gp.pattern}</h3>
                    <div className="mt-2 rounded-xl bg-surface-muted px-3.5 py-2 font-jp text-xs text-foreground/85 border border-border">
                      <strong>โครงสร้าง:</strong> {gp.structure}
                    </div>
                  </div>

                  <p className="text-sm text-foreground/85 leading-relaxed">
                    {gp.explanationTh}
                  </p>

                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs text-foreground/85 flex items-start gap-2.5 leading-relaxed">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-amber-700 dark:text-amber-300">
                        ข้อควรระวังสำหรับคนไทย:{" "}
                      </strong>
                      {gp.tipForThaiTh}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="text-xs font-semibold text-foreground/65">
                      ประโยคตัวอย่างในบทเรียน (例文):
                    </div>
                    {gp.examples.map((ex, eIdx) => {
                      const alreadyMined = knownFronts.has(ex.jp);
                      return (
                        <div
                          key={eIdx}
                          className="rounded-xl border border-border bg-background p-3.5 space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-jp text-base font-semibold">
                                {ex.jp}
                              </div>
                              <div className="font-jp text-xs text-primary">
                                {ex.reading}
                              </div>
                              <div className="text-xs text-foreground/80 mt-0.5">
                                {ex.th}
                              </div>
                            </div>
                            <SpeakButton text={ex.jp} />
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                void handleMineExampleSentence(ex.jp, ex.reading, ex.th)
                              }
                              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-border bg-surface hover:bg-surface-muted cursor-pointer"
                            >
                              {alreadyMined ? (
                                <>
                                  <Check className="w-3 h-3 text-matcha" />
                                  <span className="text-matcha">อยู่ใน FSRS</span>
                                </>
                              ) : (
                                <>
                                  <PlusCircle className="w-3 h-3 text-primary" />
                                  <span>Mine ประโยค</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void handleSendToShadowing(ex.jp, ex.reading, ex.th)
                              }
                              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-border bg-surface hover:bg-surface-muted cursor-pointer"
                            >
                              <Mic className="w-3 h-3 text-matcha" />
                              <span>ฝึกพูด Shadowing</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {/* SUBTAB 2: VOCAB & BOOK CAPTURE */}
          {subTab === "vocab" && (
            <div className="space-y-5">
              {/* Quick capture vocab directly from physical textbook */}
              <form
                onSubmit={handleSaveBookWord}
                className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-primary">
                      + เก็บคำศัพท์เพิ่มเติมจากหนังสือ (บทที่ {activeLessonNum})
                    </div>
                    <p className="text-xs text-foreground/70">
                      เจอคำศัพท์ใหม่ในหนังสือ Minna หน้าไหน พิมพ์เก็บเข้าคลัง FSRS ของบทนี้ได้ทันที
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseRomajiIme((v) => !v)}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-mono cursor-pointer ${
                      useRomajiIme
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-surface border-border text-foreground/70"
                    }`}
                  >
                    Romaji &rarr; あ {useRomajiIme ? "เปิด" : "ปิด"}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    required
                    value={bookWord}
                    onChange={(e) =>
                      setBookWord(
                        useRomajiIme
                          ? toHiragana(e.target.value, { IMEMode: true })
                          : e.target.value
                      )
                    }
                    placeholder="คำศัพท์ญี่ปุ่น (เช่น 新幹線)"
                    className="px-3 py-2 rounded-xl border border-border bg-surface text-sm font-jp"
                  />
                  <input
                    type="text"
                    value={bookReading}
                    onChange={(e) =>
                      setBookReading(
                        useRomajiIme
                          ? toHiragana(e.target.value, { IMEMode: true })
                          : e.target.value
                      )
                    }
                    placeholder="คำอ่านฮิรางานะ (เช่น しんかんせん)"
                    className="px-3 py-2 rounded-xl border border-border bg-surface text-sm font-jp"
                  />
                  <input
                    type="text"
                    required
                    value={bookMeaning}
                    onChange={(e) => setBookMeaning(e.target.value)}
                    placeholder="ความหมายไทย"
                    className="px-3 py-2 rounded-xl border border-border bg-surface text-sm"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={bookNote}
                    onChange={(e) => setBookNote(e.target.value)}
                    placeholder="โน้ตช่วยจำ / เลขหน้าในหนังสือ (ไม่บังคับ)"
                    className="flex-1 px-3 py-2 rounded-xl border border-border bg-surface text-xs"
                  />
                  <button
                    type="button"
                    disabled={bookTranslating || !bookWord.trim()}
                    onClick={() => void handleAutoFillBookWord()}
                    className="px-3 py-2 rounded-xl border border-primary/30 bg-surface text-primary text-xs font-medium inline-flex items-center justify-center gap-1.5 hover:bg-primary/10 cursor-pointer disabled:opacity-50"
                  >
                    <Languages className="w-3.5 h-3.5" />
                    <span>{bookTranslating ? "กำลังแปล..." : "อ่าน+แปลอัตโนมัติ"}</span>
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium inline-flex items-center justify-center gap-1.5 hover:opacity-95 cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>เก็บลง FSRS</span>
                  </button>
                </div>

                {bookSaveNotice && (
                  <div className="text-xs text-matcha font-medium">{bookSaveNotice}</div>
                )}
              </form>

              {/* Built-in vocab list */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeLesson.vocab.map((v) => {
                  const saved = knownFronts.has(v.word);
                  return (
                    <div
                      key={v.word}
                      className="rounded-xl border border-border bg-surface p-4 flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-jp text-lg font-bold">{v.word}</span>
                          {v.reading !== v.word && (
                            <span className="font-jp text-xs text-primary">
                              {v.reading}
                            </span>
                          )}
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-muted text-foreground/65">
                            {v.pos}
                          </span>
                        </div>
                        <div className="text-sm text-foreground/85">{v.meaningTh}</div>
                        {hasBuiltInVisual(v.word) && (
                          <div className="pt-1.5">
                            <VocabVisualCard word={v.word} compact />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <SpeakButton text={v.word} />
                        <button
                          type="button"
                          onClick={() => void handleMineSingleWord(v)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-background hover:bg-surface-muted text-[11px] font-medium cursor-pointer"
                        >
                          {saved ? (
                            <>
                              <Check className="w-3 h-3 text-matcha" />
                              <span className="text-matcha">ใน FSRS</span>
                            </>
                          ) : (
                            <>
                              <PlusCircle className="w-3 h-3 text-primary" />
                              <span>+ เก็บ</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* User's saved cards for this lesson */}
              {customLessonCards.length > 0 && (
                <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
                  <div className="text-xs font-semibold text-foreground/70">
                    ศัพท์ที่บันทึกไว้ใน FSRS สำหรับบทที่ {activeLessonNum} ({customLessonCards.length} รายการ)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {customLessonCards.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl border border-border bg-background px-3 py-2.5 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-jp font-bold text-sm truncate">
                            {c.front}{" "}
                            <span className="font-normal text-primary text-xs">
                              ({c.reading})
                            </span>
                          </div>
                          <div className="text-foreground/75 truncate">{c.meaningTh}</div>
                        </div>
                        <SpeakButton text={c.front} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUBTAB 3: DIALOGUE */}
          {subTab === "kaiwa" && (
            <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-primary">
                    会話 • บทสนทนาตัวอย่างประจำบทที่ {activeLessonNum}
                  </div>
                  <div className="text-xs text-foreground/65 mt-0.5">
                    กดฟังบทสนทนาต่อเนื่องแยกเสียงผู้พูด หรือกดฝึก Shadowing ทีละประโยค
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (playingKaiwaTurn !== null) {
                      stopSpeaking();
                      setPlayingKaiwaTurn(null);
                      return;
                    }
                    const turns = activeLesson.miniKaiwa.map((line, idx) => ({
                      speakerLabel: line.speaker,
                      gender: inferSpeakerGender(line.speaker, idx),
                      text: line.jp,
                    }));
                    void speakJapaneseDialogue(turns, {
                      onTurnChange: (idx) => setPlayingKaiwaTurn(idx),
                      onDone: () => setPlayingKaiwaTurn(null),
                    });
                  }}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                    playingKaiwaTurn !== null
                      ? "bg-rose-600 text-white"
                      : "bg-primary text-primary-foreground hover:opacity-95"
                  }`}
                >
                  {playingKaiwaTurn !== null ? (
                    <>
                      <Square className="w-3.5 h-3.5" />
                      <span>หยุดเล่นบทสนทนา</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4" />
                      <span>ฟังบทสนทนาทั้งบท (Multi-Voice)</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-3">
                {activeLesson.miniKaiwa.map((line, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border p-4 flex items-start justify-between gap-3 transition-colors ${
                      playingKaiwaTurn === i
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-primary">
                        {line.speaker}
                      </div>
                      <div className="font-jp text-base font-medium">{line.jp}</div>
                      <div className="font-jp text-xs text-foreground/60">
                        {line.reading}
                      </div>
                      <div className="text-xs text-foreground/85 pt-0.5">
                        {line.th}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <SpeakButton text={line.jp} />
                      <button
                        type="button"
                        onClick={() =>
                          void handleSendToShadowing(line.jp, line.reading, line.th)
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border bg-surface hover:bg-surface-muted text-[11px] cursor-pointer"
                      >
                        <Mic className="w-3 h-3 text-matcha" />
                        <span>Shadowing</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUBTAB 4: QUIZ & NOTES */}
          {subTab === "quiz" && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
                <div className="text-sm font-bold">
                  แบบทดสอบสั้นเช็กความเข้าใจ — บทที่ {activeLessonNum}
                </div>
                {activeLesson.quiz.map((q, qIdx) => {
                  const qKey = `${activeLessonNum}-${qIdx}`;
                  const picked = quizAnswers[qKey];
                  const isCorrect = picked === q.answer;
                  return (
                    <div
                      key={qKey}
                      className="rounded-xl border border-border bg-background p-4 space-y-3"
                    >
                      <div className="text-xs font-medium text-foreground/80">
                        {qIdx + 1}. {q.promptTh}
                      </div>
                      <div className="font-jp text-lg font-bold">
                        {q.jpBefore}
                        <span className="inline-block mx-1.5 px-2.5 py-0.5 rounded-lg border border-dashed border-primary text-primary">
                          {picked ?? "？"}
                        </span>
                        {q.jpAfter}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {q.choices.map((ch) => (
                          <button
                            key={ch}
                            type="button"
                            onClick={() =>
                              setQuizAnswers((prev) => ({ ...prev, [qKey]: ch }))
                            }
                            className={`px-3.5 py-1.5 rounded-lg border font-jp text-sm cursor-pointer transition-colors ${
                              picked === ch
                                ? ch === q.answer
                                  ? "bg-matcha/15 border-matcha text-matcha font-bold"
                                  : "bg-accent/15 border-accent text-accent"
                                : picked && ch === q.answer
                                  ? "bg-matcha/10 border-matcha/50 text-matcha"
                                  : "bg-surface border-border hover:bg-surface-muted"
                            }`}
                          >
                            {ch}
                          </button>
                        ))}
                      </div>
                      {picked && (
                        <div
                          className={`text-xs rounded-lg p-2.5 ${
                            isCorrect
                              ? "bg-matcha/10 text-matcha"
                              : "bg-accent/10 text-accent"
                          }`}
                        >
                          {isCorrect ? "ถูกต้อง! " : `เฉลยคือ ${q.answer} — `}
                          {q.explainTh}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Personal Study Notes per Chapter */}
              <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <NotebookPen className="w-4 h-4 text-primary" />
                    <span>สมุดโน้ตส่วนตัว (บทที่ {activeLessonNum})</span>
                  </div>
                  {noteSavedNotice && (
                    <span className="text-xs text-matcha font-medium">
                      บันทึกโน้ตแล้ว!
                    </span>
                  )}
                </div>
                <textarea
                  rows={4}
                  value={lessonNoteDraft}
                  onChange={(e) => setLessonNoteDraft(e.target.value)}
                  placeholder="จดสรุปจากหนังสือ Minna หน้าไหนที่ยังงง หรือตัวอย่างประโยคที่คิดเอง..."
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleSaveLessonNotes()}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:opacity-95 cursor-pointer"
                  >
                    บันทึกโน้ตบทนี้
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <FlashcardSessionModal
        isOpen={flashcardOpen}
        onClose={() => setFlashcardOpen(false)}
        lessonNum={activeLesson.lesson}
        lessonTitle={activeLesson.titleTh}
        vocab={activeLesson.vocab}
        onCardsUpdated={() => void loadMinnaData(activeLessonNum)}
      />
    </div>
  );
}
