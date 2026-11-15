import type {
  AppSettings,
  JlptLevel,
  SrsCardRecord,
  StudyGoalFocus,
} from "@/types/learning";

export type ProficiencyTrack =
  | "beginner_zero"
  | "n5"
  | "n4"
  | "n3"
  | "n2"
  | "n1";

export interface ProficiencyOption {
  id: ProficiencyTrack;
  label: string;
  badge: string;
  description: string;
  learnerLevel: JlptLevel;
  furiganaMode: AppSettings["furiganaMode"];
}

export const PROFICIENCY_OPTIONS: ProficiencyOption[] = [
  {
    id: "beginner_zero",
    label: "เริ่มต้นจากศูนย์",
    badge: "Kana + N5",
    description: "ยังจำฮิรางานะ-คาตาคานะไม่คล่อง เน้นปูพื้นและเปิดคำอ่านทุกคำ",
    learnerLevel: "N5",
    furiganaMode: "all",
  },
  {
    id: "n5",
    label: "พื้นฐาน N5",
    badge: "N5",
    description: "อ่านฮิรางานะ-คาตาคานะได้แล้ว ต้องการสะสมศัพท์พื้นฐานและไวยากรณ์ต้น",
    learnerLevel: "N5",
    furiganaMode: "unknown",
  },
  {
    id: "n4",
    label: "ระดับต้นตอนปลาย N4",
    badge: "N4",
    description: "สื่อสารชีวิตประจำวันได้บ้าง พร้อมลุย Minna เล่ม 2 (บทที่ 26+) และผันกริยา",
    learnerLevel: "N4",
    furiganaMode: "unknown",
  },
  {
    id: "n3",
    label: "ระดับกลาง N3",
    badge: "N3",
    description: "อ่านเรื่องสั้นและฟังบทสนทนาทั่วไปได้ เน้นสะสมศัพท์กลางและอ่านจริง",
    learnerLevel: "N3",
    furiganaMode: "unknown",
  },
  {
    id: "n2",
    label: "ระดับกลาง-สูง N2",
    badge: "N2",
    description: "อ่านข่าวและบทความทำงานได้ เน้นปิด Furigana คำที่รู้แล้วและซ้อมสอบ",
    learnerLevel: "N2",
    furiganaMode: "unknown",
  },
  {
    id: "n1",
    label: "ระดับเชี่ยวชาญ N1",
    badge: "N1",
    description: "อ่านบทความวิชาการและเนื้อหาซับซ้อน ซ่อน Furigana เพื่อจำคันจิเต็มรูปแบบ",
    learnerLevel: "N1",
    furiganaMode: "off",
  },
];

export interface DailyTimePreset {
  minutes: number;
  label: string;
  subtitle: string;
  dailyNewCards: number;
  desiredRetention: number;
  reviewTargetCount: number;
}

export const DAILY_TIME_OPTIONS: DailyTimePreset[] = [
  {
    minutes: 10,
    label: "10 นาที / วัน",
    subtitle: "สายเร่งด่วน เน้นรักษา Streak",
    dailyNewCards: 8,
    desiredRetention: 0.88,
    reviewTargetCount: 15,
  },
  {
    minutes: 20,
    label: "20 นาที / วัน",
    subtitle: "สมดุลสม่ำเสมอ (แนะนำ)",
    dailyNewCards: 15,
    desiredRetention: 0.9,
    reviewTargetCount: 25,
  },
  {
    minutes: 30,
    label: "30 นาที / วัน",
    subtitle: "พัฒนาไว ครบทั้งศัพท์และบทสนทนา",
    dailyNewCards: 25,
    desiredRetention: 0.9,
    reviewTargetCount: 40,
  },
  {
    minutes: 60,
    label: "60 นาที / วัน",
    subtitle: "โหมดเร่งรัด เตรียมสอบ JLPT",
    dailyNewCards: 35,
    desiredRetention: 0.92,
    reviewTargetCount: 60,
  },
];

export interface StudyFocusOption {
  id: StudyGoalFocus;
  label: string;
  description: string;
}

export const STUDY_FOCUS_OPTIONS: StudyFocusOption[] = [
  {
    id: "balanced",
    label: "สมดุลทุกทักษะ",
    description: "ทบทวนศัพท์ FSRS + อ่าน/Minna + ฝึกพูด/ฟังครบวงจร",
  },
  {
    id: "jlpt",
    label: "เตรียมสอบ JLPT",
    description: "เน้นศัพท์-คันจิ-ไวยากรณ์และทำข้อสอบจำลองตามระดับที่เลือก",
  },
  {
    id: "conversation",
    label: "เน้นพูดโต้ตอบ & ฟัง",
    description: "เน้นฝึก AI Kaiwa, Shadowing และจำเสียง Pitch Accent",
  },
  {
    id: "reading",
    label: "เน้นอ่านจริง & เก็บศัพท์",
    description: "เน้น Immersion Reader ตัดคำและเก็บประโยค i+1 ลง FSRS",
  },
];

