"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileCheck2,
  Flag,
  Languages,
  Pause,
  Play,
  PlusCircle,
  RotateCcw,
  Sparkles,
  Square,
  Timer,
  Volume2,
  XCircle,
} from "lucide-react";
import {
  JLPT_EXAMS,
  JLPT_LEVEL_RULES,
  calculateJlptScores,
  type JlptExamPaper,
  type JlptScoreReport,
} from "@/data/jlptExams";
import {
  ensureSeeded,
  getAppSettings,
  getJlptAttempts,
  getLearningSummary,
  mineCardToSrs,
  saveJlptAttempt,
} from "@/lib/db";
import { JLPT_DRAFTS_STORAGE_KEY } from "@/lib/accountIsolation";
import { findKanjiMatches, findVocabMatch } from "@/lib/vocabLookup";
import { translateJaToTh } from "@/lib/localTranslate";
import { InteractiveJapaneseText } from "@/components/InteractiveJapaneseText";
import { SpeakButton } from "@/components/SpeakButton";
import { CrestSealIcon, FlashcardDeckIcon } from "@/components/LuxuryIcons";
import {
  getJapaneseSpeechCapabilities,
  speakJapanese,
  speakJapaneseDialogue,
  stopSpeaking,
  waitForJapaneseVoices,
  type JapaneseSpeechCapabilities,
} from "@/lib/speech";
import type { JlptAttemptRecord, JlptLevel, TokenizedWord } from "@/types/learning";

const LEVELS: JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];
const JLPT_DRAFTS_KEY = JLPT_DRAFTS_STORAGE_KEY;

interface JlptExamDraft {
  examId: string;
  answers: Record<string, number>;
  flaggedIds: string[];
  secondsLeft: number;
  isTimedMode: boolean;
  timerScope: "full" | "section";
  sectionFilter: "all" | "vocab" | "grammar_reading" | "listening";
  updatedAt: string;
}

