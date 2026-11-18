"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toHiragana } from "wanakana";
import {
  BookMarked,
  CheckCircle2,
  Download,
  Dumbbell,
  Eye,
  Flame,
  Headphones,
  ImagePlus,
  ListChecks,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import {
  db,
  emitDbMutated,
  ensureSeeded,
  getAppSettings,
  getLocalDayKey,
  mineCardToSrs,
  updateCardImage,
} from "@/lib/db";
import {
  getCardRetrievability,
  previewFsrsCard,
  reviewFsrsCard,
  type PreviewOption,
} from "@/lib/fsrs";
import {
  CONJUGATION_FORM_INFO,
  conjugateWord,
  type ConjugationForm,
} from "@/lib/conjugation";
import { CONJUGATION_BANK, PARTICLE_CLOZE_BANK } from "@/data/coreCurriculum";
import { PitchAccentChart } from "@/components/PitchAccentChart";
import { SpeakButton } from "@/components/SpeakButton";
import { VocabVisualCard, hasBuiltInVisual } from "@/components/VocabVisualCard";
import { MemoryCurvePanel } from "@/components/MemoryCurvePanel";
import {
  CrestSealIcon,
  FlashcardDeckIcon,
  MemoryCurveIcon,
} from "@/components/LuxuryIcons";
import {
  compressImageFileToDataUrl,
  extractImageFromClipboard,
  requestGeneratedVocabImage,
} from "@/lib/imageUtils";
import { speakJapanese } from "@/lib/speech";
import {
  cardsToAnkiTsv,
  cardsToCsv,
  parseDelimitedDeck,
  type ImportedCardRow,
} from "@/lib/deckPortability";
import { sortFreshCardsByLevel } from "@/lib/studyPlan";
import { getJlptLevelBadgeStyle } from "@/lib/gamification";
import {
  FloatingXpToast,
  HankoStampBadge,
  SakuraConfettiBurst,
} from "@/components/CelebrationEffects";
import { StudyPageHero } from "@/components/StudyPageHero";
import { SlideTabs } from "@/components/ui21/SlideTabs";
import type { CardType, JlptLevel, SrsCardRecord } from "@/types/learning";

type SrsTab = "review" | "curve" | "conjugation" | "particles" | "deck";
type TypeFilter = "all" | CardType;

const ALL_FORMS: ConjugationForm[] = [
  "masu",
  "nai",
  "te",
  "ta",
  "tai",
  "potential",
  "volitional",
  "ba",
];

export default function SrsPage() {
  const [tab, setTab] = useState<SrsTab>("review");
  const [filterType, setFilterType] = useState<TypeFilter>("all");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [typingMode, setTypingMode] = useState(false);
  const [audioFirstMode, setAudioFirstMode] = useState(false);
  const [showCardCurve, setShowCardCurve] = useState(false);

  // FSRS Review Queue State
  const [queue, setQueue] = useState<SrsCardRecord[]>([]);
  const [allCards, setAllCards] = useState<SrsCardRecord[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [typedResult, setTypedResult] = useState<"idle" | "match" | "mismatch">("idle");
  const [previews, setPreviews] = useState<PreviewOption[]>([]);
  const [retention, setRetention] = useState(0.9);
  const [sessionDone, setSessionDone] = useState(0);
  const [lastXpEarned, setLastXpEarned] = useState(0);
  const [xpToastKey, setXpToastKey] = useState(0);
  const [loading, setLoading] = useState(true);

  // Conjugation Trainer State
  const [selectedForms, setSelectedForms] = useState<ConjugationForm[]>([
    "masu",
    "nai",
    "te",
    "ta",
  ]);
  const [conjItem, setConjItem] = useState(CONJUGATION_BANK[0]);
  const [conjForm, setConjForm] = useState<ConjugationForm>("te");
  const [conjInput, setConjInput] = useState("");
  const [conjStatus, setConjStatus] = useState<"idle" | "correct" | "wrong">("idle");
  const [conjStreak, setConjStreak] = useState(0);
  const conjInputRef = useRef<HTMLInputElement>(null);

  // Deck Search & Add Modal
  const [deckSearch, setDeckSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFront, setNewFront] = useState("");
  const [newReading, setNewReading] = useState("");
  const [newMeaning, setNewMeaning] = useState("");
  const [newExample, setNewExample] = useState("");
  const [newImageDataUrl, setNewImageDataUrl] = useState<string | undefined>(
    undefined
  );
  const [generatingImg, setGeneratingImg] = useState(false);
  const [imageGenError, setImageGenError] = useState<string | null>(null);
  const [deckPortNotice, setDeckPortNotice] = useState<string | null>(null);
  const [deckImporting, setDeckImporting] = useState(false);

  // Particle Cloze Drill State
  const [clozeIdx, setClozeIdx] = useState(0);
  const [clozePicked, setClozePicked] = useState<string | null>(null);
  const [clozeStreak, setClozeStreak] = useState(0);
  const [clozeStats, setClozeStats] = useState({ correct: 0, total: 0 });

  const [renderNowMs, setRenderNowMs] = useState<number>(0);

  const loadCards = useCallback(async () => {
    await ensureSeeded();
    const settings = await getAppSettings();
    const cards = await db.cards.toArray();
    const nowMs = Date.now();
    const filtered = cards.filter((c) => {
      if (filterType !== "all" && c.cardType !== filterType) return false;
      if (tagFilter && !c.tags.includes(tagFilter)) return false;
      return true;
    });

    const due = filtered
      .filter((c) => c.fsrs.reps > 0 && c.dueAtMs <= nowMs)
      .sort((a, b) => a.dueAtMs - b.dueAtMs);

    const fresh = sortFreshCardsByLevel(
      filtered.filter((c) => c.fsrs.reps === 0),
      settings.learnerLevel
    ).slice(0, tagFilter ? 50 : settings.dailyNewCards);

    setRetention(settings.desiredRetention);
    setAllCards(cards);
    setRenderNowMs(nowMs);
    setQueue([...due, ...fresh]);
    setFlipped(false);
    setTypedAnswer("");
    setTypedResult("idle");
    setLoading(false);
  }, [filterType, tagFilter]);

  const initializedTagRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      await ensureSeeded();
      if (!initializedTagRef.current) {
        initializedTagRef.current = true;
        const urlTag = new URLSearchParams(window.location.search).get("tag");
        if (urlTag) {
          if (active) setTagFilter(urlTag);
          return;
        }
      }
      const settings = await getAppSettings();
      const cards = await db.cards.toArray();
      if (!active) return;
      const nowMs = Date.now();
      const filtered = cards.filter((c) => {
        if (filterType !== "all" && c.cardType !== filterType) return false;
        if (tagFilter && !c.tags.includes(tagFilter)) return false;
        return true;
      });

      const due = filtered
        .filter((c) => c.fsrs.reps > 0 && c.dueAtMs <= nowMs)
        .sort((a, b) => a.dueAtMs - b.dueAtMs);

      const fresh = sortFreshCardsByLevel(
        filtered.filter((c) => c.fsrs.reps === 0),
        settings.learnerLevel
      ).slice(0, tagFilter ? 50 : settings.dailyNewCards);

      setRetention(settings.desiredRetention);
      setAllCards(cards);
      setRenderNowMs(nowMs);
      setQueue([...due, ...fresh]);
      setFlipped(false);
      setTypedAnswer("");
      setTypedResult("idle");
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [filterType, tagFilter]);

  const currentCard = queue[0];

  useEffect(() => {
    if (!currentCard) return;
    let active = true;
    previewFsrsCard(currentCard.fsrs, retention).then((items) => {
      if (active) setPreviews(items);
    });
    return () => {
      active = false;
    };
  }, [currentCard, retention]);

  const activePreviews = currentCard ? previews : [];

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
      emitDbMutated();

      setSessionDone((n) => n + 1);
      setLastXpEarned(rating >= 3 ? 15 : 10);
      setXpToastKey((k) => k + 1);
      setFlipped(false);
      setTypedAnswer("");
      setTypedResult("idle");

      // If Again (1), re-queue card at the end of current session
      setQueue((prev) => {
        const rest = prev.slice(1);
        return rating === 1 ? [...rest, updatedRecord] : rest;
      });
    },
    [currentCard, retention]
  );

  // Keyboard shortcuts for Review
  useEffect(() => {
    if (tab !== "review" || !currentCard) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      if (e.code === "Space" && !flipped) {
        e.preventDefault();
        setFlipped(true);
        speakJapanese(currentCard.front);
      } else if (flipped) {
        if (e.key === "1") handleGrade(1);
        if (e.key === "2") handleGrade(2);
        if (e.key === "3") handleGrade(3);
        if (e.key === "4") handleGrade(4);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tab, currentCard, flipped, handleGrade]);

  const handleCheckTypedReading = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCard) return;
    const normalizedInput = toHiragana(typedAnswer.trim());
    const validReadings = currentCard.reading
      .split(/[/、,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const isMatch =
      normalizedInput === currentCard.front ||
      validReadings.some((r) => toHiragana(r) === normalizedInput);

    setTypedResult(isMatch ? "match" : "mismatch");
    setFlipped(true);
    speakJapanese(currentCard.front);
  };

  // Conjugation helpers
  const nextConjugation = useCallback(
    (formsPool = selectedForms) => {
      const pool = formsPool.length > 0 ? formsPool : ALL_FORMS;
      const validItems = CONJUGATION_BANK.filter((item) => {
        if (item.wordClass === "i-adj" || item.wordClass === "na-adj") {
          return pool.some((f) => ["masu", "nai", "te", "ta", "ba"].includes(f));
        }
        return true;
      });
      const pickItem = validItems[Math.floor(Math.random() * validItems.length)];
      const compatibleForms =
        pickItem.wordClass === "i-adj" || pickItem.wordClass === "na-adj"
          ? pool.filter((f) => ["masu", "nai", "te", "ta", "ba"].includes(f))
          : pool;
      const pickForm =
        compatibleForms[Math.floor(Math.random() * compatibleForms.length)] ?? "masu";

      setConjItem(pickItem);
      setConjForm(pickForm);
      setConjInput("");
      setConjStatus("idle");
      requestAnimationFrame(() => {
        conjInputRef.current?.focus();
      });
    },
    [selectedForms]
  );

  const conjExpectedKanji = useMemo(
    () => conjugateWord(conjItem.dictForm, conjItem.wordClass, conjForm),
    [conjItem, conjForm]
  );
  const conjExpectedKana = useMemo(
    () => conjugateWord(conjItem.reading, conjItem.wordClass, conjForm),
    [conjItem, conjForm]
  );

  const handleCheckConjugation = (e: React.FormEvent) => {
    e.preventDefault();
    if (conjStatus !== "idle") {
      nextConjugation();
      return;
    }
    const inputClean = toHiragana(conjInput.trim());
    if (!inputClean) return;

    const isCorrect =
      inputClean === conjExpectedKanji.answer ||
      inputClean === conjExpectedKana.answer ||
      conjInput.trim() === conjExpectedKanji.answer;

    setConjStatus(isCorrect ? "correct" : "wrong");
    setConjStreak((s) => (isCorrect ? s + 1 : 0));
    speakJapanese(conjExpectedKanji.answer);
  };

  const toggleFormSelection = (form: ConjugationForm) => {
    setSelectedForms((prev) => {
      const exists = prev.includes(form);
      const next = exists ? prev.filter((f) => f !== form) : [...prev, form];
      return next.length > 0 ? next : [form];
    });
  };

  const handleAddCustomCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newMeaning.trim()) return;
    await mineCardToSrs({
      front: newFront.trim(),
      reading: toHiragana(newReading.trim() || newFront.trim()),
      meaningTh: newMeaning.trim(),
      exampleSentence: newExample.trim() || undefined,
      imageDataUrl: newImageDataUrl,
      visualKey: newFront.trim(),
      cardType: "vocab",
      tags: ["Custom"],
    });
    setNewFront("");
    setNewReading("");
    setNewMeaning("");
    setNewExample("");
    setNewImageDataUrl(undefined);
    setShowAddForm(false);
    await loadCards();
  };

  const handleAttachCardImage = async (cardId: string, file: Blob | null) => {
    if (!file) return;
    const dataUrl = await compressImageFileToDataUrl(file);
    await updateCardImage(cardId, dataUrl);
    setQueue((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, imageDataUrl: dataUrl } : c))
    );
    setAllCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, imageDataUrl: dataUrl } : c))
    );
  };

  const handleRemoveCardImage = async (cardId: string) => {
    await updateCardImage(cardId, undefined);
    setQueue((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, imageDataUrl: undefined } : c))
    );
    setAllCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, imageDataUrl: undefined } : c))
    );
  };

  const handleGenerateCardImage = async (card: SrsCardRecord) => {
    if (generatingImg) return;
    setGeneratingImg(true);
    setImageGenError(null);
    try {
      const settings = await getAppSettings();
      const dataUrl = await requestGeneratedVocabImage({
        word: card.front,
        reading: card.reading,
        meaningTh: card.meaningTh,
        meaningEn: card.meaningEn,
        provider: settings.aiProvider,
        apiKey: settings.apiKey,
      });
      await updateCardImage(card.id, dataUrl);
      setQueue((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, imageDataUrl: dataUrl } : c))
      );
      setAllCards((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, imageDataUrl: dataUrl } : c))
      );
    } catch (err) {
      setImageGenError(err instanceof Error ? err.message : "สร้างรูปไม่สำเร็จ");
    } finally {
      setGeneratingImg(false);
    }
  };

  const activeCloze = PARTICLE_CLOZE_BANK[clozeIdx % PARTICLE_CLOZE_BANK.length];
  const handlePickParticle = (choice: string) => {
    if (clozePicked !== null) return;
    setClozePicked(choice);
    const ok = choice === activeCloze.answer;
    setClozeStats((s) => ({
      correct: s.correct + (ok ? 1 : 0),
      total: s.total + 1,
    }));
    setClozeStreak((st) => (ok ? st + 1 : 0));
    speakJapanese(`${activeCloze.before}${activeCloze.answer}${activeCloze.after}`);
  };
  const nextParticleCloze = () => {
    setClozePicked(null);
    setClozeIdx((i) => (i + 1) % PARTICLE_CLOZE_BANK.length);
  };

  const filteredDeckCards = useMemo(() => {
    const q = deckSearch.trim().toLowerCase();
    return allCards.filter((c) => {
      if (filterType !== "all" && c.cardType !== filterType) return false;
      if (tagFilter && !c.tags.includes(tagFilter)) return false;
      if (!q) return true;
      return (
        c.front.toLowerCase().includes(q) ||
        c.reading.toLowerCase().includes(q) ||
        c.meaningTh.toLowerCase().includes(q)
      );
    });
  }, [allCards, deckSearch, filterType, tagFilter]);

  const handleExportDeckFile = (kind: "csv" | "anki") => {
    const targetList = filteredDeckCards.length > 0 ? filteredDeckCards : allCards;
    const content =
      kind === "csv" ? cardsToCsv(targetList) : cardsToAnkiTsv(targetList);
    const mime = kind === "csv" ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8";
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      kind === "csv"
        ? `kotonoha-deck-${new Date().toISOString().slice(0, 10)}.csv`
        : `kotonoha-anki-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setDeckPortNotice(
      `ส่งออก ${targetList.length} การ์ดเป็น ${kind === "csv" ? "CSV" : "Anki TSV (.txt)"} เรียบร้อยแล้ว`
    );
  };

  const handleImportDeckFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setDeckImporting(true);
    setDeckPortNotice(null);
    try {
      let rows: ImportedCardRow[] = [];
      if (file.name.toLowerCase().endsWith(".apkg")) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/import/apkg", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "นำเข้าไฟล์ .apkg ไม่สำเร็จ");
        rows = json.cards as ImportedCardRow[];
      } else {
        const text = await file.text();
        rows = parseDelimitedDeck(text);
      }

      if (rows.length === 0) {
        setDeckPortNotice("ไม่พบแถวคำศัพท์ที่นำเข้าได้ในไฟล์นี้");
        return;
      }

      let added = 0;
      let skipped = 0;
      for (const r of rows) {
        const res = await mineCardToSrs({
          front: r.front,
          reading: r.reading,
          meaningTh: r.meaningTh,
          meaningEn: r.meaningEn,
          exampleSentence: r.exampleSentence,
          mnemonic: r.mnemonic,
          cardType: "vocab",
          tags: r.tags,
        });
        if (res.created) added += 1;
        else skipped += 1;
      }

      await loadCards();
      setDeckPortNotice(
        `นำเข้าเสร็จสิ้น: เพิ่มใหม่ ${added} การ์ด (ข้ามคำที่มีอยู่แล้ว ${skipped} คำ)`
      );
    } catch (err) {
      setDeckPortNotice(
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดระหว่างนำเข้าไฟล์"
      );
    } finally {
      setDeckImporting(false);
    }
  };

  const fadingCards = useMemo(() => {
    if (renderNowMs <= 0) return [];
    return allCards
      .filter((c) => c.fsrs.reps > 0)
      .map((c) => ({
        card: c,
        ret: getCardRetrievability(c.fsrs, renderNowMs) ?? 1,
      }))
      .sort((a, b) => a.ret - b.ret)
      .slice(0, 12);
  }, [allCards, renderNowMs]);

  return (
    <div className="space-y-6">
      <StudyPageHero
        tone="violet"
        kanjiWatermark="記憶"
        eyebrow="Phase 2 • FSRS-7 Memory Engine & Muscle Memory"
        title="คลังสมอง FSRS & ฝึกผันกริยา"
        subtitle="ทบทวนศัพท์ คันจิ ไวยากรณ์ และประโยคด้วยอัลกอริทึม FSRS-7 + ฝึกผันกริยาให้คล่องปาก"
        actions={
          <SlideTabs<SrsTab>
            variant="hero"
            value={tab}
            onChange={setTab}
            items={[
              { id: "review", label: "ทบทวนแฟลชการ์ด", icon: FlashcardDeckIcon },
              { id: "curve", label: "Memory Curve", icon: MemoryCurveIcon },
              { id: "conjugation", label: "ฝึกผันกริยา", icon: Dumbbell },
              { id: "particles", label: "ฝึกคำช่วย (助詞)", icon: ListChecks },
              { id: "deck", label: "คลังการ์ด", icon: BookMarked },
            ]}
          />
        }
      />

      {/* Filter Bar for Review & Deck */}
      {(tab === "review" || tab === "deck") && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {tagFilter && (
              <button
                type="button"
                onClick={() => setTagFilter("")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/15 text-primary border border-primary/30 hover:bg-primary/20 cursor-pointer"
              >
                <span>แท็ก: {tagFilter}</span>
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
            {[
              { id: "all", label: "ทั้งหมด" },
              { id: "vocab", label: "คำศัพท์" },
              { id: "kanji", label: "คันจิ (Radicals)" },
              { id: "grammar", label: "ไวยากรณ์" },
              { id: "sentence", label: "ประโยคที่ Mine" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterType(f.id as TypeFilter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${filterType === f.id
                  ? "bg-foreground text-background border-foreground"
                  : "bg-surface border-border text-foreground/70 hover:bg-surface-muted"
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {tab === "review" && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCardCurve((v) => !v)}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${showCardCurve
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-surface border-border text-foreground/75 hover:bg-surface-muted"
                  }`}
              >
                <MemoryCurveIcon className="w-3.5 h-3.5" />
                <span>กราฟความจำการ์ดนี้</span>
              </button>
              <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer select-none px-3 py-1.5 rounded-lg border border-border bg-surface">
                <input
                  type="checkbox"
                  checked={audioFirstMode}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setAudioFirstMode(next);
                    if (next && currentCard && !flipped) {
                      speakJapanese(currentCard.front);
                    }
                  }}
                  className="accent-primary"
                />
                <Headphones className="w-3.5 h-3.5 text-primary" />
                <span>ฟังก่อน (Audio-First)</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer select-none px-3 py-1.5 rounded-lg border border-border bg-surface">
                <input
                  type="checkbox"
                  checked={typingMode}
                  onChange={(e) => setTypingMode(e.target.checked)}
                  className="accent-primary"
                />
                <span>โหมดพิมพ์คำอ่าน</span>
              </label>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: FSRS REVIEW SESSION */}
      {tab === "review" && (
        <div className="max-w-2xl mx-auto">
          {loading ? (
            <div className="rounded-2xl border border-border bg-surface p-10 text-center text-sm text-foreground/60">
              กำลังโหลดคิวทบทวน FSRS-7...
            </div>
          ) : !currentCard ? (
            <div className="relative overflow-hidden rounded-2xl border border-matcha/35 bg-gradient-to-br from-matcha/10 via-surface to-amber-500/5 p-8 text-center space-y-4 animate-card-enter shadow-sm">
              <SakuraConfettiBurst active={sessionDone > 0} />
              <div className="flex items-center justify-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-matcha/15 text-matcha flex items-center justify-center">
                  <CrestSealIcon className="w-8 h-8" />
                </div>
                {sessionDone > 0 && (
                  <HankoStampBadge
                    kanji="完了"
                    subtitle={`+${sessionDone * 12} XP`}
                  />
                )}
              </div>
              <h2 className="text-xl font-bold">เคลียร์คิวทบทวนรอบนี้ครบแล้ว!</h2>
              <p className="text-sm text-foreground/70 max-w-md mx-auto">
                วันนี้คุณทบทวนไปแล้ว {sessionDone} ใบในเซสชันนี้ ระบบคำนวณรอบทบทวนถัดไปตาม Memory Curve ให้แล้วครับ
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    const freshExtra = allCards
                      .filter((c) => c.fsrs.reps === 0 && (!tagFilter || c.tags.includes(tagFilter)))
                      .slice(0, 10);
                    setQueue(freshExtra);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-border bg-surface hover:bg-surface-muted text-sm font-medium cursor-pointer"
                >
                  เรียนการ์ดใหม่เพิ่ม 10 ใบ
                </button>
                <button
                  type="button"
                  onClick={() => setTab("curve")}
                  className="px-4 py-2.5 rounded-xl border border-primary/30 bg-primary/10 text-primary text-sm font-medium cursor-pointer"
                >
                  ดูกราฟ Memory Curve
                </button>
                <button
                  type="button"
                  onClick={() => setTab("conjugation")}
                  className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium cursor-pointer"
                >
                  ไปฝึกผันกริยาต่อ &rarr;
                </button>
              </div>
            </div>
          ) : (
            <div key={currentCard.id} className="space-y-4 animate-card-enter">
              {/* Live Memory Curve Inspector (collapsible) */}
              {showCardCurve && (
                <MemoryCurvePanel
                  focusedCard={currentCard}
                  nowMs={renderNowMs}
                  desiredRetention={retention}
                />
              )}

              {/* 3D Flip Flashcard Container */}
              <div className="flashcard-scene">
                <div
                  className={`flashcard-inner grid grid-cols-1 items-stretch ${flipped ? "is-flipped" : ""
                    }`}
                >
                  {/* FRONT FACE */}
                  <div
                    aria-hidden={flipped}
                    onPaste={(e) => {
                      const img = extractImageFromClipboard(e.clipboardData);
                      if (img) {
                        e.preventDefault();
                        void handleAttachCardImage(currentCard.id, img);
                      }
                    }}
                    className={`col-start-1 row-start-1 flashcard-face rounded-2xl border border-border bg-gradient-to-b from-surface to-surface-muted/35 p-6 sm:p-8 shadow-sm flex flex-col justify-between gap-6 ${flipped ? "pointer-events-none" : ""
                      }`}
                  >
                    {/* Top Meta */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/60">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold uppercase">
                          {currentCard.cardType}
                        </span>
                        {currentCard.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className={`px-2 py-0.5 rounded-md border ${
                              /^N[1-5]$/.test(tag)
                                ? `${getJlptLevelBadgeStyle(tag as JlptLevel)} font-bold`
                                : "border-transparent bg-surface-muted"
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                        {(() => {
                          const r = getCardRetrievability(currentCard.fsrs, renderNowMs);
                          if (r === null) {
                            return (
                              <span className="px-2 py-0.5 rounded-md bg-gold/10 text-gold font-medium">
                                การ์ดใหม่
                              </span>
                            );
                          }
                          return (
                            <span className="px-2 py-0.5 rounded-md bg-matcha/10 text-matcha font-mono">
                              ความจำ {Math.round(r * 100)}%
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-2">
                        <FloatingXpToast xp={lastXpEarned} eventKey={xpToastKey} />
                        <span className="font-mono">
                          เหลือ {queue.length} ใบ &bull; ผ่าน {sessionDone}
                        </span>
                      </div>
                    </div>

                    {/* Center Prompt */}
                    <div className="text-center py-6 space-y-3 my-auto">
                      {audioFirstMode && !flipped ? (
                        <div className="py-6 space-y-3 rounded-2xl bg-primary/5 border border-primary/20">
                          <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary">
                            <Headphones className="w-4 h-4" />
                            <span>Listening Recall Mode — ฟังเสียงแล้วนึกคำและภาพก่อนเปิดเฉลย</span>
                          </div>
                          <div className="flex justify-center">
                            <SpeakButton text={currentCard.front} label="กดฟังเสียงคำนี้" size="md" />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div
                            className={`font-jp font-bold tracking-tight ${currentCard.cardType === "sentence"
                              ? "text-2xl sm:text-3xl leading-relaxed"
                              : "text-5xl sm:text-6xl"
                              }`}
                          >
                            {currentCard.front}
                          </div>
                          <div className="flex justify-center">
                            <SpeakButton text={currentCard.front} label="ฟังเสียง" />
                          </div>
                        </>
                      )}
                    </div>

                    {/* Action Area */}
                    <div>
                      {typingMode ? (
                        <form onSubmit={handleCheckTypedReading} className="space-y-3">
                          <input
                            type="text"
                            value={typedAnswer}
                            onChange={(e) =>
                              setTypedAnswer(toHiragana(e.target.value, { IMEMode: true }))
                            }
                            placeholder="พิมพ์คำอ่านเป็น Romaji (แปลงเป็นฮิรางานะอัตโนมัติ)..."
                            className="w-full text-center font-jp text-lg px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                          />
                          <button
                            type="submit"
                            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium cursor-pointer"
                          >
                            ตรวจคำอ่าน & ดูเฉลย
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setFlipped(true);
                            speakJapanese(currentCard.front);
                          }}
                          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 hover:opacity-95 transition-all hover:-translate-y-0.5 cursor-pointer shadow-xs"
                        >
                          <Eye className="w-4 h-4" />
                          <span>พลิกแฟลชการ์ดดูเฉลย (Space)</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* BACK FACE */}
                  <div
                    aria-hidden={!flipped}
                    onPaste={(e) => {
                      const img = extractImageFromClipboard(e.clipboardData);
                      if (img) {
                        e.preventDefault();
                        void handleAttachCardImage(currentCard.id, img);
                      }
                    }}
                    className={`col-start-1 row-start-1 flashcard-face-back rounded-2xl border border-primary/25 bg-surface p-6 sm:p-8 shadow-md flex flex-col justify-between space-y-4 ${!flipped ? "pointer-events-none" : ""
                      }`}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs text-foreground/60 pb-2 border-b border-border/70">
                        <span className="font-semibold text-primary">
                          เฉลย &bull; {currentCard.front}
                        </span>
                        <span className="font-mono">
                          Stability {currentCard.fsrs.stability.toFixed(1)}d &bull; Reps{" "}
                          {currentCard.fsrs.reps}
                        </span>
                      </div>

                      {typedResult !== "idle" && (
                        <div
                          className={`text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-2 ${typedResult === "match"
                            ? "bg-matcha/10 text-matcha"
                            : "bg-accent/10 text-accent"
                            }`}
                        >
                          {typedResult === "match" ? (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>พิมพ์คำอ่านถูกต้อง!</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4" />
                              <span>คำอ่านของคุณ: {typedAnswer || "(ว่าง)"}</span>
                            </>
                          )}
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="font-jp text-lg text-primary font-semibold">
                            {currentCard.reading}
                          </div>
                          <div className="text-xl font-bold mt-0.5">
                            {currentCard.meaningTh}
                          </div>
                          {currentCard.meaningEn && (
                            <div className="text-xs text-foreground/55">
                              {currentCard.meaningEn}
                            </div>
                          )}
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
                          />
                        )}

                      {imageGenError && (
                        <div className="text-[11px] text-rose-600 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1.5">
                          {imageGenError}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-foreground/60">
                        <span>
                          วางรูปภาพ (<kbd className="px-1 rounded bg-surface-muted">Ctrl+V</kbd>) หรือกดสร้างรูปใหม่
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            disabled={generatingImg}
                            onClick={() => void handleGenerateCardImage(currentCard)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 font-medium cursor-pointer disabled:opacity-50"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>{generatingImg ? "กำลังวาดรูป..." : "สร้างรูปใหม่ให้คำนี้"}</span>
                          </button>
                          {currentCard.imageDataUrl && (
                            <button
                              type="button"
                              onClick={() => void handleRemoveCardImage(currentCard.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>ลบรูป</span>
                            </button>
                          )}
                          <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border hover:bg-surface-muted cursor-pointer">
                            <ImagePlus className="w-3.5 h-3.5" />
                            <span>{currentCard.imageDataUrl ? "เปลี่ยนรูป" : "แนบรูป"}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0] ?? null;
                                void handleAttachCardImage(currentCard.id, file);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      </div>

                      {currentCard.radicals && currentCard.radicals.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 text-xs">
                          <span className="text-foreground/60">Radicals:</span>
                          {currentCard.radicals.map((r) => (
                            <span
                              key={r}
                              className="px-2 py-0.5 rounded-md bg-surface-muted font-jp"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      )}

                      {currentCard.mnemonic && (
                        <div className="rounded-xl bg-gold/5 border border-gold/25 p-3 text-xs leading-relaxed text-foreground/85">
                          <span className="font-semibold text-gold inline-flex items-center gap-1 mr-1">
                            <Sparkles className="w-3 h-3" /> ทริคจำ / หมายเหตุ:
                          </span>
                          {currentCard.mnemonic}
                        </div>
                      )}

                      {currentCard.exampleSentence && (
                        <div className="rounded-xl bg-surface-muted p-3.5 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-jp text-sm font-medium">
                              {currentCard.exampleSentence}
                            </span>
                            <SpeakButton text={currentCard.exampleSentence} />
                          </div>
                          {currentCard.exampleReading && (
                            <div className="font-jp text-xs text-foreground/60">
                              {currentCard.exampleReading}
                            </div>
                          )}
                          {currentCard.exampleMeaningTh && (
                            <div className="text-xs text-foreground/75">
                              {currentCard.exampleMeaningTh}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* FSRS Grade Buttons */}
                    <div className="pt-2">
                      <div className="text-[11px] text-foreground/55 text-center mb-2">
                        ประเมินความจำ (คีย์ลัด 1–4) &bull; FSRS-7 กำหนดรอบถัดไปตาม Memory Curve
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {activePreviews.map((opt) => {
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
                              onClick={() => handleGrade(opt.rating)}
                              className={`rounded-xl border p-2.5 text-center transition-all hover:-translate-y-0.5 cursor-pointer ${styleMap[opt.rating]
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
      )}

      {/* TAB: MEMORY CURVE ANALYTICS */}
      {tab === "curve" && (
        <div className="space-y-6 animate-fade-up">
          <MemoryCurvePanel
            cards={allCards}
            nowMs={renderNowMs}
            desiredRetention={retention}
            onStartFlashcard={() => setTab("review")}
            startLabel="เริ่มทบทวนแฟลชการ์ดตอนนี้"
          />

          <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold">
                  คำศัพท์ที่ความจำกำลังลดต่ำสุด (เสี่ยงลืมตาม Memory Curve)
                </h2>
                <p className="text-xs text-foreground/65">
                  เรียงลำดับจากเปอร์เซ็นต์ความจำคงเหลือ R(t) ต่ำที่สุด เพื่อให้คุณดึงกลับมาทบทวนทันเวลา
                </p>
              </div>
            </div>

            {fadingCards.length === 0 ? (
              <div className="rounded-xl bg-surface-muted/50 p-6 text-center text-xs text-foreground/65">
                ยังไม่มีประวัติการทบทวน ลองเปิดแท็บ &ldquo;ทบทวนแฟลชการ์ด&rdquo; เพื่อเริ่มสร้างเส้นโค้งความจำของคุณครับ
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {fadingCards.map(({ card, ret }) => {
                  const pct = Math.round(ret * 100);
                  return (
                    <div
                      key={card.id}
                      className="studio-card rounded-xl border border-border bg-background/80 p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-jp font-bold text-base truncate">
                            {card.front}
                          </span>
                          <span className="font-jp text-xs text-primary truncate">
                            {card.reading}
                          </span>
                        </div>
                        <div className="text-xs text-foreground/75 truncate">
                          {card.meaningTh}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-foreground/55 font-mono pt-0.5">
                          <span>ความจำ {pct}%</span>
                          <span>&bull;</span>
                          <span>S: {card.fsrs.stability.toFixed(1)}d</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setQueue((prev) => [
                            card,
                            ...prev.filter((c) => c.id !== card.id),
                          ]);
                          setFlipped(false);
                          setTab("review");
                        }}
                        className="px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 text-xs font-medium shrink-0 cursor-pointer"
                      >
                        ทบทวนคำนี้
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CONJUGATION TRAINER */}
      {tab === "conjugation" && (
        <div className="space-y-5 max-w-2xl mx-auto">
          <div className="rounded-2xl border border-border bg-surface p-4 space-y-2.5">
            <div className="text-xs font-semibold text-foreground/70">
              เลือกรูปที่ต้องการฝึกผัน (กดเลือกได้หลายรูป):
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_FORMS.map((f) => {
                const active = selectedForms.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFormSelection(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-surface-muted border-border text-foreground/70"
                      }`}
                  >
                    {CONJUGATION_FORM_INFO[f].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between text-xs text-foreground/60">
              <span className="px-2.5 py-1 rounded-md bg-surface-muted font-medium">
                {conjItem.wordClass} • {conjItem.jlpt}
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                <Flame className="w-3.5 h-3.5" /> Streak {conjStreak}
              </span>
            </div>

            <div className="text-center space-y-2 py-2">
              <div className="text-xs text-foreground/60">
                ผันคำนี้ให้เป็น:{" "}
                <span className="font-bold text-primary text-sm">
                  {CONJUGATION_FORM_INFO[conjForm].label}
                </span>
              </div>
              <div className="font-jp text-5xl font-bold">{conjItem.dictForm}</div>
              <div className="text-sm text-foreground/65 font-jp">
                {conjItem.reading} — {conjItem.meaningTh}
              </div>
              <div className="text-xs text-foreground/50">
                {CONJUGATION_FORM_INFO[conjForm].hintTh}
              </div>
            </div>

            <form onSubmit={handleCheckConjugation} className="space-y-4">
              <input
                ref={conjInputRef}
                type="text"
                value={conjInput}
                onChange={(e) => {
                  if (conjStatus === "idle") {
                    setConjInput(toHiragana(e.target.value, { IMEMode: true }));
                  }
                }}
                readOnly={conjStatus !== "idle"}
                placeholder="พิมพ์ Romaji ได้เลย (เช่น tabete, ikimasu)..."
                autoFocus
                className={`w-full text-center font-jp text-xl px-4 py-3.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 ${conjStatus !== "idle" ? "opacity-75" : ""
                  }`}
              />

              {conjStatus === "idle" ? (
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm cursor-pointer"
                  >
                    ตรวจคำตอบ (Enter)
                  </button>
                  <button
                    type="button"
                    onClick={() => nextConjugation()}
                    className="px-4 py-3 rounded-xl border border-border hover:bg-surface-muted text-sm cursor-pointer"
                    title="ข้ามข้อนี้"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div
                    className={`rounded-xl p-4 border space-y-1.5 ${conjStatus === "correct"
                      ? "bg-matcha/10 border-matcha/30"
                      : "bg-accent/10 border-accent/30"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">
                        {conjStatus === "correct" ? "ถูกต้อง! ยอดเยี่ยม" : "ยังไม่ตรง ลองดูเฉลยนะครับ"}
                      </span>
                      <SpeakButton text={conjExpectedKanji.answer} />
                    </div>
                    <div className="font-jp text-xl font-bold text-primary">
                      {conjExpectedKanji.answer}{" "}
                      {conjExpectedKanji.answer !== conjExpectedKana.answer && (
                        <span className="text-sm font-normal text-foreground/65">
                          ({conjExpectedKana.answer})
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-foreground/75">
                      กฎการผัน: {conjExpectedKanji.ruleTh}
                    </div>
                    <div className="text-xs text-foreground/60">
                      การใช้: {CONJUGATION_FORM_INFO[conjForm].usageTh}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-foreground text-background font-medium text-sm cursor-pointer"
                  >
                    ข้อถัดไป (Enter) &rarr;
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: PARTICLE CLOZE DRILL */}
      {tab === "particles" && (
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between text-xs text-foreground/65">
              <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary font-semibold">
                {activeCloze.level} • ข้อที่ {(clozeIdx % PARTICLE_CLOZE_BANK.length) + 1} /{" "}
                {PARTICLE_CLOZE_BANK.length}
              </span>
              <div className="flex items-center gap-3">
                <span>
                  ถูก {clozeStats.correct}/{clozeStats.total}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                  <Flame className="w-3.5 h-3.5" /> Streak {clozeStreak}
                </span>
              </div>
            </div>

            <div className="text-center space-y-2 py-3">
              <div className="text-xs text-foreground/55">เลือกคำช่วย (Particle) ที่ถูกต้องในช่องว่าง</div>
              <div className="font-jp text-2xl sm:text-3xl font-bold leading-relaxed">
                {activeCloze.before}
                <span
                  className={`inline-flex items-center justify-center mx-1.5 min-w-[2.5rem] px-2.5 py-0.5 rounded-xl border-2 font-jp ${clozePicked === null
                    ? "border-dashed border-primary/50 bg-primary/5 text-primary"
                    : clozePicked === activeCloze.answer
                      ? "border-matcha bg-matcha/15 text-matcha"
                      : "border-accent bg-accent/15 text-accent"
                    }`}
                >
                  {clozePicked ?? "？"}
                </span>
                {activeCloze.after}
              </div>
              <div className="text-sm text-foreground/75 pt-1">{activeCloze.meaningTh}</div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {activeCloze.choices.map((ch) => {
                const isPicked = clozePicked === ch;
                const isAnswer = ch === activeCloze.answer;
                const btnStyle =
                  clozePicked === null
                    ? "border-border bg-background hover:bg-primary/10 hover:border-primary/40"
                    : isAnswer
                      ? "border-matcha bg-matcha/15 text-matcha font-bold"
                      : isPicked
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-border bg-surface-muted/40 opacity-55";

                return (
                  <button
                    key={ch}
                    type="button"
                    disabled={clozePicked !== null}
                    onClick={() => handlePickParticle(ch)}
                    className={`py-3.5 rounded-xl border font-jp text-2xl font-bold transition-colors cursor-pointer disabled:cursor-default ${btnStyle}`}
                  >
                    {ch}
                  </button>
                );
              })}
            </div>

            {clozePicked !== null && (
              <div className="space-y-4">
                <div
                  className={`rounded-xl p-4 border space-y-2 ${clozePicked === activeCloze.answer
                    ? "bg-matcha/10 border-matcha/30"
                    : "bg-accent/10 border-accent/30"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">
                      {clozePicked === activeCloze.answer
                        ? "ถูกต้องเป๊ะ!"
                        : `เฉลยที่ถูกคือ 「${activeCloze.answer}」`}
                    </span>
                    <SpeakButton
                      text={`${activeCloze.before}${activeCloze.answer}${activeCloze.after}`}
                      label="ฟังประโยค"
                    />
                  </div>
                  <div className="font-jp text-xs text-foreground/65">
                    {activeCloze.reading.replace("[___]", activeCloze.answer)}
                  </div>
                  <p className="text-xs leading-relaxed text-foreground/85">
                    {activeCloze.explanationTh}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={nextParticleCloze}
                  className="w-full py-3 rounded-xl bg-foreground text-background text-sm font-medium cursor-pointer"
                >
                  ข้อถัดไป &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: DECK BROWSER & CUSTOM CARD CREATOR */}
      {tab === "deck" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={deckSearch}
              onChange={(e) => setDeckSearch(e.target.value)}
              placeholder="ค้นหาคำศัพท์, คันจิ, คำอ่าน หรือความหมายไทย..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={() => setShowAddForm((s) => !s)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มการ์ดใหม่</span>
            </button>
          </div>

          {/* CSV / TSV / Anki (.apkg) Import & Export Bar */}
          <div className="rounded-2xl border border-border bg-surface p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-bold">
                นำเข้า / ส่งออก Deck (CSV, Excel, Anki .txt & .apkg)
              </div>
              <div className="text-[11px] text-foreground/65">
                นำเข้าชุดคำศัพท์จาก Anki (.apkg หรือ Notes in Plain Text) และ CSV หรือส่งออกการ์ดที่กรองอยู่ไปใช้งานต่อได้ทันที
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleExportDeckFile("csv")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-surface-muted text-xs font-medium cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-primary" />
                <span>ส่งออก .CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportDeckFile("anki")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-surface-muted text-xs font-medium cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-primary" />
                <span>ส่งออก Anki .TXT</span>
              </button>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 text-xs font-medium cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{deckImporting ? "กำลังนำเข้า..." : "นำเข้า CSV / TSV / .apkg"}</span>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,.apkg"
                  disabled={deckImporting}
                  onChange={handleImportDeckFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>
          {deckPortNotice && (
            <div className="rounded-xl border border-matcha/35 bg-matcha/10 px-4 py-2.5 text-xs text-matcha font-medium">
              {deckPortNotice}
            </div>
          )}

          {showAddForm && (
            <form
              onSubmit={handleAddCustomCard}
              onPaste={(e) => {
                const img = extractImageFromClipboard(e.clipboardData);
                if (img) {
                  e.preventDefault();
                  void compressImageFileToDataUrl(img).then(setNewImageDataUrl);
                }
              }}
              className="rounded-2xl border border-primary/30 bg-surface p-5 space-y-3"
            >
              <div className="font-bold text-sm">เพิ่มคำศัพท์/ประโยคใหม่เข้าสู่ระบบ FSRS</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={newFront}
                  onChange={(e) => setNewFront(e.target.value)}
                  placeholder="คำภาษาญี่ปุ่น (เช่น 頑張る)"
                  className="px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-jp"
                />
                <input
                  type="text"
                  value={newReading}
                  onChange={(e) => setNewReading(e.target.value)}
                  placeholder="คำอ่าน (เช่น がんばる)"
                  className="px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-jp"
                />
                <input
                  type="text"
                  required
                  value={newMeaning}
                  onChange={(e) => setNewMeaning(e.target.value)}
                  placeholder="ความหมายภาษาไทย"
                  className="px-3.5 py-2 rounded-xl border border-border bg-background text-sm"
                />
              </div>
              <input
                type="text"
                value={newExample}
                onChange={(e) => setNewExample(e.target.value)}
                placeholder="ประโยคตัวอย่าง (ไม่บังคับ)"
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-jp"
              />
              {newImageDataUrl && (
                <VocabVisualCard
                  word={newFront || "ภาพประกอบ"}
                  imageDataUrl={newImageDataUrl}
                  compact
                />
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={generatingImg || (!newFront.trim() && !newMeaning.trim())}
                    onClick={async () => {
                      setGeneratingImg(true);
                      setImageGenError(null);
                      try {
                        const s = await getAppSettings();
                        const url = await requestGeneratedVocabImage({
                          word: newFront.trim(),
                          reading: newReading.trim(),
                          meaningTh: newMeaning.trim(),
                          provider: s.aiProvider,
                          apiKey: s.apiKey,
                        });
                        setNewImageDataUrl(url);
                      } catch (err) {
                        setImageGenError(
                          err instanceof Error ? err.message : "สร้างรูปไม่สำเร็จ"
                        );
                      } finally {
                        setGeneratingImg(false);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{generatingImg ? "กำลังวาด..." : "สร้างรูป AI"}</span>
                  </button>
                  <label className="px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-surface-muted text-xs inline-flex items-center gap-1.5 cursor-pointer">
                    <ImagePlus className="w-3.5 h-3.5" />
                    <span>แนบรูป / กด Ctrl+V วางภาพ</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        if (file) {
                          void compressImageFileToDataUrl(file).then(
                            setNewImageDataUrl
                          );
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {newImageDataUrl && (
                    <button
                      type="button"
                      onClick={() => setNewImageDataUrl(undefined)}
                      className="text-xs text-rose-500 hover:underline cursor-pointer"
                    >
                      ลบรูป
                    </button>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 rounded-xl border border-border text-xs font-medium cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium cursor-pointer"
                  >
                    บันทึกเข้า FSRS
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredDeckCards.map((card) => (
              <div
                key={card.id}
                className="rounded-xl border border-border bg-surface p-4 flex items-start justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-jp text-lg font-bold truncate">
                      {card.front}
                    </span>
                    <span className="font-jp text-xs text-foreground/60">
                      {card.reading}
                    </span>
                    {(card.imageDataUrl ||
                      hasBuiltInVisual(card.visualKey || card.front, card.tags)) && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                          title="มีภาพประกอบช่วยจำ"
                        >
                          IMG
                        </span>
                      )}
                  </div>
                  <div className="text-sm text-foreground/80">{card.meaningTh}</div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-foreground/55 pt-1">
                    <span className="px-1.5 py-0.5 rounded bg-surface-muted uppercase">
                      {card.cardType}
                    </span>
                    <span>Reps: {card.fsrs.reps}</span>
                    <span>•</span>
                    <span>
                      {card.fsrs.reps === 0
                        ? "การ์ดใหม่"
                        : card.dueAtMs <= renderNowMs
                          ? "ถึงกำหนดทบทวน"
                          : `ทบทวนอีก ${Math.max(
                            1,
                            Math.round((card.dueAtMs - renderNowMs) / 86400000)
                          )} วัน`}
                    </span>
                  </div>
                </div>
                <SpeakButton text={card.front} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
