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
const {
  PLACEMENT_QUIZ_QUESTIONS,
  buildSettingsFromOnboarding,
  computeDailyStudyPlan,
  evaluatePlacementQuiz,
  sortFreshCardsByLevel,
} = require("../.test-dist/lib/studyPlan.js");
const { resolveAccountSyncStrategy } = require("../.test-dist/lib/accountIsolation.js");
const {
  buildStudyReminderIcs,
  parseReminderHHMM,
  shouldTriggerReminderToday,
} = require("../.test-dist/lib/studyReminder.js");
const {
  findExactJmdictWord,
  getKanjiVgStrokeOrder,
  getOpenDictStats,
  searchJmdict,
  searchKanjidic,
} = require("../.test-dist/lib/openDictServer.js");
const {
  computeLearnerProgressStats,
  getDailyWordHighlight,
  getJlptLevelBadgeStyle,
} = require("../.test-dist/lib/gamification.js");

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

test("Onboarding study plan computes real settings, exact time blocks, and level-sorted SRS queue", async () => {
  const baseSettings = {
    id: "user_settings",
    desiredRetention: 0.9,
    dailyNewCards: 15,
    speechRate: 0.95,
    preferredVoiceName: "",
    furiganaMode: "unknown",
    aiProvider: "offline",
    apiKey: "",
    aiModel: "gemini-3.8-flash",
    learnerLevel: "N5",
    theme: "system",
  };

  const n3Intensive = buildSettingsFromOnboarding(
    {
      proficiency: "n3",
      dailyMinutes: 30,
      studyGoalFocus: "jlpt",
    },
    baseSettings,
    "2026-11-16T05:00:00.000Z"
  );

  assert.equal(n3Intensive.learnerLevel, "N3");
  assert.equal(n3Intensive.dailyMinutes, 30);
  assert.equal(n3Intensive.dailyNewCards, 25);
  assert.equal(n3Intensive.studyGoalFocus, "jlpt");
  assert.equal(n3Intensive.onboardingCompleted, true);

  const plan = computeDailyStudyPlan(n3Intensive, { dueCount: 4, kanaMasteredCount: 0 });
  assert.equal(plan.dailyMinutes, 30);
  assert.equal(
    plan.blocks.reduce((sum, b) => sum + b.minutes, 0),
    30
  );
  assert.equal(plan.blocks.some((b) => b.href === "/jlpt"), true);
  // N3 user should NOT be forced into Kana Dojo first
  assert.equal(plan.blocks.some((b) => b.href === "/kana"), false);

  const zeroBeginner = buildSettingsFromOnboarding(
    {
      proficiency: "beginner_zero",
      dailyMinutes: 10,
      studyGoalFocus: "balanced",
    },
    baseSettings
  );
  assert.equal(zeroBeginner.furiganaMode, "all");
  assert.equal(zeroBeginner.dailyNewCards, 8);
  const beginnerPlan = computeDailyStudyPlan(zeroBeginner, { dueCount: 0, kanaMasteredCount: 0 });
  assert.equal(beginnerPlan.blocks.some((b) => b.href === "/kana"), true);

  const cN5 = { ...(await createInitialFsrsCard("c-n5", 0.9)), cardId: "c-n5" };
  const makeCard = (id, tag, fsrs) => ({
    id,
    cardType: "vocab",
    front: id,
    reading: id,
    meaningTh: id,
    meaningEn: id,
    tags: [tag],
    createdAt: "2026-11-16T00:00:00.000Z",
    dueAtMs: 0,
    fsrs,
  });

  const sortedForN3 = sortFreshCardsByLevel(
    [
      makeCard("a", "N5", cN5),
      makeCard("b", "N1", cN5),
      makeCard("c", "N3", cN5),
    ],
    "N3"
  );
  assert.equal(sortedForN3[0].id, "c");
});

test("Account switch sync strategy isolates shared browsers while preserving guest data", () => {
  // Unclaimed browser (guest) keeps local progress when claiming an account
  assert.equal(resolveAccountSyncStrategy(null, "user-a", false), "push_local_to_cloud");
  assert.equal(resolveAccountSyncStrategy(null, "user-a", true), "merge_local_and_cloud");

  // Same user returning merges normally
  assert.equal(resolveAccountSyncStrategy("user-a", "user-a", true), "merge_local_and_cloud");
  assert.equal(resolveAccountSyncStrategy("user-a", "user-a", false), "push_local_to_cloud");

  // Different user signing into shared browser never leaks previous owner's local data
  assert.equal(resolveAccountSyncStrategy("user-a", "user-b", true), "replace_with_cloud");
  assert.equal(resolveAccountSyncStrategy("user-a", "user-b", false), "reset_and_push_fresh");
});

test("Placement mini-quiz maps scores cleanly without emojis", () => {
  assert.equal(PLACEMENT_QUIZ_QUESTIONS.length, 6);
  for (const q of PLACEMENT_QUIZ_QUESTIONS) {
    assert.equal(EMOJI_REGEX.test(JSON.stringify(q)), false);
  }

  assert.equal(evaluatePlacementQuiz({}).recommendedTrack, "beginner_zero");

  const n4Answers = {
    "pl-kana-1": 0,
    "pl-kana-2": 1,
    "pl-n5-1": 2,
    "pl-n4-1": 0,
  };
  assert.equal(evaluatePlacementQuiz(n4Answers).recommendedTrack, "n4");

  const perfectAnswers = Object.fromEntries(
    PLACEMENT_QUIZ_QUESTIONS.map((q) => [q.id, q.correctIndex])
  );
  assert.equal(evaluatePlacementQuiz(perfectAnswers).recommendedTrack, "n2");
});

