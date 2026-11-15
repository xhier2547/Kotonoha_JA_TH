import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import Module, { createRequire } from "node:module";

// Map Next.js `@/` alias to compiled `.test-dist/` modules during Node tests
const testDistDir = path.resolve(import.meta.dirname, "../.test-dist");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    const mapped = path.join(testDistDir, request.slice(2));
    return origResolve.call(this, mapped, parent, isMain, options);
  }
  return origResolve.call(this, request, parent, isMain, options);
};

const require = createRequire(import.meta.url);

const {
  createInitialFsrsCard,
  computeRetrievability,
  buildSpacedSawtoothSeries,
} = require("../.test-dist/lib/fsrs.js");
const { conjugateWord } = require("../.test-dist/lib/conjugation.js");
const { parseDialogueTurns } = require("../.test-dist/lib/dialogueParser.js");
const { MINNA_LESSONS } = require("../.test-dist/data/minnaNoNihongo.js");
const {
  JLPT_EXAMS,
  calculateJlptScores,
} = require("../.test-dist/data/jlptExams.js");
const { findVocabMatch } = require("../.test-dist/lib/vocabLookup.js");
const {
  cardsToCsv,
  parseDelimitedDeck,
} = require("../.test-dist/lib/deckPortability.js");
const { parseSubtitleFile } = require("../.test-dist/lib/subtitleParser.js");
const {
  analyzeLearnerWeaknesses,
} = require("../.test-dist/lib/weaknessAnalyzer.js");
const { STROKE_ORDER_MAP } = require("../.test-dist/data/strokeOrders.js");
const { validateSupabaseEnv } = require("../.test-dist/lib/supabaseConfig.js");

// Check for Unicode emojis while allowing standard JLPT `★` (U+2605) sentence-ordering marker
const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{2604}\u{2606}-\u{27BF}]/u;

test("FSRS retrievability curve & initial card creation", async () => {
  const card = await createInitialFsrsCard("test-card-1", 0.9);
  assert.equal(card.reps, 0);
  assert.equal(card.cardId, "test-card-1");

  // Exact FSRS-7 formula: R(S, S) = (1 + S / (9 * S))^(-1) = 0.9
  assert.equal(computeRetrievability(10, 0), 1);
  assert.ok(Math.abs(computeRetrievability(10, 10) - 0.9) < 1e-9);
  assert.ok(computeRetrievability(10, 30) < computeRetrievability(10, 10));

  const sawtooth = buildSpacedSawtoothSeries(32);
  assert.equal(sawtooth.reviewDays.length, 4);
  assert.ok(sawtooth.spaced.length > sawtooth.unreviewed.length);
  const lastSpaced = sawtooth.spaced[sawtooth.spaced.length - 1].retention;
  const lastUnreviewed = sawtooth.unreviewed[sawtooth.unreviewed.length - 1].retention;
  assert.ok(lastSpaced > lastUnreviewed);
});

test("Japanese verb and adjective conjugation rules", () => {
  assert.equal(conjugateWord("行く", "godan", "te").answer, "行って");
  assert.equal(conjugateWord("食べる", "ichidan", "nai").answer, "食べない");
  assert.equal(conjugateWord("食べる", "ichidan", "potential").answer, "食べられる");
  assert.equal(conjugateWord("勉強する", "irregular", "potential").answer, "勉強できる");
  assert.equal(conjugateWord("来る", "irregular", "volitional").answer, "来よう");
  assert.equal(conjugateWord("いい", "i-adj", "nai").answer, "よくない");
  assert.equal(conjugateWord("いい", "i-adj", "ba").answer, "よければ");
  assert.equal(conjugateWord("静か", "na-adj", "ta").answer, "静かだった");
});

