"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toHiragana, toKatakana } from "wanakana";
import { CheckCircle2, Ear, Flame, RotateCcw, Sparkles, Volume2, XCircle } from "lucide-react";
import { KANA_DATA, type KanaChar } from "@/data/kana";
import { db, ensureSeeded, getAppSettings } from "@/lib/db";
import { speakJapanese } from "@/lib/speech";
import { PitchAccentChart } from "@/components/PitchAccentChart";
import { SpeakButton } from "@/components/SpeakButton";
import { KanaWritingCanvas } from "@/components/KanaWritingCanvas";
import { StudyPageHero } from "@/components/StudyPageHero";
import type { KanaMasteryRecord } from "@/types/learning";

type TabMode = "chart" | "quiz" | "pitch" | "minimal";
type ScriptType = "hiragana" | "katakana";
type GroupFilter = "all" | "seion" | "dakuten" | "yoon";

interface MinimalPairItem {
  id: string;
  category: string;
  tipTh: string;
  a: { word: string; reading: string; meaningTh: string };
  b: { word: string; reading: string; meaningTh: string };
}

const MINIMAL_PAIR_DRILLS: MinimalPairItem[] = [
  {
    id: "mp-obasan",
    category: "สระเสียงสั้น vs เสียงยาว (長音)",
    tipTh: "おばさん มี 4 จังหวะ ส่วน おばあさん ลากเสียง あ ยาวเป็น 5 จังหวะ (ระวังเรียกผิดเป็นคุณยาย!)",
    a: { word: "おばさん", reading: "おばさん", meaningTh: "คุณน้า / คุณป้า" },
    b: { word: "おばあさん", reading: "おばあさん", meaningTh: "คุณย่า / คุณยาย" },
  },
  {
    id: "mp-ojisan",
    category: "สระเสียงสั้น vs เสียงยาว (長音)",
    tipTh: "おじさん (4 จังหวะ = ลุง) vs おじいさん (5 จังหวะ ลากเสียง い = คุณปู่/คุณตา)",
    a: { word: "おじさん", reading: "おじさん", meaningTh: "คุณลุง / คุณอา" },
    b: { word: "おじいさん", reading: "おじいさん", meaningTh: "คุณปู่ / คุณตา" },
  },
  {
    id: "mp-kitte",
    category: "เสียงสะดุดตัว っ (促音)",
    tipTh: "ตัว っ เล็กไม่ได้ออกเสียงแยก แต่ทำให้ต้องหยุดกลั้นลม 1 จังหวะเต็มก่อนออกเสียงตัวถัดไป",
    a: { word: "きて", reading: "きて", meaningTh: "มาเถอะ / สวมใส่" },
    b: { word: "きって", reading: "きって", meaningTh: "แสตมป์ / ตัด" },
  },
  {
    id: "mp-otto",
    category: "เสียงสะดุดตัว っ (促音)",
    tipTh: "おと (o-to) สองจังหวะเรียบ vs おっと (o-[หยุด]-to) สามจังหวะ",
    a: { word: "音", reading: "おと", meaningTh: "เสียง" },
    b: { word: "夫", reading: "おっと", meaningTh: "สามี" },
  },
  {
    id: "mp-sakka",
    category: "เสียงสะดุดตัว っ (促音)",
    tipTh: "さか (2 จังหวะ) กับ さっか (3 จังหวะ หยุดที่เสียง k)",
    a: { word: "坂", reading: "さか", meaningTh: "ทางลาด / เนิน" },
    b: { word: "作家", reading: "さっか", meaningTh: "นักเขียน" },
  },
  {
    id: "mp-kagi",
    category: "เสียงใส vs เสียงขุ่น (濁音)",
    tipTh: "ฟังเสียงก้องในลำคอของพยางค์ท้าย: き (ไม่ก้อง) vs ぎ (ก้องกังวาน)",
    a: { word: "柿", reading: "かき", meaningTh: "ลูกพลับ" },
    b: { word: "鍵", reading: "かぎ", meaningTh: "ลูกกุญแจ" },
  },
  {
    id: "mp-tsugi",
    category: "เสียงใส vs เสียงขุ่น (濁音)",
    tipTh: "つき (ทสึ-คิ) vs つぎ (ทสึ-กิ ออกเสียง ก แบบก้อง)",
    a: { word: "月", reading: "つき", meaningTh: "ดวงจันทร์ / เดือน" },
    b: { word: "次", reading: "つぎ", meaningTh: "ถัดไป" },
  },
  {
    id: "mp-yuki",
    category: "สระเสียงสั้น vs เสียงยาว (長音)",
    tipTh: "ゆき (2 จังหวะ) vs ゆうき (3 จังหวะ ลากเสียง う)",
    a: { word: "雪", reading: "ゆき", meaningTh: "หิมะ" },
    b: { word: "勇気", reading: "ゆうき", meaningTh: "ความกล้าหาญ" },
  },
];

