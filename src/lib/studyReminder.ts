import type { JlptLevel } from "@/types/learning";

export const REMINDER_LAST_DAY_KEY = "kotonoha_reminded_day_v1";

export interface ParsedReminderTime {
  hour: number;
  minute: number;
  formatted: string;
}

/** Parses an `HH:MM` 24-hour string into validated hour/minute numbers (default 20:00). */
export function parseReminderHHMM(raw?: string): ParsedReminderTime {
  const match = raw?.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return { hour: 20, minute: 0, formatted: "20:00" };
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return { hour: 20, minute: 0, formatted: "20:00" };
  }
  return {
    hour,
    minute,
    formatted: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

/** Determines whether a local browser study reminder should fire now. */
export function shouldTriggerReminderToday(params: {
  enabled?: boolean;
  reminderTime?: string;
  dueCount: number;
  lastRemindedDayKey: string | null;
  todayKey: string;
  now?: Date;
}): boolean {
  if (!params.enabled || params.dueCount <= 0) return false;
  if (params.lastRemindedDayKey === params.todayKey) return false;

  const now = params.now ?? new Date();
  const parsed = parseReminderHHMM(params.reminderTime);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const targetMinutes = parsed.hour * 60 + parsed.minute;
  return nowMinutes >= targetMinutes;
}

function formatIcsLocalDateTime(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}${m}${day}T${hh}${mm}${ss}`;
}

function formatIcsUtcStamp(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${day}T${hh}${mm}${ss}Z`;
}

/** Generates a daily recurring RFC 5545 `.ics` calendar event for Kotonoha Studio. */
export function buildStudyReminderIcs(params: {
  timeHHMM?: string;
  dailyMinutes?: number;
  learnerLevel?: JlptLevel;
  appOrigin?: string;
  now?: Date;
}): string {
  const now = params.now ?? new Date();
  const { hour, minute } = parseReminderHHMM(params.timeHHMM);
  const dailyMinutes =
    params.dailyMinutes && params.dailyMinutes > 0 ? params.dailyMinutes : 20;
  const level = params.learnerLevel ?? "N5";
  const cleanOrigin = (params.appOrigin?.trim() || "https://kotonohajath.vercel.app").replace(
    /\/+$/,
    ""
  );

  const start = new Date(now);
  start.setHours(hour, minute, 0, 0);
  if (start.getTime() < now.getTime()) {
    start.setDate(start.getDate() + 1);
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kotonoha Studio//Daily Study Reminder//TH",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:kotonoha-daily-${level.toLowerCase()}@kotonohastudio`,
    `DTSTAMP:${formatIcsUtcStamp(now)}`,
    `DTSTART:${formatIcsLocalDateTime(start)}`,
    `DURATION:PT${dailyMinutes}M`,
    "RRULE:FREQ=DAILY",
    `SUMMARY:Kotonoha Studio — ฝึกภาษาญี่ปุ่น (${dailyMinutes} นาที • ${level})`,
    `DESCRIPTION:ทบทวนแฟลชการ์ด FSRS-7 และฝึกตามแผนรายวันของคุณที่ ${cleanOrigin}/srs`,
    `URL:${cleanOrigin}/srs`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:ได้เวลาฝึกภาษาญี่ปุ่นกับ Kotonoha Studio แล้ว!",
    "TRIGGER:-PT5M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `${lines.join("\r\n")}\r\n`;
}

export function readLastRemindedDayKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(REMINDER_LAST_DAY_KEY);
  } catch {
    return null;
  }
}

export function writeLastRemindedDayKey(dayKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REMINDER_LAST_DAY_KEY, dayKey);
  } catch {
    // ignore storage errors
  }
}

export function updatePwaAppBadge(dueCount: number): void {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (dueCount > 0 && typeof nav.setAppBadge === "function") {
    void nav.setAppBadge(dueCount).catch(() => undefined);
  } else if (dueCount <= 0 && typeof nav.clearAppBadge === "function") {
    void nav.clearAppBadge().catch(() => undefined);
  }
}

export function showBrowserStudyNotification(params: {
  dueCount: number;
  dailyMinutes?: number;
  learnerLevel?: JlptLevel;
  onClick?: () => void;
}): boolean {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return false;
  }

  const level = params.learnerLevel ?? "N5";
  const mins = params.dailyMinutes ?? 20;
  const body =
    params.dueCount > 0
      ? `มีการ์ด FSRS รอทบทวน ${params.dueCount} ใบวันนี้ (แผน ${mins} นาที • ระดับ ${level})`
      : `ได้เวลาฝึกภาษาญี่ปุ่น ${mins} นาทีวันนี้แล้ว (ระดับ ${level})`;

  const n = new Notification("Kotonoha Studio — ถึงเวลาฝึกภาษาญี่ปุ่น!", {
    body,
    icon: "/icon-192.png",
    tag: "kotonoha-daily-study",
  });

  n.onclick = () => {
    window.focus();
    params.onClick?.();
    n.close();
  };
  return true;
}