test("Dialogue parser strips speaker prefixes and tags genders", () => {
  const script = [
    "状況：駅の前で話しています。",
    "女：すみません、東京駅はどちらですか。",
    "男：まっすぐ行って、右に曲がってください。",
    "[店員] ありがとうございました。",
  ].join("\n");

  const turns = parseDialogueTurns(script);
  assert.equal(turns.length, 4);
  assert.equal(turns[0].gender, "narrator");
  assert.equal(turns[0].text, "駅の前で話しています。");
  assert.equal(turns[1].gender, "female");
  assert.equal(turns[1].text, "すみません、東京駅はどちらですか。");
  assert.equal(turns[2].gender, "male");
  assert.equal(turns[2].text, "まっすぐ行って、右に曲がってください。");
  assert.equal(turns[3].speakerLabel, "店員");
  assert.equal(turns[3].text, "ありがとうございました。");
});

test("Minna no Nihongo covers all 50 chapters cleanly without emojis", () => {
  assert.equal(MINNA_LESSONS.length, 50);

  for (let i = 0; i < 50; i++) {
    const lesson = MINNA_LESSONS[i];
    assert.equal(lesson.lesson, i + 1);
    assert.ok(lesson.grammarPoints.length >= 1, `Lesson ${lesson.lesson} grammarPoints`);
    assert.ok(lesson.vocab.length >= 5, `Lesson ${lesson.lesson} vocab`);
    assert.ok(lesson.miniKaiwa.length >= 2, `Lesson ${lesson.lesson} miniKaiwa`);
    assert.ok(lesson.quiz.length >= 1, `Lesson ${lesson.lesson} quiz`);

    for (const q of lesson.quiz) {
      assert.ok(q.choices.includes(q.answer), `Lesson ${lesson.lesson} quiz answer in choices`);
    }

    assert.equal(
      EMOJI_REGEX.test(JSON.stringify(lesson)),
      false,
      `Lesson ${lesson.lesson} must not contain emojis`
    );
  }
});

test("JLPT 17 exams dataset integrity, Full-Length specs, and sectional scoring", () => {
  assert.equal(JLPT_EXAMS.length, 17);

  const countsByLevel = {};
  const fullLengthCounts = {};
  for (const exam of JLPT_EXAMS) {
    countsByLevel[exam.level] = (countsByLevel[exam.level] ?? 0) + 1;
    let seq = 1;
    for (const group of exam.mondaiGroups) {
      for (const q of group.questions) {
        assert.equal(q.number, seq, `${exam.id}:${q.id} sequential number`);
        seq += 1;
        assert.equal(q.choices.length, 4, `${exam.id}:${q.id} choices`);
        assert.ok(q.correctIndex >= 0 && q.correctIndex <= 3, `${exam.id}:${q.id} correctIndex`);
      }
    }
    const totalQuestions = seq - 1;
    if (exam.isFullLength) {
      fullLengthCounts[exam.level] = totalQuestions;
      assert.ok(totalQuestions >= 65, `${exam.id} full-length must have >= 65 questions`);
    }
    assert.equal(
      EMOJI_REGEX.test(JSON.stringify(exam)),
      false,
      `${exam.id} must not contain emojis`
    );
  }

  assert.deepEqual(countsByLevel, { N5: 4, N4: 4, N3: 3, N2: 3, N1: 3 });
  assert.deepEqual(fullLengthCounts, { N5: 70, N4: 70, N3: 66, N2: 66, N1: 65 });

  // Verify local vocab lookup covers Minna + CoreKanji examples (e.g. 小さい -> เล็ก)
  const smallMatch = findVocabMatch("小さい", "小さい", "ちいさい");
  assert.ok(smallMatch);
  assert.equal(smallMatch.meaningTh, "เล็ก");

  // Perfect answers on N5
  const n5Exam = JLPT_EXAMS.find((e) => e.level === "N5");
  const allCorrect = {};
  for (const g of n5Exam.mondaiGroups) {
    for (const q of g.questions) {
      allCorrect[q.id] = q.correctIndex;
    }
  }
  const perfectReport = calculateJlptScores(n5Exam, allCorrect);
  assert.equal(perfectReport.totalScaledScore, 180);
  assert.equal(perfectReport.passed, true);

  // Failing listening minimum (0 listening, 120 vocab/reading = total 120 >= 80, but listening 0 < 19 -> FAIL)
  const failListening = {};
  for (const g of n5Exam.mondaiGroups) {
    for (const q of g.questions) {
      failListening[q.id] =
        g.scoringBucket === "listening" ? ((q.correctIndex + 1) % 4) : q.correctIndex;
    }
  }
  const failReport = calculateJlptScores(n5Exam, failListening);
  assert.equal(failReport.totalScaledScore, 120);
  assert.equal(failReport.passed, false);
});