export interface OnboardingAnswers {
  proficiency: ProficiencyTrack;
  dailyMinutes: number;
  studyGoalFocus: StudyGoalFocus;
}

export interface StudyPlanBlock {
  title: string;
  detail: string;
  minutes: number;
  href: string;
  cta: string;
}

export interface DailyStudyPlan {
  learnerLevel: JlptLevel;
  dailyMinutes: number;
  dailyNewCards: number;
  reviewTargetCount: number;
  focusLabelTh: string;
  blocks: StudyPlanBlock[];
}

const JLPT_RANK: Record<JlptLevel, number> = {
  N5: 1,
  N4: 2,
  N3: 3,
  N2: 4,
  N1: 5,
};

const VALID_LEVELS: JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];

export function inferProficiencyTrack(settings: AppSettings): ProficiencyTrack {
  if (settings.learnerLevel === "N5" && settings.furiganaMode === "all") {
    return "beginner_zero";
  }
  switch (settings.learnerLevel) {
    case "N4":
      return "n4";
    case "N3":
      return "n3";
    case "N2":
      return "n2";
    case "N1":
      return "n1";
    default:
      return "n5";
  }
}

export function getDailyTimePreset(minutes?: number): DailyTimePreset {
  const target = minutes ?? 20;
  return (
    DAILY_TIME_OPTIONS.find((opt) => opt.minutes === target) ??
    DAILY_TIME_OPTIONS[1]
  );
}

/** Computes tailored AppSettings fields from first-login onboarding choices. */
export function buildSettingsFromOnboarding(
  answers: OnboardingAnswers,
  current: AppSettings,
  nowIso = new Date().toISOString()
): AppSettings {
  const prof =
    PROFICIENCY_OPTIONS.find((o) => o.id === answers.proficiency) ??
    PROFICIENCY_OPTIONS[1];
  const timePreset = getDailyTimePreset(answers.dailyMinutes);

  return {
    ...current,
    id: "user_settings",
    learnerLevel: prof.learnerLevel,
    furiganaMode: prof.furiganaMode,
    dailyMinutes: timePreset.minutes,
    dailyNewCards: timePreset.dailyNewCards,
    desiredRetention: timePreset.desiredRetention,
    studyGoalFocus: answers.studyGoalFocus,
    onboardingCompleted: true,
    onboardingCompletedAt: nowIso,
  };
}

