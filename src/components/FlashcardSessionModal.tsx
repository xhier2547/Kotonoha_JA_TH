"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  RotateCcw,
  X,
} from "lucide-react";
import {
  bulkMineMinnaVocab,
  db,
  getAppSettings,
  getLocalDayKey,
} from "@/lib/db";
import {
  getCardRetrievability,
  previewFsrsCard,
  reviewFsrsCard,
  type PreviewOption,
} from "@/lib/fsrs";
import type { MinnaVocabItem } from "@/data/minnaNoNihongoPart1";
import type { SrsCardRecord } from "@/types/learning";
import { SpeakButton } from "@/components/SpeakButton";
import { PitchAccentChart } from "@/components/PitchAccentChart";
import { VocabVisualCard, hasBuiltInVisual } from "@/components/VocabVisualCard";
import { MemoryCurvePanel } from "@/components/MemoryCurvePanel";
import {
  CrestSealIcon,
  FlashcardDeckIcon,
  MemoryCurveIcon,
} from "@/components/LuxuryIcons";
import { speakJapanese } from "@/lib/speech";

interface FlashcardSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessonNum: number;
  lessonTitle: string;
  vocab: MinnaVocabItem[];
  onCardsUpdated?: () => void;
}

export function FlashcardSessionModal({
  isOpen,
  onClose,
  lessonNum,
  lessonTitle,
  vocab,
  onCardsUpdated,
}: FlashcardSessionModalProps) {
  const [cards, setCards] = useState<SrsCardRecord[]>([]);
  const [queue, setQueue] = useState<SrsCardRecord[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [showCurve, setShowCurve] = useState(false);
  const [previews, setPreviews] = useState<PreviewOption[]>([]);
  const [retention, setRetention] = useState(0.9);
  const [doneCount, setDoneCount] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mining, setMining] = useState(false);

  const chapterTag = `บทที่ ${lessonNum}`;

  const loadChapterDeck = useCallback(
    async (cramAll = false) => {
      setLoading(true);
      const [settings, all] = await Promise.all([
        getAppSettings(),
        db.cards.toArray(),
      ]);
      const tNow = Date.now();
      const chapterCards = all.filter((c) => c.tags.includes(chapterTag));
      const sorted = [...chapterCards].sort((a, b) => a.dueAtMs - b.dueAtMs);
      const q = cramAll
        ? sorted
        : sorted.filter((c) => c.fsrs.reps === 0 || c.dueAtMs <= tNow);

      setRetention(settings.desiredRetention);
      setCards(chapterCards);
      setQueue(q.length > 0 ? q : sorted);
      setFlipped(false);
      setDoneCount(0);
      setNowMs(tNow);
      setLoading(false);
    },
    [chapterTag]
  );

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    void (async () => {
      const [settings, all] = await Promise.all([
        getAppSettings(),
        db.cards.toArray(),
      ]);
      if (!active) return;
      const tNow = Date.now();
      const chapterCards = all.filter((c) => c.tags.includes(chapterTag));
      const sorted = [...chapterCards].sort((a, b) => a.dueAtMs - b.dueAtMs);
      const dueOrNew = sorted.filter(
        (c) => c.fsrs.reps === 0 || c.dueAtMs <= tNow
      );
      setRetention(settings.desiredRetention);
      setCards(chapterCards);
      setQueue(dueOrNew.length > 0 ? dueOrNew : sorted);
      setFlipped(false);
      setDoneCount(0);
      setShowCurve(false);
      setNowMs(tNow);
    })();
    return () => {
      active = false;
    };
  }, [isOpen, chapterTag]);

  const currentCard = queue[0];

  useEffect(() => {
    if (!isOpen || !currentCard) return;
    let active = true;
    void previewFsrsCard(currentCard.fsrs, retention).then((items) => {
      if (active) setPreviews(items);
    });
    return () => {
      active = false;
    };
  }, [isOpen, currentCard, retention]);

  const handleGrade = useCallback(
    async (rating: 1 | 2 | 3 | 4) => {
      if (!currentCard) return;
      const now = new Date();
      const { updated, scheduledDays, dueAtMs } = await reviewFsrsCard(
        currentCard.fsrs,
        rating,
        retention,
        now
      );

      const updatedRecord: SrsCardRecord = {
        ...currentCard,
        fsrs: updated,
        dueAtMs,
      };

      await db.cards.put(updatedRecord);
      await db.reviewLogs.add({
        cardId: currentCard.id,
        rating,
        reviewedAt: now.toISOString(),
        dayKey: getLocalDayKey(now),
        scheduledDays,
      });

      setDoneCount((n) => n + 1);
      setFlipped(false);
      setNowMs(now.getTime());
      setCards((prev) =>
        prev.map((c) => (c.id === updatedRecord.id ? updatedRecord : c))
      );
      setQueue((prev) => {
        const rest = prev.slice(1);
        return rating === 1 ? [...rest, updatedRecord] : rest;
      });
      onCardsUpdated?.();
    },
    [currentCard, retention, onCardsUpdated]
  );

  // Keyboard shortcuts while modal is open
  useEffect(() => {
    if (!isOpen || !currentCard) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.code === "Space" && !flipped) {
        e.preventDefault();
        setFlipped(true);
        speakJapanese(currentCard.front);
      } else if (flipped) {
        if (e.key === "1") void handleGrade(1);
        if (e.key === "2") void handleGrade(2);
        if (e.key === "3") void handleGrade(3);
        if (e.key === "4") void handleGrade(4);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, currentCard, flipped, handleGrade, onClose]);

  const handleMineAndStart = async () => {
    setMining(true);
    await bulkMineMinnaVocab(lessonNum, vocab);
    await loadChapterDeck(true);
    onCardsUpdated?.();
    setMining(false);
  };

  if (!isOpen) return null;

  const currentRet =
    currentCard && nowMs > 0
      ? getCardRetrievability(currentCard.fsrs, nowMs)
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-fade-up"
      role="dialog"
      aria-modal="true"
      aria-label={`ทบทวนแฟลชการ์ด บทที่ ${lessonNum}`}
    >
      <div className="relative w-full max-w-2xl rounded-3xl border border-border bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Bar */}
        <div className="px-5 py-4 border-b border-border bg-surface-muted/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <FlashcardDeckIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                Flashcard &bull; บทที่ {lessonNum}
              </div>
              <div className="text-sm font-bold truncate">{lessonTitle}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {currentCard && (
              <button
                type="button"
                onClick={() => setShowCurve((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                  showCurve
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-surface border-border text-foreground/75 hover:bg-surface-muted"
                }`}
              >
                <MemoryCurveIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Memory Curve</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl border border-border bg-surface hover:bg-surface-muted text-foreground/70 cursor-pointer"
              aria-label="ปิดหน้าต่าง"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {loading ? (
            <div className="py-12 text-center text-sm text-foreground/60">
              กำลังโหลดชุดแฟลชการ์ดบทที่ {lessonNum}...
            </div>
          ) : cards.length === 0 ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <FlashcardDeckIcon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold">
                  ยังไม่มีคำศัพท์ของบทที่ {lessonNum} ในคลังแฟลชการ์ด
                </h3>
                <p className="text-xs sm:text-sm text-foreground/70 max-w-md mx-auto">
                  กดปุ่มด้านล่างเพื่อนำคำศัพท์ทั้ง {vocab.length} คำในบทที่ {lessonNum}{" "}
                  เข้าสู่ระบบ FSRS-7 พร้อมตาราง Memory Curve (ทบทวนอัตโนมัติ 1 &rarr; 2 &rarr; 5 &rarr; 14 วัน)
                </p>
              </div>
              <button
                type="button"
                disabled={mining}
                onClick={() => void handleMineAndStart()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:opacity-95 cursor-pointer disabled:opacity-50"
              >
                <FlashcardDeckIcon className="w-4 h-4" />
                <span>
                  {mining
                    ? "กำลังเตรียมแฟลชการ์ด..."
                    : `สร้างแฟลชการ์ด ${vocab.length} คำ & เริ่มทบทวน`}
                </span>
              </button>
            </div>
          ) : !currentCard ? (
            <div className="py-8 text-center space-y-4 animate-card-enter">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-matcha/15 text-matcha flex items-center justify-center">
                <CrestSealIcon className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold">
                  ทบทวนแฟลชการ์ดบทที่ {lessonNum} ครบแล้ว!
                </h3>
                <p className="text-xs sm:text-sm text-foreground/70">
                  คุณทบทวนไป {doneCount} ใบในเซสชันนี้ ระบบ FSRS-7 คำนวณรอบถัดไปตาม Memory Curve ให้เรียบร้อยแล้ว
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => void loadChapterDeck(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-background hover:bg-surface-muted text-xs font-medium cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>ทบทวนทั้งบทซ้ำอีกครั้ง ({cards.length} ใบ)</span>
                </button>
                <Link
                  href={`/srs?tag=${encodeURIComponent(chapterTag)}`}
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:opacity-95"
                >
                  <span>เปิดในคลัง FSRS เต็มหน้าจอ</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div key={currentCard.id} className="space-y-4 animate-card-enter">
              {/* Session Progress Bar */}
              <div className="flex items-center justify-between text-xs text-foreground/65">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold">
                    {chapterTag}
                  </span>
                  {currentRet !== null ? (
                    <span className="px-2 py-0.5 rounded-md bg-surface-muted font-mono text-[11px]">
                      ความจำ {Math.round(currentRet * 100)}% &bull; S:{" "}
                      {currentCard.fsrs.stability.toFixed(1)}d
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-gold/10 text-gold font-medium text-[11px]">
                      การ์ดใหม่ในบทนี้
                    </span>
                  )}
                </div>
                <span className="font-mono">
                  เหลือ {queue.length} ใบ &bull; ผ่าน {doneCount}
                </span>
              </div>

              {showCurve && (
                <MemoryCurvePanel
                  focusedCard={currentCard}
                  nowMs={nowMs}
                  desiredRetention={retention}
                />
              )}

              {/* 3D Flip Card */}
              <div className="flashcard-scene">
                <div
                  className={`flashcard-inner grid grid-cols-1 items-stretch ${
                    flipped ? "is-flipped" : ""
                  }`}
                >
                  {/* FRONT FACE */}
                  <div
                    aria-hidden={flipped}
                    className={`col-start-1 row-start-1 flashcard-face rounded-2xl border border-border bg-gradient-to-b from-surface to-surface-muted/40 p-6 sm:p-8 shadow-sm flex flex-col justify-between ${
                      flipped ? "pointer-events-none" : ""
                    }`}
                  >
                    <div className="min-h-[210px] flex flex-col items-center justify-center text-center space-y-4">
                      <div className="text-[11px] uppercase tracking-widest text-foreground/45 font-medium">
                        Front &bull; กด Space หรือปุ่มด้านล่างเพื่อพลิกการ์ด
                      </div>
                      <div
                        className={`font-jp font-bold tracking-tight ${
                          currentCard.cardType === "sentence"
                            ? "text-2xl sm:text-3xl leading-relaxed"
                            : "text-4xl sm:text-5xl"
                        }`}
                      >
                        {currentCard.front}
                      </div>
                      <SpeakButton text={currentCard.front} label="ฟังเสียง" />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setFlipped(true);
                        speakJapanese(currentCard.front);
                      }}
                      className="mt-4 w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium inline-flex items-center justify-center gap-2 hover:opacity-95 transition-all cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>พลิกดูเฉลย (Space)</span>
                    </button>
                  </div>

                  {/* BACK FACE */}
                  <div
                    aria-hidden={!flipped}
                    className={`col-start-1 row-start-1 flashcard-face-back rounded-2xl border border-primary/25 bg-surface p-5 sm:p-6 shadow-md space-y-4 flex flex-col justify-between ${
                      !flipped ? "pointer-events-none" : ""
                    }`}
                  >
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
                        <div>
                          <div className="font-jp text-xs text-foreground/50">
                            {currentCard.front}
                          </div>
                          <div className="font-jp text-lg font-semibold text-primary mt-0.5">
                            {currentCard.reading}
                          </div>
                          <div className="text-xl font-bold mt-0.5">
                            {currentCard.meaningTh}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {typeof currentCard.pitch === "number" && (
                            <PitchAccentChart
                              reading={currentCard.reading}
                              pitch={currentCard.pitch}
                              compact
                            />
                          )}
                          <SpeakButton text={currentCard.front} />
                        </div>
                      </div>

                      {(currentCard.imageDataUrl ||
                        hasBuiltInVisual(
                          currentCard.visualKey || currentCard.front,
                          currentCard.tags
                        )) && (
                        <VocabVisualCard
                          word={currentCard.front}
                          visualKey={currentCard.visualKey}
                          imageDataUrl={currentCard.imageDataUrl}
                          tags={currentCard.tags}
                          compact
                        />
                      )}

                      {currentCard.exampleSentence && (
                        <div className="rounded-xl bg-surface-muted/70 p-3 text-xs space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-jp font-medium text-sm">
                              {currentCard.exampleSentence}
                            </span>
                            <SpeakButton text={currentCard.exampleSentence} />
                          </div>
                          {currentCard.exampleMeaningTh && (
                            <div className="text-foreground/75">
                              {currentCard.exampleMeaningTh}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* FSRS Rating Buttons */}
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-[11px] text-foreground/55">
                        <span>ประเมินความจำ (คีย์ลัด 1–4)</span>
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-matcha" />
                          <span>คำนวณรอบทวนถัดไปตาม Memory Curve</span>
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {previews.map((opt) => {
                          const styleMap: Record<number, string> = {
                            1: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20",
                            2: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20",
                            3: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20",
                            4: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20",
                          };
                          return (
                            <button
                              key={opt.rating}
                              type="button"
                              onClick={() => void handleGrade(opt.rating)}
                              className={`rounded-xl border p-2.5 text-center transition-all hover:-translate-y-0.5 cursor-pointer ${
                                styleMap[opt.rating]
                              }`}
                            >
                              <div className="text-xs font-bold">{opt.labelTh}</div>
                              <div className="text-[11px] opacity-85 mt-0.5 font-mono">
                                {opt.intervalLabel}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