test("CSV & Anki TSV portability round-trip handles quotes, tabs, and HTML/sound tags", () => {
  const sampleCards = [
    {
      front: "食べる",
      reading: "たべる",
      meaningTh: "กิน, รับประทาน",
      meaningEn: "to eat",
      cardType: "vocab",
      tags: ["N5", "Verb"],
      exampleSentence: "朝ごはんを食べる。",
      mnemonic: 'นึกถึงคำว่า "ทาเบะ" ตอนกินข้าว',
    },
  ];

  const csvText = cardsToCsv(sampleCards);
  const parsedCsv = parseDelimitedDeck(csvText);
  assert.equal(parsedCsv.length, 1);
  assert.equal(parsedCsv[0].front, "食べる");
  assert.equal(parsedCsv[0].reading, "たべる");
  assert.equal(parsedCsv[0].meaningTh, "กิน, รับประทาน");
  assert.deepEqual(parsedCsv[0].tags, ["Imported", "N5", "Verb"]);

  const ankiTsv = [
    "#separator:tab",
    "#html:true",
    "図書館[sound:rec123.mp3]\t<b>ห้องสมุด</b><br>library\tとしょかん\tN5 Place",
  ].join("\n");
  const parsedTsv = parseDelimitedDeck(ankiTsv);
  assert.equal(parsedTsv.length, 1);
  assert.equal(parsedTsv[0].front, "図書館");
  assert.equal(parsedTsv[0].meaningTh, "ห้องสมุด / library");
  assert.equal(parsedTsv[0].reading, "としょかん");
  assert.deepEqual(parsedTsv[0].tags, ["Imported", "N5", "Place"]);
});

test("Subtitle parser strips SRT/WEBVTT timestamps, cue indices, and HTML/ASS tags", () => {
  const vtt = [
    "WEBVTT",
    "",
    "1",
    "00:00:01.000 --> 00:00:03.500",
    "{\\an8}<b>おはようございます！</b>",
    "",
    "2",
    "00:00:04.000 --> 00:00:06.200",
    "今日も頑張りましょう。",
    "今日も頑張りましょう。",
  ].join("\n");

  const parsed = parseSubtitleFile("episode_01.vtt", vtt);
  assert.equal(parsed.title, "episode_01");
  assert.equal(parsed.lineCount, 2);
  assert.equal(parsed.content, "おはようございます！\n今日も頑張りましょう。");
});

