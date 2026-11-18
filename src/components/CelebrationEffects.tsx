"use client";

import { Sparkles } from "lucide-react";

const PETAL_CONFIG = [
  { left: "6%", delay: "0ms", color: "bg-rose-400" },
  { left: "14%", delay: "120ms", color: "bg-amber-400" },
  { left: "22%", delay: "60ms", color: "bg-pink-300" },
  { left: "30%", delay: "180ms", color: "bg-indigo-400" },
  { left: "39%", delay: "40ms", color: "bg-rose-300" },
  { left: "48%", delay: "150ms", color: "bg-emerald-400" },
  { left: "57%", delay: "90ms", color: "bg-amber-300" },
  { left: "66%", delay: "210ms", color: "bg-rose-400" },
  { left: "75%", delay: "30ms", color: "bg-sky-400" },
  { left: "84%", delay: "140ms", color: "bg-pink-400" },
  { left: "92%", delay: "80ms", color: "bg-amber-400" },
];

/** Lightweight CSS sakura/gold confetti burst for completed reviews & passed exams. */
export function SakuraConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-44 overflow-hidden z-10"
    >
      {PETAL_CONFIG.map((p, idx) => (
        <span
          key={idx}
          style={{ left: p.left, animationDelay: p.delay }}
          className={`animate-petal absolute top-1 w-2.5 h-3.5 rounded-tl-full rounded-br-full ${p.color} opacity-90 shadow-xs`}
        />
      ))}
    </div>
  );
}

/** Traditional Japanese red Hanko stamp seal (`合格`, `完了`, `達成`) with slam animation. */
export function HankoStampBadge({
  kanji,
  subtitle,
}: {
  kanji: string;
  subtitle?: string;
}) {
  return (
    <div
      className="animate-stamp-slam inline-flex flex-col items-center justify-center rounded-2xl border-2 border-rose-600/85 dark:border-rose-400/90 bg-rose-600/8 px-3.5 py-2 text-rose-700 dark:text-rose-300 shadow-xs select-none"
      aria-label={kanji}
    >
      <span className="font-jp-serif text-lg sm:text-xl font-bold tracking-widest leading-none">
        {kanji}
      </span>
      {subtitle && (
        <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5 opacity-90">
          {subtitle}
        </span>
      )}
    </div>
  );
}

/** Floating +XP indicator shown right after grading flashcards. */
export function FloatingXpToast({
  xp,
  eventKey,
}: {
  xp: number;
  eventKey: number;
}) {
  if (eventKey <= 0 || xp <= 0) return null;

  return (
    <div
      key={eventKey}
      className="animate-xp-pop pointer-events-none inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-white text-xs font-bold shadow-md"
    >
      <Sparkles className="w-3 h-3" />
      <span>+{xp} XP</span>
    </div>
  );
}

/** Crisp animated circular progress ring for Daily Goal tracking. */
export function DailyGoalRing({
  current,
  target,
  size = 104,
}: {
  current: number;
  target: number;
  size?: number;
}) {
  const safeTarget = Math.max(1, target);
  const pct = Math.min(100, Math.round((current / safeTarget) * 100));
  const strokeWidth = 9;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="dailyGoalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="55%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#dailyGoalGrad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className="text-lg font-bold font-mono leading-none">{pct}%</span>
        <span className="text-[10px] text-white/75 mt-1 font-mono">
          {current}/{safeTarget}
        </span>
      </div>
    </div>
  );
}