const PITCH_EXAMPLES = [
  {
    word: "橋",
    reading: "はし",
    pitch: 2,
    meaning: "สะพาน (ต่ำ → สูง → ตกที่คำช่วย が)",
    example: "橋が (はしが) = ต่ำ-สูง-ต่ำ",
  },
  {
    word: "箸",
    reading: "はし",
    pitch: 1,
    meaning: "ตะเกียบ (สูงต้น → ตกทันที)",
    example: "箸が (はしが) = สูง-ต่ำ-ต่ำ",
  },
  {
    word: "雨",
    reading: "あめ",
    pitch: 1,
    meaning: "ฝน (สูงที่ あ → ต่ำที่ め)",
    example: "雨が (あめが) = สูง-ต่ำ-ต่ำ",
  },
  {
    word: "飴",
    reading: "あめ",
    pitch: 0,
    meaning: "ลูกอม (ต่ำที่ あ → สูงค้างไปที่คำช่วย)",
    example: "飴が (あめが) = ต่ำ-สูง-สูง",
  },
  {
    word: "日本",
    reading: "にほん",
    pitch: 2,
    meaning: "ประเทศญี่ปุ่น (ต่ำ → สูง → ต่ำ)",
    example: "日本に (にほんに) = ต่ำ-สูง-ต่ำ-ต่ำ",
  },
  {
    word: "日本語",
    reading: "にほんご",
    pitch: 0,
    meaning: "ภาษาญี่ปุ่น (Heiban ราบสูง)",
    example: "日本語が = ต่ำ-สูง-สูง-สูง-สูง",
  },
];