test("Daily study reminder scheduler and RFC 5545 ICS calendar export", () => {
  assert.deepEqual(parseReminderHHMM("invalid"), {
    hour: 20,
    minute: 0,
    formatted: "20:00",
  });
  assert.deepEqual(parseReminderHHMM("7:05"), {
    hour: 7,
    minute: 5,
    formatted: "07:05",
  });

  const night = new Date(2026, 10, 17, 20, 15, 0);
  const morning = new Date(2026, 10, 17, 9, 0, 0);
  assert.equal(
    shouldTriggerReminderToday({
      enabled: true,
      reminderTime: "20:00",
      dueCount: 5,
      lastRemindedDayKey: null,
      todayKey: "2026-11-17",
      now: night,
    }),
    true
  );
  assert.equal(
    shouldTriggerReminderToday({
      enabled: true,
      reminderTime: "20:00",
      dueCount: 5,
      lastRemindedDayKey: "2026-11-17",
      todayKey: "2026-11-17",
      now: night,
    }),
    false
  );
  assert.equal(
    shouldTriggerReminderToday({
      enabled: true,
      reminderTime: "20:00",
      dueCount: 5,
      lastRemindedDayKey: null,
      todayKey: "2026-11-17",
      now: morning,
    }),
    false
  );

  const ics = buildStudyReminderIcs({
    timeHHMM: "20:30",
    dailyMinutes: 30,
    learnerLevel: "N3",
    appOrigin: "https://kotonohajath.vercel.app/",
    now: new Date(2026, 10, 17, 10, 0, 0),
  });
  assert.ok(ics.includes("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.includes("RRULE:FREQ=DAILY\r\n"));
  assert.ok(ics.includes("DURATION:PT30M\r\n"));
  assert.ok(ics.includes("URL:https://kotonohajath.vercel.app/srs\r\n"));
  assert.equal(EMOJI_REGEX.test(ics), false);
});

test("Open Japanese dataset pipeline serves 20k+ JMdict words, 2.5k+ KANJIDIC2 kanji, and KanjiVG strokes", () => {
  const stats = getOpenDictStats();
  assert.ok(stats.jmdictCount >= 20000, `Expected >=20k JMdict entries, got ${stats.jmdictCount}`);
  assert.ok(stats.kanjidicCount >= 2500, `Expected >=2.5k KANJIDIC entries, got ${stats.kanjidicCount}`);
  assert.ok(stats.kanjivgCount >= 2500, `Expected >=2.5k KanjiVG chars, got ${stats.kanjivgCount}`);

  const exactSmall = findExactJmdictWord("小さい");
  assert.ok(exactSmall);
  assert.equal(exactSmall.reading, "ちいさい");
  assert.ok(exactSmall.meaningEn.toLowerCase().includes("small"));

  const jmdictSearch = searchJmdict({ query: "shinbun", limit: 10 });
  assert.ok(jmdictSearch.items.some((i) => i.reading === "しんぶん"));

  const kanjiRes = searchKanjidic({ query: "愛", level: "N3", limit: 10 });
  assert.equal(kanjiRes.items[0]?.kanji, "愛");
  assert.equal(kanjiRes.items[0]?.strokes, 13);

  const vgLove = getKanjiVgStrokeOrder("愛");
  assert.ok(vgLove);
  assert.equal(vgLove.viewBox, 109);
  assert.equal(vgLove.strokes.length, 13);
  assert.ok(vgLove.strokes[0].d.startsWith("M"));
});

test("XP rank progression, daily word highlight, and JLPT level badge styles", () => {
  const starter = computeLearnerProgressStats({
    totalReviews: 0,
    learnedCount: 0,
    masteredCount: 0,
    kanaMasteredCount: 0,
    completedMinnaCount: 0,
    jlptAttempts: [],
    streak: 0,
  });
  assert.equal(starter.totalXp, 0);
  assert.equal(starter.currentRank.level, 1);

  const mid = computeLearnerProgressStats({
    totalReviews: 50,
    learnedCount: 30,
    masteredCount: 15,
    kanaMasteredCount: 20,
    completedMinnaCount: 4,
    jlptAttempts: [{ passed: true }],
    streak: 5,
  });
  assert.ok(mid.totalXp >= 2500);
  assert.ok(mid.currentRank.level >= 4);
  assert.ok(mid.progressPct >= 0 && mid.progressPct <= 100);

  const dailyN4 = getDailyWordHighlight("2026-11-18", "N4");
  assert.ok(dailyN4.word.length > 0);
  assert.ok(dailyN4.meaningTh.length > 0);

  assert.ok(getJlptLevelBadgeStyle("N5").includes("emerald"));
  assert.ok(getJlptLevelBadgeStyle("N1").includes("rose"));
});