test("Weakness analyzer spots high-lapse SRS cards and failing JLPT sections", () => {
  const nowIso = "2026-11-16T00:00:00.000Z";
  const analysis = analyzeLearnerWeaknesses({
    cards: [
      {
        id: "c1",
        cardType: "vocab",
        front: "約束",
        reading: "やくそく",
        meaningTh: "คำสัญญา",
        meaningEn: "promise",
        tags: ["N4"],
        createdAt: nowIso,
        dueAtMs: 0,
        fsrs: {
          stability: 1.2,
          stabilityFast: 1.2,
          difficulty: 7.4,
          state: 3,
          scheduleStatus: "learning",
          dueAt: nowIso,
          lastReviewAt: nowIso,
          cardId: "c1",
          reps: 5,
          lapses: 3,
          scheduledDays: 1,
          learningStep: 0,
        },
      },
      {
        id: "c2",
        cardType: "vocab",
        front: "猫",
        reading: "ねこ",
        meaningTh: "แมว",
        meaningEn: "cat",
        tags: ["N5"],
        createdAt: nowIso,
        dueAtMs: 0,
        fsrs: {
          stability: 30,
          stabilityFast: 30,
          difficulty: 2.5,
          state: 2,
          scheduleStatus: "review",
          dueAt: nowIso,
          lastReviewAt: nowIso,
          cardId: "c2",
          reps: 6,
          lapses: 0,
          scheduledDays: 20,
          learningStep: 0,
        },
      },
    ],
    reviewLogs: [
      { id: 1, cardId: "c1", rating: 1, reviewedAt: nowIso, dayKey: "2026-11-16", scheduledDays: 1 },
      { id: 2, cardId: "c1", rating: 1, reviewedAt: nowIso, dayKey: "2026-11-16", scheduledDays: 1 },
      { id: 3, cardId: "c2", rating: 3, reviewedAt: nowIso, dayKey: "2026-11-16", scheduledDays: 10 },
      { id: 4, cardId: "c2", rating: 4, reviewedAt: nowIso, dayKey: "2026-11-16", scheduledDays: 20 },
    ],
    jlptAttempts: [
      {
        id: "att-1",
        examId: "n4-set-1",
        level: "N4",
        examTitle: "N4 Mock 1",
        totalScaledScore: 85,
        sectionScores: { vocabGrammarReading: 70, listening: 15 },
        passed: false,
        correctCount: 20,
        totalQuestions: 32,
        durationSec: 600,
        completedAt: nowIso,
      },
    ],
  });

  assert.equal(analysis.againRatePct, 50);
  assert.equal(analysis.hardestCards.length, 1);
  assert.equal(analysis.hardestCards[0].front, "約束");
  assert.equal(analysis.weakJlptSections[0].key, "listening");
  assert.equal(analysis.weakJlptSections[0].status, "below_pass");
  assert.equal(analysis.hasSufficientData, true);
});

test("Stroke order dataset has valid 100x100 paths and Thai tips", () => {
  const entries = Object.values(STROKE_ORDER_MAP);
  assert.ok(entries.length >= 25);
  for (const entry of entries) {
    assert.ok(entry.strokes.length >= 1, `Missing strokes for ${entry.char}`);
    assert.ok(entry.ruleTipTh.trim().length > 0, `Missing ruleTipTh for ${entry.char}`);
    for (const s of entry.strokes) {
      assert.ok(s.d.startsWith("M "), `Invalid SVG path for ${entry.char}`);
      assert.ok(
        s.start[0] >= 0 && s.start[0] <= 100 && s.start[1] >= 0 && s.start[1] <= 100,
        `Out of bounds start coord for ${entry.char}`
      );
    }
    assert.equal(EMOJI_REGEX.test(JSON.stringify(entry)), false);
  }
});

test("Supabase env validation prevents invalid URL crash and blocks sb_secret_ in public key", () => {
  assert.deepEqual(validateSupabaseEnv("", ""), {
    valid: false,
    issue: "missing",
    normalizedUrl: "",
  });
  assert.deepEqual(
    validateSupabaseEnv("sb_publishable_abc123", "eyJ_anon"),
    { valid: false, issue: "invalid_url", normalizedUrl: "" }
  );
  assert.deepEqual(
    validateSupabaseEnv("https://supabase.com/dashboard/project/abc", "eyJ_anon"),
    { valid: false, issue: "invalid_url", normalizedUrl: "" }
  );
  assert.deepEqual(
    validateSupabaseEnv("https://example.supabase.co", "sb_secret_123"),
    { valid: false, issue: "secret_key_used_as_public", normalizedUrl: "" }
  );
  assert.deepEqual(
    validateSupabaseEnv("https://example.supabase.co/rest/v1/", "sb_publishable_abc123"),
    {
      valid: true,
      issue: "ok",
      normalizedUrl: "https://example.supabase.co",
    }
  );
});
