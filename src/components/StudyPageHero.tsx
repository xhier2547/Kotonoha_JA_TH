"use client";

import type { ReactNode } from "react";

export type StudyHeroTone = "indigo" | "sakura" | "matcha" | "amber" | "violet";

const TONE_CLASSES: Record<StudyHeroTone, string> = {
  indigo:
    "bg-[#162947] bg-gradient-to-br from-[#162947] via-[#224173] to-[#39306b]",
  sakura:
    "bg-[#5b1d2e] bg-gradient-to-br from-[#232b54] via-[#5d2642] to-[#9b2c3b]",
  matcha:
    "bg-[#16382b] bg-gradient-to-br from-[#153629] via-[#1c5243] to-[#244468]",
  amber:
    "bg-[#4a2b14] bg-gradient-to-br from-[#1e3252] via-[#5a3518] to-[#87431f]",
  violet:
    "bg-[#2d1e57] bg-gradient-to-br from-[#1d2854] via-[#3d256b] to-[#69295e]",
};

/**
 * Shared high-contrast Japanese hero banner with a dedicated Seigaiha overlay layer
 * (kept separate from the gradient background so Light Mode never loses backdrop contrast).
 */
export function StudyPageHero({
  eyebrow,
  title,
  subtitle,
  kanjiWatermark,
  tone = "indigo",
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  kanjiWatermark?: string;
  tone?: StudyHeroTone;
  actions?: ReactNode;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-3xl ${TONE_CLASSES[tone]} text-white p-5 sm:p-6 shadow-md animate-fade-up`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-seigaiha opacity-85"
      />
      {kanjiWatermark && (
        <div
          aria-hidden="true"
          className="pointer-events-none select-none font-jp-serif text-7xl sm:text-8xl font-bold text-white/10 absolute right-4 -bottom-3 leading-none"
        >
          {kanjiWatermark}
        </div>
      )}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/15 border border-white/20 text-amber-200">
            {eyebrow}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
            {subtitle}
          </p>
        </div>

        {actions && <div className="relative z-10 shrink-0">{actions}</div>}
      </div>
    </section>
  );
}