/** Builds a concrete daily time-boxed study plan matched to user settings. */
export function computeDailyStudyPlan(
  settings: AppSettings,
  metrics?: { dueCount?: number; kanaMasteredCount?: number }
): DailyStudyPlan {
  const preset = getDailyTimePreset(settings.dailyMinutes);
  const dailyMinutes = settings.dailyMinutes && settings.dailyMinutes > 0
    ? settings.dailyMinutes
    : preset.minutes;
  const focus = settings.studyGoalFocus ?? "balanced";
  const level = settings.learnerLevel;
  const focusLabelTh =
    STUDY_FOCUS_OPTIONS.find((o) => o.id === focus)?.label ?? "สมดุลทุกทักษะ";
  const needsKana =
    level === "N5" &&
    (settings.furiganaMode === "all" || (metrics?.kanaMasteredCount ?? 25) < 25);

  const srsMinutes = Math.max(4, Math.round(dailyMinutes * 0.35));
  const coreMinutes = Math.max(3, Math.round(dailyMinutes * 0.4));
  const outputMinutes = Math.max(2, dailyMinutes - srsMinutes - coreMinutes);

  const srsBlock: StudyPlanBlock = {
    title: "ทบทวน & เพิ่มคลังสมอง FSRS-7",
    detail:
      (metrics?.dueCount ?? 0) > 0
        ? `เคลียร์การ์ดค้าง ${metrics?.dueCount} ใบ + ศัพท์ใหม่ระดับ ${level} สูงสุด ${settings.dailyNewCards} ใบ`
        : `เรียนศัพท์/คันจิใหม่ระดับ ${level} (วันละ ${settings.dailyNewCards} ใบ)`,
    minutes: srsMinutes,
    href: "/srs",
    cta: "เปิดคลัง FSRS",
  };

  let coreBlock: StudyPlanBlock;
  let outputBlock: StudyPlanBlock;

  if (needsKana && focus === "balanced") {
    coreBlock = {
      title: "ปูพื้นฐาน Kana & Pitch Accent",
      detail: "ฝึกจำ Hiragana/Katakana ให้ครบ 46 ตัวแรกด้วยเกม Active Recall",
      minutes: coreMinutes,
      href: "/kana",
      cta: "ฝึก Kana Dojo",
    };
    outputBlock = {
      title: "Minna no Nihongo บทแรก",
      detail: "ดูโครงสร้างประโยคพื้นฐานพร้อมฝึกฟังบทสนทนาจริง",
      minutes: outputMinutes,
      href: "/minna",
      cta: "เปิดตำรา Minna",
    };
  } else if (focus === "jlpt") {
    coreBlock = {
      title: `ตะลุยข้อสอบ JLPT ${level}`,
      detail: `ฝึกทำข้อสอบระดับ ${level} (คำศัพท์-ไวยากรณ์-อ่าน-ฟัง) และเก็บคำไม่รู้`,
      minutes: coreMinutes,
      href: "/jlpt",
      cta: `ทำข้อสอบ ${level}`,
    };
    outputBlock = {
      title: "อ่านเสริมระดับเดียวกัน (i+1)",
      detail: `อ่านบทความระดับ ${level} และฝึกผันกริยาให้แม่นในสนามสอบ`,
      minutes: outputMinutes,
      href: "/reader",
      cta: "เปิดหน้าอ่าน",
    };
  } else if (focus === "conversation") {
    coreBlock = {
      title: "ฝึกพูดโต้ตอบ AI Kaiwa",
      detail: `จำลองบทสนทนาระดับ ${level} พร้อมตรวจความเป็นธรรมชาติ`,
      minutes: coreMinutes,
      href: "/kaiwa",
      cta: "คุยกับ AI Kaiwa",
    };
    outputBlock = {
      title: "Shadowing จับจังหวะเสียง",
      detail: "พูดตามเจ้าของภาษาเทียบ Pitch Accent และฝึกฟังซ้ำ",
      minutes: outputMinutes,
      href: "/shadowing",
      cta: "ฝึก Shadowing",
    };
  } else if (focus === "reading") {
    coreBlock = {
      title: `Immersion Reader ระดับ ${level}`,
      detail: "อ่านบทความจริง ตัดคำด้วย Kuromoji แล้วคลิกเก็บศัพท์เข้า FSRS",
      minutes: coreMinutes,
      href: "/reader",
      cta: "เปิด Immersion Reader",
    };
    outputBlock = {
      title: level === "N5" || level === "N4" ? "ทบทวนโครงสร้าง Minna" : `ทดสอบความเข้าใจ JLPT ${level}`,
      detail:
        level === "N5" || level === "N4"
          ? `สรุปไวยากรณ์ Minna เล่ม ${level === "N4" ? "2 (บท 26+)" : "1"}`
          : `เช็กความแม่นในการอ่านจับใจความระดับ ${level}`,
      minutes: outputMinutes,
      href: level === "N5" || level === "N4" ? "/minna" : "/jlpt",
      cta: level === "N5" || level === "N4" ? "เปิด Minna" : `สอบ ${level}`,
    };
  } else {
    // Balanced (Kana already known)
    coreBlock =
      level === "N5" || level === "N4"
        ? {
            title: `เรียนไวยากรณ์ Minna (${level === "N4" ? "บทที่ 26+" : "บทที่ 1+"})`,
            detail: "เข้าใจไวยากรณ์เป็นระบบพร้อมกดดูดศัพท์ทั้งบทเข้า FSRS",
            minutes: coreMinutes,
            href: "/minna",
            cta: "เปิด Minna",
          }
        : {
            title: `Immersion Reader & JLPT ${level}`,
            detail: `อ่านบทความระดับ ${level} เพื่อรักษาสัญชาตญาณภาษาและเก็บศัพท์ใหม่`,
            minutes: coreMinutes,
            href: "/reader",
            cta: "เปิดหน้าอ่าน",
          };
    outputBlock = {
      title: "ฝึกพูด AI Kaiwa / Shadowing",
      detail: "นำศัพท์ที่เรียนมาใช้พูดจริงในสถานการณ์จำลองประจำวัน",
      minutes: outputMinutes,
      href: "/kaiwa",
      cta: "ฝึกพูด Kaiwa",
    };
  }

  return {
    learnerLevel: level,
    dailyMinutes,
    dailyNewCards: settings.dailyNewCards,
    reviewTargetCount: preset.reviewTargetCount,
    focusLabelTh,
    blocks: [srsBlock, coreBlock, outputBlock],
  };
}

function getCardJlptDistance(card: SrsCardRecord, targetLevel: JlptLevel): number {
  const targetRank = JLPT_RANK[targetLevel];
  let bestDist = 99;
  for (const tag of card.tags) {
    if (VALID_LEVELS.includes(tag as JlptLevel)) {
      const dist = Math.abs(JLPT_RANK[tag as JlptLevel] - targetRank);
      if (dist < bestDist) bestDist = dist;
    }
  }
  // Prefer user-mined cards right alongside target-level study cards
  if (bestDist === 99 && card.id.startsWith("mined-")) {
    return 0;
  }
  return bestDist;
}

/** Prioritizes unlearned SRS cards closest to the user's current JLPT level. */
export function sortFreshCardsByLevel(
  cards: SrsCardRecord[],
  targetLevel: JlptLevel
): SrsCardRecord[] {
  return [...cards].sort(
    (a, b) => getCardJlptDistance(a, targetLevel) - getCardJlptDistance(b, targetLevel)
  );
}