function readJlptDrafts(): Record<string, JlptExamDraft> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(JLPT_DRAFTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeJlptDrafts(drafts: Record<string, JlptExamDraft>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(JLPT_DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // ignore storage quota errors
  }
}

function formatClock(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

function getSectionMinutes(
  exam: JlptExamPaper,
  section: "all" | "vocab" | "grammar_reading" | "listening"
): number {
  if (section === "all" || exam.sectionTimings.length === 0) return exam.totalMinutes;
  if (section === "listening") {
    return exam.sectionTimings[exam.sectionTimings.length - 1]?.minutes ?? 35;
  }
  if (section === "vocab") {
    return exam.sectionTimings[0]?.minutes ?? 25;
  }
  // N2/N1 combine Language Knowledge + Reading into sectionTimings[0]
  if (exam.level === "N2" || exam.level === "N1") {
    return exam.sectionTimings[0]?.minutes ?? 105;
  }
  return exam.sectionTimings[1]?.minutes ?? exam.sectionTimings[0]?.minutes ?? 50;
}

export default function JlptPage() {
  const [selectedLevel, setSelectedLevel] = useState<JlptLevel>("N5");
  const [activeExam, setActiveExam] = useState<JlptExamPaper | null>(null);
  const [isTimedMode, setIsTimedMode] = useState(true);
  const [timerScope, setTimerScope] = useState<"full" | "section">("full");
  const [timerPaused, setTimerPaused] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [aiTopic, setAiTopic] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Answers, flags, scripts, and Furigana reading toggle
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());
  const [revealedScripts, setRevealedScripts] = useState<Set<string>>(new Set());
  const [checkedPracticeIds, setCheckedPracticeIds] = useState<Set<string>>(new Set());
  const [showFurigana, setShowFurigana] = useState(false);
  const [revealTargetKanjiReading, setRevealTargetKanjiReading] = useState(false);
  const [sectionFilter, setSectionFilter] = useState<"all" | "vocab" | "grammar_reading" | "listening">("all");

  // Submission & History & Saved Drafts
  const [submittedReport, setSubmittedReport] = useState<JlptScoreReport | null>(null);
  const [playingQuestionId, setPlayingQuestionId] = useState<string | null>(null);
  const [audioRate, setAudioRate] = useState<number>(0.95);
  const [speechCaps, setSpeechCaps] = useState<JapaneseSpeechCapabilities | null>(null);
  const [bulkSavingWrong, setBulkSavingWrong] = useState(false);
  const [wrongSavedMsg, setWrongSavedMsg] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<JlptAttemptRecord[]>([]);
  const [knownFronts, setKnownFronts] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, JlptExamDraft>>({});

  // Clicked Word Inspector & Quick FSRS Save
  const [pickedToken, setPickedToken] = useState<TokenizedWord | null>(null);
  const [pickedContext, setPickedContext] = useState("");
  const [pickedMeaning, setPickedMeaning] = useState("");
  const [translatingWord, setTranslatingWord] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [examMinedWords, setExamMinedWords] = useState<
    { word: string; reading: string; meaningTh: string }[]
  >([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      await ensureSeeded();
      const [pastAttempts, summary, settings] = await Promise.all([
        getJlptAttempts(),
        getLearningSummary(),
        getAppSettings(),
      ]);
      if (!active) return;
      setAttempts(pastAttempts);
      setKnownFronts(summary.knownFronts);
      setDrafts(readJlptDrafts());
      if (LEVELS.includes(settings.learnerLevel)) {
        setSelectedLevel(settings.learnerLevel);
      }
      setShowFurigana(settings.furiganaMode === "all");

      void waitForJapaneseVoices(600).then(() => {
        if (!active) return;
        setSpeechCaps(getJapaneseSpeechCapabilities());
      });
    })();
    return () => {
      active = false;
    };
  }, []);

  const examsForLevel = useMemo(
    () => JLPT_EXAMS.filter((e) => e.level === selectedLevel),
    [selectedLevel]
  );

  const levelRule = JLPT_LEVEL_RULES[selectedLevel];

  const allQuestionsInExam = useMemo(() => {
    if (!activeExam) return [];
    return activeExam.mondaiGroups.flatMap((g) => g.questions);
  }, [activeExam]);

  const handleSubmitExam = useCallback(async () => {
    if (!activeExam || submittedReport) return;
    const report = calculateJlptScores(activeExam, answers);
    setSubmittedReport(report);

    const totalSec = activeExam.totalMinutes * 60;
    const elapsedSec = isTimedMode ? Math.max(0, totalSec - secondsLeft) : 0;

    const bucketMap: JlptAttemptRecord["sectionScores"] = {
      listening:
        report.sectionResults.find((s) => s.bucket === "listening")?.scaledScore ?? 0,
    };
    for (const sec of report.sectionResults) {
      if (sec.bucket === "vocabGrammarReading") {
        bucketMap.vocabGrammarReading = sec.scaledScore;
      } else if (sec.bucket === "langKnowledge") {
        bucketMap.langKnowledge = sec.scaledScore;
      } else if (sec.bucket === "reading") {
        bucketMap.reading = sec.scaledScore;
      }
    }

    const saved = await saveJlptAttempt({
      examId: activeExam.id,
      level: activeExam.level,
      examTitle: activeExam.titleTh,
      totalScaledScore: report.totalScaledScore,
      sectionScores: bucketMap,
      passed: report.passed,
      correctCount: report.correctCount,
      totalQuestions: report.totalQuestions,
      durationSec: elapsedSec,
    });
    setAttempts((prev) => [saved, ...prev]);
    // Clear draft upon final submission
    setDrafts((prev) => {
      if (!prev[activeExam.id]) return prev;
      const next = { ...prev };
      delete next[activeExam.id];
      writeJlptDrafts(next);
      return next;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeExam, answers, isTimedMode, secondsLeft, submittedReport]);

  // Countdown timer effect in Timed Mode
  useEffect(() => {
    if (!activeExam || !isTimedMode || timerPaused || submittedReport) return;
    if (secondsLeft <= 0) return;

    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [activeExam, isTimedMode, timerPaused, submittedReport, secondsLeft]);

  // Auto-persist active unsubmitted exam draft to localStorage
  useEffect(() => {
    if (!activeExam || submittedReport || activeExam.id.startsWith("ai-")) return;
    const answeredCountNow = Object.keys(answers).length;
    if (answeredCountNow === 0 && flaggedIds.size === 0) return;

    const currentDraft: JlptExamDraft = {
      examId: activeExam.id,
      answers,
      flaggedIds: Array.from(flaggedIds),
      secondsLeft,
      isTimedMode,
      timerScope,
      sectionFilter,
      updatedAt: new Date().toISOString(),
    };
    const existing = readJlptDrafts();
    writeJlptDrafts({ ...existing, [activeExam.id]: currentDraft });
  }, [activeExam, answers, flaggedIds, isTimedMode, sectionFilter, secondsLeft, submittedReport, timerScope]);

  const startExam = (
    exam: JlptExamPaper,
    timed: boolean,
    scope: "full" | "section" = "full"
  ) => {
    setActiveExam(exam);
    setIsTimedMode(timed);
    setTimerScope(scope);
    setTimerPaused(false);
    const initialFilter = scope === "section" ? "vocab" : "all";
    setSectionFilter(initialFilter);
    setSecondsLeft(
      (scope === "section" ? getSectionMinutes(exam, "vocab") : exam.totalMinutes) * 60
    );
    setAnswers({});
    setFlaggedIds(new Set());
    setRevealedScripts(new Set());
    setCheckedPracticeIds(new Set());
    setSubmittedReport(null);
    setWrongSavedMsg(null);
    setPickedToken(null);
    setSaveNotice(null);
    setExamMinedWords([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resumeDraftExam = (exam: JlptExamPaper) => {
    const draft = drafts[exam.id];
    if (!draft) {
      startExam(exam, true, "full");
      return;
    }
    setActiveExam(exam);
    setIsTimedMode(draft.isTimedMode);
    setTimerScope(draft.timerScope);
    setTimerPaused(false);
    setSectionFilter(draft.sectionFilter);
    setSecondsLeft(draft.secondsLeft);
    setAnswers(draft.answers ?? {});
    setFlaggedIds(new Set(draft.flaggedIds ?? []));
    setRevealedScripts(new Set());
    setCheckedPracticeIds(new Set());
    setSubmittedReport(null);
    setWrongSavedMsg(null);
    setPickedToken(null);
    setSaveNotice(null);
    setExamMinedWords([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pauseAndExitToLobby = () => {
    if (activeExam && !submittedReport && !activeExam.id.startsWith("ai-")) {
      const currentDraft: JlptExamDraft = {
        examId: activeExam.id,
        answers,
        flaggedIds: Array.from(flaggedIds),
        secondsLeft,
        isTimedMode,
        timerScope,
        sectionFilter,
        updatedAt: new Date().toISOString(),
      };
      setDrafts((prev) => {
        const next = { ...prev, [activeExam.id]: currentDraft };
        writeJlptDrafts(next);
        return next;
      });
    } else {
      setDrafts(readJlptDrafts());
    }
    stopSpeaking();
    setActiveExam(null);
  };

  const discardDraft = (examId: string) => {
    setDrafts((prev) => {
      if (!prev[examId]) return prev;
      const next = { ...prev };
      delete next[examId];
      writeJlptDrafts(next);
      return next;
    });
  };

  const handleGenerateAiMock = async () => {
    setAiError(null);
    const settings = await getAppSettings();
    if (!settings.apiKey.trim()) {
      setAiError("กรุณาใส่ Gemini หรือ OpenAI API Key ในหน้าตั้งค่าก่อนสร้างข้อสอบเสริมด้วย AI");
      return;
    }

    setAiGenerating(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "jlpt-generate",
          provider: settings.aiProvider,
          apiKey: settings.apiKey,
          model: settings.aiModel,
          level: selectedLevel,
          topic: aiTopic.trim() || `ชุดฝึกพิเศษ JLPT ${selectedLevel}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "สร้างข้อสอบไม่สำเร็จ");
      }

      const raw = json.data as {
        titleTh: string;
        titleJp: string;
        readingPassageJp: string;
        questions: {
          section: "vocab" | "grammar_reading" | "listening";
          mondaiLabel: string;
          promptJp: string;
          targetWord?: string;
          choices: string[];
          correctIndex: number;
          explainTh: string;
        }[];
      };

      const mappedExam: JlptExamPaper = {
        id: `ai-${selectedLevel}-${Date.now()}`,
        level: selectedLevel,
        yearLabel: "AI Practice Set",
        titleTh: raw.titleTh || `ชุดฝึกเสริม JLPT ${selectedLevel} (AI)`,
        titleJp: raw.titleJp || `JLPT ${selectedLevel} 模擬練習`,
        subtitleTh: `ข้อสอบจำลอง 5 ข้อเฉพาะจุด (${aiTopic.trim() || "คละทักษะ"}) พร้อมเฉลยละเอียด`,
        totalMinutes: 20,
        sectionTimings: [
          { labelTh: "คำศัพท์/ไวยากรณ์", minutes: 10 },
          { labelTh: "การอ่าน/การฟัง", minutes: 10 },
        ],
        mondaiGroups: raw.questions.map((q, idx) => {
          const sec: "vocab" | "grammar_reading" | "listening" =
            q.section === "vocab" || q.section === "listening"
              ? q.section
              : "grammar_reading";
          const bucket =
            sec === "listening"
              ? "listening"
              : selectedLevel === "N5" || selectedLevel === "N4"
                ? "vocabGrammarReading"
                : sec === "vocab"
                  ? "langKnowledge"
                  : idx === 3
                    ? "reading"
                    : "langKnowledge";
          const paddedChoices = [
            q.choices[0] ?? "1",
            q.choices[1] ?? "2",
            q.choices[2] ?? "3",
            q.choices[3] ?? "4",
          ] as [string, string, string, string];
          const safeCorrectIndex = Math.min(
            3,
            Math.max(0, q.correctIndex ?? 0)
          ) as 0 | 1 | 2 | 3;

          return {
            id: `ai-m-${idx}`,
            section: sec,
            scoringBucket: bucket,
            mondaiTitleJp: q.mondaiLabel || `問題${idx + 1}`,
            instructionJp: "次の文の質問に答えなさい。",
            instructionTh: "เลือกคำตอบที่เหมาะสมที่สุดเพียง 1 ข้อ",
            passageJp:
              sec === "grammar_reading" && idx === 3 ? raw.readingPassageJp : undefined,
            questions: [
              {
                id: `ai-q-${idx + 1}`,
                number: idx + 1,
                promptJp: q.promptJp,
                isKanjiReadingTarget: Boolean(q.targetWord),
                listeningScriptJp: sec === "listening" ? q.promptJp : undefined,
                choices: paddedChoices,
                correctIndex: safeCorrectIndex,
                explanationTh: q.explainTh,
              },
            ],
          };
        }),
      };

      startExam(mappedExam, false, "full");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดจาก AI");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleWordClick = async (tok: TokenizedWord, sentenceContext: string) => {
    setPickedToken(tok);
    setPickedContext(sentenceContext.replace(/[【】]/g, ""));
    setSaveNotice(null);

    const matched = findVocabMatch(
      tok.surface,
      tok.basicForm,
      tok.readingHiragana
    );
    if (matched) {
      setPickedMeaning(matched.meaningTh);
    } else {
      setPickedMeaning("");
      setTranslatingWord(true);
      try {
        const res = await translateJaToTh(tok.basicForm || tok.surface);
        if (res?.translation) {
          setPickedMeaning(res.translation);
        }
      } finally {
        setTranslatingWord(false);
      }
    }
    speakJapanese(tok.surface);
  };

  const handleSaveWordToFSRS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickedToken || !activeExam) return;
    const front = (pickedToken.basicForm || pickedToken.surface).trim();
    const reading = pickedToken.readingHiragana || front;
    const meaning = pickedMeaning.trim() || "คำศัพท์จากข้อสอบ " + activeExam.level;

    await mineCardToSrs({
      front,
      reading,
      meaningTh: meaning,
      exampleSentence: pickedContext.slice(0, 140),
      cardType: "vocab",
      tags: ["JLPT", activeExam.level, activeExam.yearLabel],
    });

    const summary = await getLearningSummary();
    setKnownFronts(summary.knownFronts);
    setExamMinedWords((prev) =>
      prev.some((w) => w.word === front)
        ? prev
        : [{ word: front, reading, meaningTh: meaning }, ...prev]
    );
    setSaveNotice(`เพิ่ม "${front}" เข้าคลัง FSRS แล้ว`);
  };

  const toggleFlag = (qId: string) => {
    setFlaggedIds((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  const toggleScript = (qId: string) => {
    setRevealedScripts((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  const togglePracticeCheck = (qId: string) => {
    setCheckedPracticeIds((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  const clickedDictEntry = useMemo(() => {
    if (!pickedToken) return null;
    return findVocabMatch(
      pickedToken.surface,
      pickedToken.basicForm,
      pickedToken.readingHiragana
    );
  }, [pickedToken]);

  const clickedKanji = useMemo(() => {
    if (!pickedToken) return [];
    return findKanjiMatches(pickedToken.surface);
  }, [pickedToken]);

  const buildQuestionSrsPayload = (
    q: JlptExamPaper["mondaiGroups"][number]["questions"][number],
    section: "vocab" | "grammar_reading" | "listening",
    level: JlptLevel
  ) => {
    const answerText = q.choices[q.correctIndex] ?? "";
    const focusMatch = q.promptJp.match(/【([^】]+)】/);
    const frontText = focusMatch
      ? focusMatch[1]
      : `${answerText} (${q.promptJp.slice(0, 24)})`;
    const isGrammar = section === "grammar_reading";
    return {
      front: frontText,
      reading: answerText,
      meaningTh: q.explanationTh,
      exampleSentence: q.promptJp,
      cardType: (isGrammar ? "grammar" : "vocab") as "grammar" | "vocab",
      tags: [
        "JLPT",
        level,
        isGrammar ? "Grammar" : section === "listening" ? "Listening" : "Vocab",
      ],
    };
  };

  const handleMineQuestionItem = async (
    q: JlptExamPaper["mondaiGroups"][number]["questions"][number],
    section: "vocab" | "grammar_reading" | "listening"
  ) => {
    if (!activeExam) return;
    const payload = buildQuestionSrsPayload(q, section, activeExam.level);
    await mineCardToSrs(payload);
    const summary = await getLearningSummary();
    setKnownFronts(summary.knownFronts);
    setSaveNotice(`เก็บ "${payload.front}" ลงคลัง FSRS แล้ว!`);
  };

  const handleMineAllWrongQuestions = async () => {
    if (!activeExam || !submittedReport) return;
    setBulkSavingWrong(true);
    setWrongSavedMsg(null);
    try {
      let added = 0;
      let totalWrong = 0;
      for (const group of activeExam.mondaiGroups) {
        for (const q of group.questions) {
          if (answers[q.id] === q.correctIndex) continue;
          totalWrong += 1;
          const res = await mineCardToSrs(
            buildQuestionSrsPayload(q, group.section, activeExam.level)
          );
          if (res.created) added += 1;
        }
      }
      const summary = await getLearningSummary();
      setKnownFronts(summary.knownFronts);
      setWrongSavedMsg(
        totalWrong === 0
          ? "คุณตอบถูกทุกข้อ ไม่มีข้อผิดให้เก็บเพิ่มเติมครับ!"
          : added > 0
            ? `เพิ่มข้อที่ตอบผิดเข้า FSRS ${added} รายการใหม่แล้ว (จากทั้งหมด ${totalWrong} ข้อผิด)`
            : `ทั้ง ${totalWrong} ข้อที่ตอบผิดมีอยู่ในคลัง FSRS แล้ว`
      );
    } finally {
      setBulkSavingWrong(false);
    }
  };

  // ============================================================
  // VIEW 1: EXAM LOBBY (Select Level N5-N1 & Multi-Year Sets)
  // ============================================================
  if (!activeExam) {
    return (
      <div className="space-y-6 animate-fade-up">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
              <Award className="w-4 h-4" strokeWidth={1.6} />
              <span>JLPT Full Exam Simulator • N5 – N1</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mt-0.5 tracking-tight">
              คลังข้อสอบวัดระดับ JLPT (N5 – N1)
            </h1>
            <p className="text-sm text-foreground/70 mt-1 max-w-2xl">
              ฝึกทำข้อสอบเต็มรูปแบบหลายชุดหลายปี (2012 – 2023) ครบทั้งคำศัพท์ คันจิ ไวยากรณ์ การอ่าน และเสียงฟัง
              พร้อมปุ่มเปิด-ปิดคำอ่าน (Furigana) และคลิกเก็บคำศัพท์ที่ไม่รู้ลงคลัง FSRS ได้ทันที
            </p>
          </div>

          <Link
            href="/srs?tag=JLPT"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 text-xs sm:text-sm font-medium self-start"
          >
            <FlashcardDeckIcon className="w-4 h-4" />
            <span>ทบทวนแฟลชการ์ดคำศัพท์ JLPT</span>
          </Link>
        </div>

        {/* Level Selector */}
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((lv) => {
            const count = JLPT_EXAMS.filter((e) => e.level === lv).length;
            const active = selectedLevel === lv;
            return (
              <button
                key={lv}
                type="button"
                onClick={() => setSelectedLevel(lv)}
                className={`px-4 py-2.5 rounded-xl border text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm -translate-y-0.5"
                    : "bg-surface border-border text-foreground/80 hover:bg-surface-muted"
                }`}
              >
                <span>JLPT {lv}</span>
                <span
                  className={`text-[11px] font-normal px-1.5 py-0.5 rounded-md ${
                    active ? "bg-white/20 text-white" : "bg-surface-muted text-foreground/65"
                  }`}
                >
                  {count} ชุด
                </span>
              </button>
            );
          })}
        </div>

        {/* Level Spec Banner */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${levelRule.badgeColor}`}
              >
                JLPT {levelRule.level}
              </span>
              <span className="text-sm font-bold">
                เกณฑ์ผ่านรวม {levelRule.totalPass} / 180 คะแนน • เวลามาตรฐาน {levelRule.totalMinutes} นาที
              </span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-foreground/75">{levelRule.descriptionTh}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {levelRule.sections.map((sec) => (
              <div
                key={sec.bucket}
                className="text-[11px] px-3 py-1.5 rounded-xl bg-surface-muted/75 border border-border/70 text-foreground/80"
              >
                <span className="font-semibold">{sec.labelTh}:</span> เต็ม {sec.max} (ขั้นต่ำ{" "}
                {sec.min})
              </div>
            ))}
          </div>
        </div>

        {/* Optional On-Demand AI Mock Generator */}
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Custom Mock Generator (ตัวเลือกเสริม)</span>
            </div>
            <div className="text-xs text-foreground/75">
              สร้างข้อสอบฝึกเสริมระดับ JLPT {selectedLevel} ชุดใหม่ 5 ข้อเฉพาะหัวข้อที่คุณอยากทบทวนเพิ่ม
            </div>
            {aiError && <div className="text-xs text-rose-500 font-medium">{aiError}</div>}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <input
              type="text"
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder="ระบุหัวข้อ (เช่น Keigo, อาหาร, ทำงาน)..."
              className="px-3 py-2 rounded-xl border border-border bg-surface text-xs w-56"
            />
            <button
              type="button"
              onClick={() => void handleGenerateAiMock()}
              disabled={aiGenerating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{aiGenerating ? "กำลังออกข้อสอบ..." : "สร้างชุดฝึกด้วย AI"}</span>
            </button>
          </div>
        </div>

        {/* Exam Papers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {examsForLevel.map((exam, idx) => {
            const totalQ = exam.mondaiGroups.reduce(
              (acc, g) => acc + g.questions.length,
              0
            );
            const pastForExam = attempts.filter((a) => a.examId === exam.id);
            const bestScore =
              pastForExam.length > 0
                ? Math.max(...pastForExam.map((a) => a.totalScaledScore))
                : null;
            const hasPassed = pastForExam.some((a) => a.passed);
            const savedDraft = drafts[exam.id];
            const draftAnswered = savedDraft
              ? Object.keys(savedDraft.answers ?? {}).length
              : 0;

            return (
              <div
                key={exam.id}
                className={`studio-card animate-fade-up stagger-${(idx % 4) + 1} rounded-2xl border bg-surface p-5 flex flex-col justify-between gap-4 ${
                  exam.isFullLength
                    ? "border-primary/45 ring-1 ring-primary/15"
                    : "border-border"
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span
                      className={`px-2.5 py-0.5 rounded-md font-semibold ${
                        exam.isFullLength
                          ? "bg-primary text-primary-foreground"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {exam.isFullLength ? "ฉบับเต็ม Full-Length" : exam.yearLabel}
                    </span>
                    <span className="font-mono text-foreground/60 inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {totalQ} ข้อ &bull; {exam.totalMinutes} นาที
                    </span>
                  </div>

                  <div>
                    <h2 className="text-base font-bold leading-snug">{exam.titleTh}</h2>
                    <div className="font-jp text-xs text-foreground/55 mt-0.5">
                      {exam.titleJp}
                    </div>
                  </div>

                  <p className="text-xs text-foreground/75 leading-relaxed">
                    {exam.subtitleTh}
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {exam.sectionTimings.map((st) => (
                      <span
                        key={st.labelTh}
                        className="text-[10px] px-2 py-0.5 rounded bg-surface-muted text-foreground/75"
                      >
                        {st.labelTh} ({st.minutes}น.)
                      </span>
                    ))}
                  </div>

                  {bestScore !== null && (
                    <div
                      className={`rounded-xl px-3 py-2 text-xs flex items-center justify-between border ${
                        hasPassed
                          ? "bg-matcha/10 border-matcha/30 text-matcha"
                          : "bg-surface-muted border-border text-foreground/80"
                      }`}
                    >
                      <span className="font-medium">
                        {hasPassed ? "เคยสอบผ่านแล้ว" : "ทำไปแล้ว"}
                      </span>
                      <span className="font-mono font-bold">สูงสุด {bestScore}/180</span>
                    </div>
                  )}

                  {savedDraft && draftAnswered > 0 && (
                    <div className="rounded-xl px-3 py-2 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold">ทำค้างไว้:</span> {draftAnswered}/{totalQ} ข้อ
                        {savedDraft.isTimedMode
                          ? ` • เหลือ ${formatClock(savedDraft.secondsLeft)}`
                          : ""}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => resumeDraftExam(exam)}
                          className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-semibold hover:opacity-90 cursor-pointer"
                        >
                          ทำต่อ
                        </button>
                        <button
                          type="button"
                          onClick={() => discardDraft(exam.id)}
                          className="px-2 py-1 rounded-lg border border-amber-500/40 hover:bg-amber-500/15 cursor-pointer"
                        >
                          ล้าง
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-border/70">
                  <div className="text-[11px] text-foreground/55">
                    ครบ {exam.mondaiGroups.length} พาร์ต ({totalQ} ข้อสอบพร้อมคำอธิบายไทย)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => startExam(exam, true, "full")}
                      className="px-2.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:opacity-95 transition-opacity cursor-pointer"
                    >
                      จับเวลารวม
                    </button>
                    <button
                      type="button"
                      onClick={() => startExam(exam, true, "section")}
                      className="px-2.5 py-2 rounded-xl border border-primary/40 bg-primary/10 text-primary text-xs font-medium hover:bg-primary/15 transition-colors cursor-pointer inline-flex items-center justify-center gap-1"
                    >
                      <Timer className="w-3.5 h-3.5" />
                      <span>จับเวลาทีละพาร์ต</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => startExam(exam, false, "full")}
                      className="px-2.5 py-2 rounded-xl border border-border bg-background hover:bg-surface-muted text-xs font-medium transition-colors cursor-pointer"
                    >
                      ฝึกซ้อม
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Past Exam Attempts */}
        {attempts.length > 0 && (
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold">
              <FileCheck2 className="w-4 h-4 text-primary" />
              <span>ประวัติการทำข้อสอบ JLPT ของคุณ</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {attempts.slice(0, 6).map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl border border-border bg-background/75 p-3 text-xs flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-bold truncate">{a.examTitle}</div>
                    <div className="text-foreground/60 mt-0.5">
                      ถูก {a.correctCount}/{a.totalQuestions} ข้อ
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`font-mono font-bold ${
                        a.passed ? "text-matcha" : "text-accent"
                      }`}
                    >
                      {a.totalScaledScore}/180
                    </div>
                    <div className="text-[10px] text-foreground/55">
                      {a.passed ? "PASS" : "RETRY"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // VIEW 2: ACTIVE EXAM & SCORE REPORT
  // ============================================================
  const answeredCount = allQuestionsInExam.filter(
    (q) => answers[q.id] !== undefined
  ).length;

  const visibleMondai = activeExam.mondaiGroups.filter(
    (g) => sectionFilter === "all" || g.section === sectionFilter
  );

  const countForSection = (sec: "all" | "vocab" | "grammar_reading" | "listening") => {
    const qs = activeExam.mondaiGroups
      .filter((g) => sec === "all" || g.section === sec)
      .flatMap((g) => g.questions);
    const done = qs.filter((q) => answers[q.id] !== undefined).length;
    return { done, total: qs.length };
  };

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Sticky Top Exam Toolbar */}
      <div className="sticky top-14 md:top-3 z-20 rounded-2xl border border-border bg-surface/95 backdrop-blur-md p-3.5 sm:p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={pauseAndExitToLobby}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-surface-muted text-xs font-medium cursor-pointer shrink-0"
              title="พักและบันทึกคำตอบเก็บไว้ทำต่อภายหลัง"
            >
              &larr; {!submittedReport && answeredCount > 0 ? "พักไว้ทำต่อ" : "คลังข้อสอบ"}
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                  {activeExam.level}
                </span>
                <h1 className="text-sm sm:text-base font-bold truncate">
                  {activeExam.titleTh}
                </h1>
              </div>
              <div className="text-[11px] text-foreground/60">
                ตอบแล้ว {answeredCount}/{allQuestionsInExam.length} ข้อ • คลิกคำภาษาญี่ปุ่นเพื่อเก็บลงคลังศัพท์
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Furigana Toggle Button */}
            <button
              type="button"
              onClick={() => setShowFurigana((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                showFurigana
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-background border-border text-foreground/80 hover:bg-surface-muted"
              }`}
              title="เปิด-ปิดคำอ่านฮิรางานะเหนือตัวคันจิ"
            >
              {showFurigana ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>คำอ่าน (Furigana): {showFurigana ? "เปิด" : "ปิด"}</span>
            </button>

            {showFurigana && (
              <button
                type="button"
                onClick={() => setRevealTargetKanjiReading((v) => !v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium cursor-pointer ${
                  revealTargetKanjiReading
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300"
                    : "bg-background border-border text-foreground/65"
                }`}
                title="แสดงคำอ่านบนคำถามข้อสอบอ่านคันจิด้วยหรือไม่"
              >
                <span>{revealTargetKanjiReading ? "เปิดคำตอบคันจิด้วย" : "ซ่อนเฉพาะคำที่ถาม"}</span>
              </button>
            )}

            {/* Timer */}
            {isTimedMode && !submittedReport && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface-muted font-mono text-xs font-bold">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span>{formatClock(secondsLeft)}</span>
                <span className="text-[10px] font-sans font-normal text-foreground/60">
                  ({timerScope === "section" ? "แยกพาร์ต" : "รวม"})
                </span>
                <button
                  type="button"
                  onClick={() => setTimerPaused((p) => !p)}
                  className="ml-1 text-foreground/60 hover:text-foreground cursor-pointer"
                  aria-label={timerPaused ? "Resume timer" : "Pause timer"}
                >
                  {timerPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                </button>
              </div>
            )}

            {!submittedReport ? (
              <button
                type="button"
                onClick={() => void handleSubmitExam()}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-accent text-white text-xs sm:text-sm font-semibold shadow-xs hover:opacity-95 cursor-pointer"
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>ส่งข้อสอบ</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => startExam(activeExam, isTimedMode, timerScope)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>ทำชุดนี้อีกครั้ง</span>
              </button>
            )}
          </div>
        </div>

        {/* Section Tabs with Per-Section Completion Progress */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/70">
          {[
            { id: "all", label: "ทุกพาร์ต" },
            { id: "vocab", label: "文字・語彙 (คำศัพท์-คันจิ)" },
            { id: "grammar_reading", label: "文法・読解 (ไวยากรณ์-อ่าน)" },
            { id: "listening", label: "聴解 (การฟัง)" },
          ].map((tab) => {
            const stat = countForSection(tab.id as typeof sectionFilter);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  const nextSec = tab.id as typeof sectionFilter;
                  setSectionFilter(nextSec);
                  if (isTimedMode && timerScope === "section" && activeExam && !submittedReport) {
                    setSecondsLeft(getSectionMinutes(activeExam, nextSec) * 60);
                  }
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                  sectionFilter === tab.id
                    ? "bg-foreground text-background"
                    : "bg-surface-muted/75 text-foreground/75 hover:bg-surface-muted"
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[10px] opacity-75 font-mono">
                  ({stat.done}/{stat.total})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Score Report Banner (After Submit) */}
      {submittedReport && (
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-5 animate-card-enter">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  submittedReport.passed
                    ? "bg-matcha/15 text-matcha"
                    : "bg-accent/15 text-accent"
                }`}
              >
                <CrestSealIcon className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-foreground/60">
                  JLPT Score Report &bull; {activeExam.level}
                </div>
                <h2 className="text-xl font-bold mt-0.5">
                  {submittedReport.passed
                    ? "ยินดีด้วย! คุณสอบผ่านเกณฑ์มาตรฐาน (合格)"
                    : "ยังไม่ผ่านเกณฑ์ — ลองดูคำอธิบายและเก็บศัพท์ที่ยังไม่รู้ด้านล่าง"}
                </h2>
                <p className="text-xs text-foreground/70 mt-1">
                  ตอบถูกทั้งหมด {submittedReport.correctCount} / {submittedReport.totalQuestions} ข้อ
                  (เกณฑ์ผ่านรวม {JLPT_LEVEL_RULES[activeExam.level].totalPass}/180 และต้องถึงขั้นต่ำทุกพาร์ต)
                </p>
                {submittedReport.correctCount < submittedReport.totalQuestions && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={bulkSavingWrong}
                      onClick={() => void handleMineAllWrongQuestions()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:opacity-95 disabled:opacity-50 cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>
                        {bulkSavingWrong
                          ? "กำลังเก็บ..."
                          : `เก็บข้อที่ตอบผิดลง FSRS (${submittedReport.totalQuestions - submittedReport.correctCount} ข้อ)`}
                      </span>
                    </button>
                    {wrongSavedMsg && (
                      <span className="text-xs text-matcha font-medium">{wrongSavedMsg}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background px-5 py-3 text-center shrink-0">
              <div className="text-[11px] text-foreground/60">คะแนนรวมจำลอง</div>
              <div
                className={`text-3xl font-bold font-mono ${
                  submittedReport.passed ? "text-matcha" : "text-accent"
                }`}
              >
                {submittedReport.totalScaledScore}
                <span className="text-sm font-normal text-foreground/50"> / 180</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {submittedReport.sectionResults.map((sec) => (
              <div
                key={sec.bucket}
                className="rounded-xl border border-border bg-background/75 p-3.5 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold">{sec.labelTh}</span>
                  <span
                    className={`font-bold text-[11px] ${
                      sec.sectionPassed ? "text-matcha" : "text-accent"
                    }`}
                  >
                    {sec.sectionPassed ? "ผ่าน" : `ไม่ถึงขั้นต่ำ (${sec.minRequired})`}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs text-foreground/70 font-mono">
                  <span>
                    ถูก {sec.rawCorrect}/{sec.rawTotal} ข้อ
                  </span>
                  <span className="text-base font-bold text-foreground">
                    {sec.scaledScore} / {sec.maxScore}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      sec.sectionPassed ? "bg-matcha" : "bg-accent"
                    }`}
                    style={{
                      width: `${Math.round((sec.scaledScore / sec.maxScore) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 cols: Questions */}
        <div className="lg:col-span-8 space-y-5">
          {visibleMondai.map((group) => (
            <div
              key={group.id}
              className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-5 shadow-xs"
            >
              {/* Mondai Header */}
              <div className="border-b border-border pb-3 space-y-1">
                <div className="text-xs font-bold text-primary uppercase tracking-wider">
                  {group.mondaiTitleJp}
                </div>
                <div className="text-sm font-medium">
                  <InteractiveJapaneseText
                    text={group.instructionJp}
                    showFurigana={showFurigana}
                    knownFronts={knownFronts}
                    selectedWord={pickedToken?.surface}
                    onWordClick={handleWordClick}
                  />
                </div>
                <div className="text-xs text-foreground/65">{group.instructionTh}</div>
              </div>

              {/* Optional Reading Passage */}
              {group.passageJp && (
                <div className="rounded-2xl border border-primary/20 bg-surface-muted/45 p-4 sm:p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-primary">
                      <BookOpen className="w-4 h-4" />
                      <span>{group.passageTitleJp ?? "บทอ่าน (読解)"}</span>
                    </div>
                    <SpeakButton text={group.passageJp} label="ฟังเสียงบทอ่าน" />
                  </div>
                  <div className="text-base sm:text-lg leading-[2.2] tracking-wide whitespace-pre-line">
                    <InteractiveJapaneseText
                      text={group.passageJp}
                      showFurigana={showFurigana}
                      knownFronts={knownFronts}
                      selectedWord={pickedToken?.surface}
                      onWordClick={handleWordClick}
                    />
                  </div>
                </div>
              )}

              {/* Questions in Mondai */}
              <div className="space-y-5">
                {group.questions.map((q) => {
                  const chosen = answers[q.id];
                  const isFlagged = flaggedIds.has(q.id);
                  const showResult = Boolean(submittedReport) || (!isTimedMode && checkedPracticeIds.has(q.id));
                  const isCorrect = chosen === q.correctIndex;
                  const scriptOpen = revealedScripts.has(q.id) || Boolean(submittedReport);

                  return (
                    <div
                      key={q.id}
                      id={`q-${q.id}`}
                      className="rounded-xl border border-border bg-background/60 p-4 sm:p-5 space-y-4 scroll-mt-36"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-1">
                            {q.number}
                          </span>
                          <div className="text-base sm:text-lg font-medium flex-1">
                            <InteractiveJapaneseText
                              text={q.promptJp}
                              showFurigana={showFurigana}
                              knownFronts={knownFronts}
                              selectedWord={pickedToken?.surface}
                              onWordClick={handleWordClick}
                              maskTargetReading={Boolean(
                                q.isKanjiReadingTarget &&
                                  !revealTargetKanjiReading &&
                                  !showResult
                              )}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleFlag(q.id)}
                          className={`p-1.5 rounded-lg border text-xs cursor-pointer shrink-0 ${
                            isFlagged
                              ? "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-300"
                              : "border-border text-foreground/45 hover:text-foreground"
                          }`}
                          title="ปักธงไว้กลับมาทวน"
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Listening Audio Player & Script */}
                      {q.listeningScriptJp && (
                        <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (playingQuestionId === q.id) {
                                    stopSpeaking();
                                    setPlayingQuestionId(null);
                                  } else {
                                    setPlayingQuestionId(q.id);
                                    void speakJapaneseDialogue(q.listeningScriptJp!, {
                                      rate: audioRate,
                                      onDone: () =>
                                        setPlayingQuestionId((curr) =>
                                          curr === q.id ? null : curr
                                        ),
                                    });
                                  }
                                }}
                                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium hover:opacity-95 cursor-pointer ${
                                  playingQuestionId === q.id
                                    ? "bg-rose-600 text-white"
                                    : "bg-primary text-primary-foreground"
                                }`}
                              >
                                {playingQuestionId === q.id ? (
                                  <>
                                    <Square className="w-3.5 h-3.5" />
                                    <span>หยุดเสียง</span>
                                  </>
                                ) : (
                                  <>
                                    <Volume2 className="w-4 h-4" />
                                    <span>เล่นเสียงโจทย์ข้อที่ {q.number}</span>
                                  </>
                                )}
                              </button>

                              <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-[11px]">
                                {[
                                  { rate: 0.8, label: "0.8x" },
                                  { rate: 0.95, label: "ปกติ" },
                                  { rate: 1.15, label: "1.15x" },
                                ].map((spd) => (
                                  <button
                                    key={spd.rate}
                                    type="button"
                                    onClick={() => setAudioRate(spd.rate)}
                                    className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                                      audioRate === spd.rate
                                        ? "bg-primary text-primary-foreground font-semibold"
                                        : "text-foreground/70 hover:text-foreground"
                                    }`}
                                  >
                                    {spd.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleScript(q.id)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-surface text-xs font-medium hover:bg-surface-muted cursor-pointer"
                            >
                              {scriptOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              <span>{scriptOpen ? "ซ่อนบทสนทนา" : "ดูสคริปต์ (Script)"}</span>
                            </button>
                          </div>

                          {speechCaps && (!speechCaps.supported || speechCaps.voiceCount === 0) && (
                            <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] text-foreground/85 flex flex-wrap items-center justify-between gap-2">
                              <span>
                                เบราว์เซอร์/อุปกรณ์นี้ยังไม่มีเสียงอ่านภาษาญี่ปุ่น (ja-JP) ในเครื่อง — สามารถกดดูบทสนทนาอ่านแทนได้ทันที หรือเปิดเสียงญี่ปุ่นในระบบ/Edge
                              </span>
                              {!scriptOpen && (
                                <button
                                  type="button"
                                  onClick={() => toggleScript(q.id)}
                                  className="font-semibold text-primary underline underline-offset-2 cursor-pointer shrink-0"
                                >
                                  เปิดสคริปต์ช่วยอ่าน
                                </button>
                              )}
                            </div>
                          )}

                          {scriptOpen && (
                            <div className="rounded-lg bg-surface p-3 border border-border text-sm whitespace-pre-line">
                              <InteractiveJapaneseText
                                text={q.listeningScriptJp}
                                showFurigana={showFurigana}
                                knownFronts={knownFronts}
                                selectedWord={pickedToken?.surface}
                                onWordClick={handleWordClick}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* 4 Choices */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {q.choices.map((ch, cIdx) => {
                          const selected = chosen === cIdx;
                          const isRightChoice = cIdx === q.correctIndex;

                          let boxStyle =
                            "border-border bg-surface hover:border-primary/40 hover:bg-surface-muted/40";
                          if (showResult) {
                            if (isRightChoice) {
                              boxStyle =
                                "border-matcha bg-matcha/10 text-foreground ring-1 ring-matcha/40";
                            } else if (selected && !isRightChoice) {
                              boxStyle =
                                "border-accent bg-accent/10 text-foreground ring-1 ring-accent/40";
                            }
                          } else if (selected) {
                            boxStyle =
                              "border-primary bg-primary/10 ring-1 ring-primary/40";
                          }

                          return (
                            <div
                              key={cIdx}
                              onClick={() => {
                                if (submittedReport) return;
                                setAnswers((prev) => ({ ...prev, [q.id]: cIdx }));
                              }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !submittedReport) {
                                  setAnswers((prev) => ({ ...prev, [q.id]: cIdx }));
                                }
                              }}
                              className={`rounded-xl border px-3.5 py-2.5 flex items-center gap-2.5 transition-all cursor-pointer select-none ${boxStyle}`}
                            >
                              <span
                                className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 border ${
                                  selected
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-surface-muted border-border text-foreground/75"
                                }`}
                              >
                                {cIdx + 1}
                              </span>
                              <div className="text-sm flex-1 min-w-0">
                                <InteractiveJapaneseText
                                  text={ch}
                                  showFurigana={showFurigana}
                                  knownFronts={knownFronts}
                                  selectedWord={pickedToken?.surface}
                                  onWordClick={handleWordClick}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Practice Mode Individual Check Button */}
                      {!isTimedMode && !submittedReport && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => togglePracticeCheck(q.id)}
                            className="text-xs font-medium text-primary hover:underline cursor-pointer"
                          >
                            {checkedPracticeIds.has(q.id)
                              ? "ซ่อนเฉลยข้อนี้"
                              : "ตรวจคำตอบ & ดูคำอธิบาย"}
                          </button>
                        </div>
                      )}

                      {/* Explanation */}
                      {showResult && (
                        <div
                          className={`rounded-xl p-3 text-xs leading-relaxed border flex items-start gap-2 ${
                            isCorrect
                              ? "bg-matcha/10 border-matcha/30 text-foreground/90"
                              : "bg-accent/10 border-accent/30 text-foreground/90"
                          }`}
                        >
                          {isCorrect ? (
                            <CheckCircle2 className="w-4 h-4 text-matcha shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-0.5">
                              <div className="font-bold">
                                {isCorrect
                                  ? "ถูกต้อง"
                                  : `เฉลย: ข้อ ${q.correctIndex + 1} (${q.choices[q.correctIndex]})`}
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleMineQuestionItem(q, group.section)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-surface hover:bg-surface-muted text-[11px] font-medium cursor-pointer shrink-0"
                              >
                                <PlusCircle className="w-3 h-3 text-primary" />
                                <span>
                                  {group.section === "grammar_reading"
                                    ? "เก็บไวยากรณ์เข้า FSRS"
                                    : "เก็บคำนี้เข้า FSRS"}
                                </span>
                              </button>
                            </div>
                            <p className="text-foreground/80">{q.explanationTh}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right 4 cols: Sticky Word Inspector & Navigator */}
        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-40">
          {/* Word Inspector + Save to Vocabulary */}
          <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                <Languages className="w-4 h-4" />
                <span>ตัวช่วยเก็บคำศัพท์จากข้อสอบ</span>
              </div>
              {examMinedWords.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-matcha/15 text-matcha font-semibold">
                  เก็บแล้ว {examMinedWords.length} คำ
                </span>
              )}
            </div>

            {!pickedToken ? (
              <div className="py-5 text-center space-y-2 text-xs text-foreground/65">
                <p className="leading-relaxed">
                  <strong>คลิกคำภาษาญี่ปุ่นคำใดก็ได้</strong> ในโจทย์ บทอ่าน ตัวเลือก หรือสคริปต์การฟัง
                  เพื่อดูคำอ่านฮิรางานะ ความหมายไทย และเพิ่มลงคลังคำศัพท์ FSRS ได้ทันที
                </p>
                <p className="text-[11px] text-foreground/50">
                  หากจำคันจิไม่ได้ สามารถกดปุ่ม &ldquo;คำอ่าน (Furigana)&rdquo; ด้านบนเพื่อเปิดคำอ่านทั้งหมดได้
                </p>
              </div>
            ) : (
              <form onSubmit={handleSaveWordToFSRS} className="space-y-3 animate-card-enter">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-jp text-2xl font-bold text-foreground">
                      {pickedToken.surface}
                    </div>
                    {pickedToken.basicForm !== pickedToken.surface && (
                      <div className="font-jp text-xs text-foreground/60">
                        รูปพจนานุกรม: {pickedToken.basicForm}
                      </div>
                    )}
                    <div className="font-jp text-sm text-primary font-semibold mt-0.5">
                      {pickedToken.readingHiragana || pickedToken.surface}
                    </div>
                  </div>
                  <SpeakButton text={pickedToken.surface} />
                </div>

                {clickedDictEntry && (
                  <div className="rounded-xl bg-surface-muted/70 p-2.5 text-xs space-y-0.5 border border-border/70">
                    <div className="font-semibold text-primary">จากคลังพจนานุกรมในเว็บ:</div>
                    <div>{clickedDictEntry.meaningTh}</div>
                  </div>
                )}

                {clickedKanji.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {clickedKanji.map((k) => (
                      <span
                        key={k.id}
                        className="text-[11px] px-2 py-1 rounded-lg border border-border bg-background font-jp"
                      >
                        <strong>{k.kanji}</strong> = {k.meaningTh}
                      </span>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground/70 block">
                    ความหมายไทยที่จะเก็บเข้าคลัง {translatingWord ? "(กำลังแปล...)" : ""}
                  </label>
                  <input
                    type="text"
                    required
                    value={pickedMeaning}
                    onChange={(e) => setPickedMeaning(e.target.value)}
                    placeholder="กรอกหรือแก้ความหมายไทย..."
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium inline-flex items-center justify-center gap-1.5 hover:opacity-95 cursor-pointer"
                >
                  {knownFronts.has(pickedToken.basicForm || pickedToken.surface) ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>อัปเดต/อยู่ในคลัง FSRS แล้ว</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>เพิ่มคำนี้เข้าคลังคำศัพท์ (FSRS)</span>
                    </>
                  )}
                </button>

                {saveNotice && (
                  <div className="text-xs text-matcha font-medium text-center">
                    {saveNotice}
                  </div>
                )}
              </form>
            )}

            {examMinedWords.length > 0 && (
              <div className="pt-3 border-t border-border space-y-2">
                <div className="flex items-center justify-between text-[11px] text-foreground/65">
                  <span>คำที่เก็บจากชุดนี้</span>
                  <Link
                    href={`/srs?tag=${encodeURIComponent(activeExam.yearLabel)}`}
                    className="text-primary font-semibold hover:underline"
                  >
                    ฝึกแฟลชการ์ด &rarr;
                  </Link>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {examMinedWords.map((w) => (
                    <span
                      key={w.word}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-matcha/10 text-matcha border border-matcha/25 font-jp"
                    >
                      {w.word} ({w.meaningTh})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Question Navigator Map */}
          <div className="rounded-2xl border border-border bg-surface p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>แผนผังข้อสอบ ({answeredCount}/{allQuestionsInExam.length})</span>
              <span className="text-[11px] font-normal text-foreground/60">
                กดเพื่อข้ามข้อ
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {allQuestionsInExam.map((q) => {
                const answered = answers[q.id] !== undefined;
                const flagged = flaggedIds.has(q.id);
                const gradedRight = submittedReport && answers[q.id] === q.correctIndex;
                const gradedWrong = submittedReport && answers[q.id] !== q.correctIndex;

                let cls = "bg-background border-border text-foreground/75";
                if (submittedReport) {
                  cls = gradedRight
                    ? "bg-matcha/15 border-matcha text-matcha font-bold"
                    : gradedWrong
                      ? "bg-accent/15 border-accent text-accent font-bold"
                      : cls;
                } else if (flagged) {
                  cls = "bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300 font-bold";
                } else if (answered) {
                  cls = "bg-primary text-primary-foreground border-primary font-bold";
                }

                return (
                  <a
                    key={q.id}
                    href={`#q-${q.id}`}
                    className={`h-8 rounded-lg border text-xs flex items-center justify-center transition-colors hover:opacity-85 ${cls}`}
                  >
                    {q.number}
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