export default function KanaPage() {
  const [tab, setTab] = useState<TabMode>("chart");
  const [script, setScript] = useState<ScriptType>("hiragana");
  const [group, setGroup] = useState<GroupFilter>("seion");
  const [selected, setSelected] = useState<KanaChar | null>(KANA_DATA[0]);
  const [masteryMap, setMasteryMap] = useState<Record<string, KanaMasteryRecord>>({});

  // Quiz state
  const [quizPool, setQuizPool] = useState<KanaChar[]>(() =>
    KANA_DATA.filter((k) => k.group === "seion")
  );
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizInput, setQuizInput] = useState("");
  const [quizFeedback, setQuizFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const [quizStreak, setQuizStreak] = useState(0);
  const [quizStats, setQuizStats] = useState({ correct: 0, total: 0 });
  const quizInputRef = useRef<HTMLInputElement>(null);

  // Minimal Pairs & Listening Dictation state
  const [drillMode, setDrillMode] = useState<"pair" | "dictation">("pair");
  const [pairIdx, setPairIdx] = useState(0);
  const [targetSide, setTargetSide] = useState<"a" | "b">("a");
  const [pairChoice, setPairChoice] = useState<"a" | "b" | null>(null);
  const [dictationInput, setDictationInput] = useState("");
  const [dictationResult, setDictationResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [listenStats, setListenStats] = useState({ correct: 0, total: 0 });

  const focusQuizInput = () => {
    requestAnimationFrame(() => {
      quizInputRef.current?.focus();
    });
  };

  const loadMastery = async () => {
    await ensureSeeded();
    const list = await db.kanaMastery.toArray();
    const map: Record<string, KanaMasteryRecord> = {};
    for (const m of list) {
      map[m.char] = m;
    }
    setMasteryMap(map);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      await ensureSeeded();
      const list = await db.kanaMastery.toArray();
      if (!active) return;
      const map: Record<string, KanaMasteryRecord> = {};
      for (const m of list) {
        map[m.char] = m;
      }
      setMasteryMap(map);
    })();
    return () => {
      active = false;
    };
  }, []);

  const filteredKana = useMemo(() => {
    if (group === "all") return KANA_DATA;
    return KANA_DATA.filter((k) => k.group === group);
  }, [group]);

  const startQuiz = (targetScript = script, targetGroup = group) => {
    const poolSource =
      targetGroup === "all"
        ? KANA_DATA
        : KANA_DATA.filter((k) => k.group === targetGroup);
    const shuffled = [...poolSource].sort(() => Math.random() - 0.5);
    setQuizPool(shuffled);
    setQuizIndex(0);
    setQuizInput("");
    setQuizFeedback("idle");
    setQuizStats({ correct: 0, total: 0 });
    setScript(targetScript);
    focusQuizInput();
  };

  const handleSelectKana = async (item: KanaChar) => {
    setSelected(item);
    const ch = script === "hiragana" ? item.hiragana : item.katakana;
    const settings = await getAppSettings();
    speakJapanese(ch, {
      rate: settings.speechRate,
      voiceName: settings.preferredVoiceName || undefined,
    });
  };

  const currentQuizItem = quizPool[quizIndex];

  const handleNextQuiz = () => {
    setQuizInput("");
    setQuizFeedback("idle");
    if (quizIndex + 1 >= quizPool.length) {
      startQuiz();
    } else {
      setQuizIndex((i) => i + 1);
      focusQuizInput();
    }
  };

  const handleQuizSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentQuizItem) return;
    if (quizFeedback !== "idle") {
      handleNextQuiz();
      return;
    }

    const raw = quizInput.trim().toLowerCase();
    if (!raw) return;

    const targetChar =
      script === "hiragana" ? currentQuizItem.hiragana : currentQuizItem.katakana;
    const converted =
      script === "hiragana" ? toHiragana(raw) : toKatakana(raw);
    const isCorrect =
      raw === currentQuizItem.romaji || converted === targetChar;

    setQuizFeedback(isCorrect ? "correct" : "wrong");
    setQuizStats((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));
    setQuizStreak((s) => (isCorrect ? s + 1 : 0));

    // Persist mastery
    const existing = await db.kanaMastery.get(targetChar);
    await db.kanaMastery.put({
      char: targetChar,
      script,
      attempts: (existing?.attempts ?? 0) + 1,
      correct: (existing?.correct ?? 0) + (isCorrect ? 1 : 0),
      lastPracticedAt: new Date().toISOString(),
    });
    await loadMastery();

    const settings = await getAppSettings();
    speakJapanese(targetChar, { rate: settings.speechRate });
    focusQuizInput();
  };

  const handlePlayMinimalTarget = (idx = pairIdx, side = targetSide) => {
    const pair = MINIMAL_PAIR_DRILLS[idx % MINIMAL_PAIR_DRILLS.length];
    const target = pair[side];
    speakJapanese(target.word, { rate: 0.85 });
  };

  const handleNextMinimal = () => {
    const nextIdx = (pairIdx + 1) % MINIMAL_PAIR_DRILLS.length;
    const nextSide: "a" | "b" = Math.random() < 0.5 ? "a" : "b";
    setPairIdx(nextIdx);
    setTargetSide(nextSide);
    setPairChoice(null);
    setDictationInput("");
    setDictationResult("idle");
    handlePlayMinimalTarget(nextIdx, nextSide);
  };

  const handleSelectMinimalChoice = (chosen: "a" | "b") => {
    if (pairChoice !== null) return;
    setPairChoice(chosen);
    const isCorrect = chosen === targetSide;
    setListenStats((s) => ({
      correct: s.correct + (isCorrect ? 1 : 0),
      total: s.total + 1,
    }));
  };

  const handleCheckDictation = (e: React.FormEvent) => {
    e.preventDefault();
    if (dictationResult !== "idle") {
      handleNextMinimal();
      return;
    }
    const pair = MINIMAL_PAIR_DRILLS[pairIdx % MINIMAL_PAIR_DRILLS.length];
    const target = pair[targetSide];
    const cleaned = dictationInput.trim();
    if (!cleaned) return;
    const converted = /^[a-zA-Z\s'-]+$/.test(cleaned)
      ? toHiragana(cleaned.toLowerCase())
      : cleaned;
    const ok = converted === target.reading || cleaned === target.word;
    setDictationResult(ok ? "correct" : "wrong");
    setListenStats((s) => ({
      correct: s.correct + (ok ? 1 : 0),
      total: s.total + 1,
    }));
  };

  return (
    <div className="space-y-6">
      <StudyPageHero
        tone="indigo"
        kanjiWatermark="仮名"
        eyebrow="Phase 1 • The Sound & Script Foundation"
        title="Kana Dojo & ระบบเสียงญี่ปุ่น"
        subtitle="จำอักษรญี่ปุ่นด้วยภาพช่วยจำ (Mnemonics) + ฝึกพิมพ์ Active Recall + เรียนรู้ Pitch Accent ตั้งแต่วันแรก"
        actions={
          <div className="inline-flex flex-wrap rounded-2xl border border-white/20 bg-white/10 p-1 backdrop-blur-xs">
            {[
              { id: "chart", label: "ตารางอักษร" },
              { id: "quiz", label: "ฝึกพิมพ์ Recall" },
              { id: "minimal", label: "แยกเสียง & Dictation" },
              { id: "pitch", label: "Mora & Pitch 101" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  const nextTab = t.id as TabMode;
                  setTab(nextTab);
                  if (nextTab === "quiz") startQuiz(script, group);
                  if (nextTab === "minimal") handlePlayMinimalTarget(pairIdx, targetSide);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  tab === t.id
                    ? "bg-white text-[#162947] shadow-xs"
                    : "text-white/85 hover:bg-white/10"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Controls for Chart & Quiz */}
      {(tab === "chart" || tab === "quiz") && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setScript("hiragana");
                if (tab === "quiz") startQuiz("hiragana", group);
              }}
              className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${script === "hiragana"
                ? "bg-primary/10 border-primary text-primary"
                : "bg-surface border-border text-foreground/70"
                }`}
            >
              Hiragana (ひらがな)
            </button>
            <button
              type="button"
              onClick={() => {
                setScript("katakana");
                if (tab === "quiz") startQuiz("katakana", group);
              }}
              className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${script === "katakana"
                ? "bg-primary/10 border-primary text-primary"
                : "bg-surface border-border text-foreground/70"
                }`}
            >
              Katakana (カタカナ)
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "seion", label: "เสียงพื้นฐาน (46)" },
              { id: "dakuten", label: "เสียงขุ่น ゛/゜ (25)" },
              { id: "yoon", label: "เสียงควบ (18)" },
              { id: "all", label: "ทั้งหมด" },
            ].map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setGroup(g.id as GroupFilter);
                  if (tab === "quiz") startQuiz(script, g.id as GroupFilter);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${group === g.id
                  ? "bg-foreground text-background border-foreground"
                  : "bg-surface border-border text-foreground/70 hover:bg-surface-muted"
                  }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TAB 1: KANA CHART */}
      {tab === "chart" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid grid-cols-5 gap-2 sm:gap-2.5">
            {filteredKana.map((item) => {
              const ch = script === "hiragana" ? item.hiragana : item.katakana;
              const mastery = masteryMap[ch];
              const isMastered =
                mastery && mastery.attempts >= 2 && mastery.correct / mastery.attempts >= 0.75;
              const isSelected = selected?.id === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectKana(item)}
                  className={`relative rounded-xl border p-2.5 sm:p-3 flex flex-col items-center justify-center transition-all cursor-pointer ${isSelected
                    ? "border-primary bg-primary/10 ring-2 ring-primary/25"
                    : isMastered
                      ? "border-matcha/40 bg-matcha/5 hover:bg-matcha/10"
                      : "border-border bg-surface hover:bg-surface-muted"
                    }`}
                >
                  {isMastered && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-matcha" />
                  )}
                  <span className="font-jp text-2xl sm:text-3xl font-medium">
                    {ch}
                  </span>
                  <span className="text-xs font-mono text-foreground/70 mt-1">
                    {item.romaji}
                  </span>
                  <span className="text-[11px] text-foreground/50">{item.thaiSound}</span>
                </button>
              );
            })}
          </div>

          {/* Selected Kana Detail Panel */}
          <div className="rounded-2xl border border-border bg-surface p-5 h-fit sticky top-20 space-y-4">
            {selected ? (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-foreground/60 font-medium uppercase">
                      {script === "hiragana" ? "Hiragana" : "Katakana"} • แถว{" "}
                      {selected.row}
                    </div>
                    <div className="flex items-baseline gap-3 mt-1">
                      <span className="font-jp text-6xl font-bold text-primary">
                        {script === "hiragana"
                          ? selected.hiragana
                          : selected.katakana}
                      </span>
                      <span className="font-jp text-2xl text-foreground/40">
                        {script === "hiragana"
                          ? selected.katakana
                          : selected.hiragana}
                      </span>
                    </div>
                  </div>
                  <SpeakButton
                    text={
                      script === "hiragana"
                        ? selected.hiragana
                        : selected.katakana
                    }
                    label="ฟังเสียง"
                    size="md"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-sm">
                  <div className="rounded-xl bg-surface-muted p-3">
                    <div className="text-xs text-foreground/60">Romaji</div>
                    <div className="font-mono font-bold text-lg">
                      {selected.romaji}
                    </div>
                  </div>
                  <div className="rounded-xl bg-surface-muted p-3">
                    <div className="text-xs text-foreground/60">เสียงเทียบภาษาไทย</div>
                    <div className="font-bold text-lg">{selected.thaiSound}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-gold/30 bg-gold/5 p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>ภาพช่วยจำ (Mnemonic)</span>
                  </div>
                  <p className="text-sm text-foreground/85 leading-relaxed">
                    {script === "hiragana"
                      ? selected.mnemonicHira
                      : selected.mnemonicKata}
                  </p>
                </div>

                <KanaWritingCanvas
                  char={
                    script === "hiragana"
                      ? selected.hiragana
                      : selected.katakana
                  }
                />

                <button
                  type="button"
                  onClick={() => {
                    setTab("quiz");
                    startQuiz(script, group);
                  }}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-95 transition-opacity cursor-pointer"
                >
                  ไปฝึกพิมพ์ทดสอบความจำเลย &rarr;
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVE RECALL TYPING QUIZ */}
      {tab === "quiz" && currentQuizItem && (
        <div className="max-w-xl mx-auto rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between text-xs text-foreground/70">
            <span>
              ข้อที่ {quizIndex + 1} / {quizPool.length} • ถูก{" "}
              {quizStats.correct}/{quizStats.total}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
              <Flame className="w-3.5 h-3.5" /> Streak {quizStreak}
            </span>
          </div>

          <div className="text-center space-y-3 py-4">
            <div className="text-xs uppercase tracking-wider text-foreground/50">
              พิมพ์เสียงอ่าน (Romaji) ของตัวอักษรนี้
            </div>
            <div className="font-jp text-7xl sm:text-8xl font-bold text-primary select-none">
              {script === "hiragana"
                ? currentQuizItem.hiragana
                : currentQuizItem.katakana}
            </div>
            <div>
              <button
                type="button"
                onClick={() =>
                  speakJapanese(
                    script === "hiragana"
                      ? currentQuizItem.hiragana
                      : currentQuizItem.katakana
                  )
                }
                className="inline-flex items-center gap-1.5 text-xs text-foreground/60 hover:text-primary cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>แอบฟังเสียงใบ้</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleQuizSubmit} className="space-y-4">
            <input
              ref={quizInputRef}
              type="text"
              value={quizInput}
              onChange={(e) => {
                if (quizFeedback === "idle") setQuizInput(e.target.value);
              }}
              readOnly={quizFeedback !== "idle"}
              placeholder="พิมพ์คำอ่าน เช่น ka, shi, tsu..."
              autoFocus
              className={`w-full text-center text-xl font-mono px-4 py-3.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 ${quizFeedback !== "idle" ? "opacity-75" : ""
                }`}
            />

            {quizFeedback === "idle" ? (
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-95 transition-opacity cursor-pointer"
              >
                ตรวจคำตอบ (Enter)
              </button>
            ) : (
              <div className="space-y-3">
                <div
                  className={`rounded-xl p-4 border flex items-start gap-3 ${quizFeedback === "correct"
                    ? "bg-matcha/10 border-matcha/30 text-matcha"
                    : "bg-accent/10 border-accent/30 text-accent"
                    }`}
                >
                  {quizFeedback === "correct" ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  )}
                  <div className="text-sm text-foreground space-y-1">
                    <div className="font-bold">
                      {quizFeedback === "correct"
                        ? "ถูกต้อง!"
                        : `คำตอบคือ "${currentQuizItem.romaji}" (${currentQuizItem.thaiSound})`}
                    </div>
                    <div className="text-xs text-foreground/75">
                      ภาพช่วยจำ:{" "}
                      {script === "hiragana"
                        ? currentQuizItem.mnemonicHira
                        : currentQuizItem.mnemonicKata}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleNextQuiz}
                  className="w-full py-3 rounded-xl bg-foreground text-background font-medium text-sm hover:opacity-90 transition-opacity cursor-pointer"
                >
                  ข้อถัดไป (Enter) &rarr;
                </button>
              </div>
            )}
          </form>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => startQuiz()}
              className="inline-flex items-center gap-1.5 text-xs text-foreground/60 hover:text-foreground cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>สับชุดคำถามใหม่</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: MINIMAL PAIRS & LISTENING DICTATION */}
      {tab === "minimal" && (
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-primary inline-flex items-center gap-1.5">
                  <Ear className="w-3.5 h-3.5" />
                  <span>Minimal Pairs & Audio Dictation</span>
                </div>
                <h2 className="text-lg font-bold mt-0.5">
                  ฝึกหูแยกเสียงสั้น-ยาว, เสียงก้อง และ っ สะดุด
                </h2>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-surface-muted font-medium">
                  ถูก {listenStats.correct}/{listenStats.total}
                </span>
                <div className="inline-flex rounded-xl border border-border bg-background p-0.5">
                  <button
                    type="button"
                    onClick={() => setDrillMode("pair")}
                    className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer ${drillMode === "pair"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/70"
                      }`}
                  >
                    เลือกคู่เสียง
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrillMode("dictation")}
                    className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer ${drillMode === "dictation"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/70"
                      }`}
                  >
                    Dictation พิมพ์ตามเสียง
                  </button>
                </div>
              </div>
            </div>

            {(() => {
              const pair = MINIMAL_PAIR_DRILLS[pairIdx % MINIMAL_PAIR_DRILLS.length];
              const target = pair[targetSide];
              return (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-surface-muted/70 rounded-xl px-3.5 py-2.5">
                    <span className="font-semibold text-primary">{pair.category}</span>
                    <span className="text-foreground/65">
                      ข้อที่ {(pairIdx % MINIMAL_PAIR_DRILLS.length) + 1}/{MINIMAL_PAIR_DRILLS.length}
                    </span>
                  </div>

                  <div className="flex justify-center py-2">
                    <button
                      type="button"
                      onClick={() => handlePlayMinimalTarget()}
                      className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm shadow-sm hover:opacity-95 cursor-pointer"
                    >
                      <Volume2 className="w-5 h-5" />
                      <span>ฟังเสียงเป้าหมาย (เล่นซ้ำได้)</span>
                    </button>
                  </div>

                  {drillMode === "pair" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(["a", "b"] as const).map((side) => {
                        const option = pair[side];
                        const chosenThis = pairChoice === side;
                        const isTarget = targetSide === side;
                        let cls =
                          "border-border bg-background hover:border-primary/50 hover:bg-surface-muted/40";
                        if (pairChoice !== null) {
                          if (isTarget) {
                            cls = "border-matcha bg-matcha/10";
                          } else if (chosenThis) {
                            cls = "border-rose-500 bg-rose-500/10";
                          } else {
                            cls = "border-border bg-background opacity-60";
                          }
                        }

                        return (
                          <div
                            key={side}
                            className={`rounded-2xl border p-4 space-y-2 transition-colors ${cls}`}
                          >
                            <button
                              type="button"
                              onClick={() => handleSelectMinimalChoice(side)}
                              disabled={pairChoice !== null}
                              className="w-full text-left space-y-1 cursor-pointer disabled:cursor-default"
                            >
                              <div className="font-jp text-2xl font-bold">{option.word}</div>
                              <div className="font-jp text-xs text-primary">
                                {option.reading}
                              </div>
                              <div className="text-xs text-foreground/75">
                                {option.meaningTh}
                              </div>
                            </button>

                            {pairChoice !== null && (
                              <div className="pt-1">
                                <SpeakButton text={option.word} label="ฟังคำนี้" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <form onSubmit={handleCheckDictation} className="space-y-3">
                      <input
                        type="text"
                        value={dictationInput}
                        onChange={(e) => setDictationInput(e.target.value)}
                        placeholder="พิมพ์ฮิรางานะหรือ Romaji เช่น obaasan, kitte..."
                        className="w-full text-center text-lg font-medium py-3 px-4 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/35 font-jp"
                      />
                      <button
                        type="submit"
                        className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium cursor-pointer"
                      >
                        {dictationResult === "idle" ? "ตรวจคำตอบ" : "ข้อถัดไป ->"}
                      </button>

                      {dictationResult !== "idle" && (
                        <div
                          className={`rounded-xl p-3.5 border text-sm flex items-center gap-3 ${dictationResult === "correct"
                            ? "border-matcha bg-matcha/10"
                            : "border-rose-500 bg-rose-500/10"
                            }`}
                        >
                          {dictationResult === "correct" ? (
                            <CheckCircle2 className="w-5 h-5 text-matcha shrink-0" />
                          ) : (
                            <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                          )}
                          <div>
                            <div className="font-bold">
                              {dictationResult === "correct" ? "ถูกต้องแม่นยำ!" : "ลองฟังความต่างอีกครั้ง"}
                            </div>
                            <div className="text-xs text-foreground/80 font-jp">
                              คำตอบ: {target.word} ({target.reading}) — {target.meaningTh}
                            </div>
                          </div>
                        </div>
                      )}
                    </form>
                  )}

                  {(pairChoice !== null || dictationResult !== "idle") && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-foreground/80">
                        <strong className="text-amber-700 dark:text-amber-300">จุดสังเกต:</strong>{" "}
                        {pair.tipTh}
                      </div>
                      {drillMode === "pair" && (
                        <button
                          type="button"
                          onClick={handleNextMinimal}
                          className="w-full py-2.5 rounded-xl bg-foreground text-background text-sm font-medium cursor-pointer"
                        >
                          ข้อถัดไป &rarr;
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* TAB 4: MORA & PITCH ACCENT 101 */}
      {tab === "pitch" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-3">
            <h2 className="text-lg font-bold">
              ความลับของสำเนียงธรรมชาติ: จังหวะ Mora (拍) และ Pitch Accent
            </h2>
            <p className="text-sm text-foreground/80 leading-relaxed">
              ภาษาไทยมีวรรณยุกต์ 5 เสียงในแต่ละพยางค์ แต่ภาษาญี่ปุ่นใช้{" "}
              <strong>ระดับเสียงสูง–ต่ำ (High / Low)</strong> ข้ามแต่ละจังหวะ{" "}
              <strong>Mora</strong> (1 คานะ = 1 จังหวะเท่ากัน รวมถึงตัว っ, ん และเสียงยาว ー)
              กฎทองมีแค่ 2 ข้อ:
            </p>
            <ul className="text-sm text-foreground/80 list-disc pl-5 space-y-1">
              <li>
                <strong>พยางค์แรกกับพยางค์ที่สองต้องระดับเสียงต่างกันเสมอ</strong> (ถ้าเริ่มต่ำ พยางค์ 2 จะขึ้นสูง; ถ้าเริ่มสูง พยางค์ 2 จะลงต่ำ)
              </li>
              <li>
                <strong>ตกได้แค่ครั้งเดียวต่อคำ</strong> (เมื่อเสียงตกลงต่ำแล้ว จะไม่ดีดกลับขึ้นสูงอีกในคำเดียวกัน)
              </li>
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PITCH_EXAMPLES.map((item) => (
              <div
                key={`${item.word}-${item.pitch}`}
                className="rounded-2xl border border-border bg-surface p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-jp text-2xl font-bold">{item.word}</span>
                      <span className="font-jp text-sm text-foreground/60">
                        ({item.reading})
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80 mt-0.5">{item.meaning}</p>
                  </div>
                  <SpeakButton text={`${item.word}が`} label="ฟังเสียง" />
                </div>

                <PitchAccentChart
                  reading={item.reading}
                  pitch={item.pitch}
                  showDescription
                />

                <div className="text-xs text-foreground/60 bg-surface-muted rounded-lg px-3 py-2 font-jp">
                  ตัวอย่างเมื่อต่อคำช่วย: {item.example}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
