"use client";

import { cn } from "@/lib/utils";

interface VoiceWaveOrbProps {
  active?: boolean;
  tone?: "rose" | "indigo" | "emerald";
  label?: string;
  className?: string;
}

/**
 * Animated voice / AI-thinking orb and equalizer bars inspired by
 * 21st.dev/@anark17r/ai-thiking-orb-and-input & @molecule-lab-rushil/voice-input.
 */
export function VoiceWaveOrb({
  active = true,
  tone = "rose",
  label,
  className,
}: VoiceWaveOrbProps) {
  const toneStyles = {
    rose: {
      ring: "border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300",
      orb: "from-rose-500 to-amber-400",
      bar: "bg-rose-500 dark:bg-rose-400",
    },
    indigo: {
      ring: "border-indigo-500/35 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
      orb: "from-indigo-500 to-violet-500",
      bar: "bg-indigo-500 dark:bg-indigo-400",
    },
    emerald: {
      ring: "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      orb: "from-emerald-500 to-teal-400",
      bar: "bg-emerald-500 dark:bg-emerald-400",
    },
  }[tone];

  const heights = [38, 82, 58, 96, 46];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full border px-3 py-1.5 text-xs font-medium",
        toneStyles.ring,
        className
      )}
    >
      <span className="relative flex h-3.5 w-3.5 items-center justify-center shrink-0">
        {active && (
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-0 rounded-full bg-gradient-to-tr opacity-50 animate-ping",
              toneStyles.orb
            )}
          />
        )}
        <span
          aria-hidden="true"
          className={cn("relative h-2.5 w-2.5 rounded-full bg-gradient-to-tr", toneStyles.orb)}
        />
      </span>

      <span className="flex h-3.5 items-end gap-[2.5px]" aria-hidden="true">
        {heights.map((h, i) => (
          <span
            key={i}
            className={cn(
              "w-[2.5px] rounded-full origin-bottom transition-all",
              toneStyles.bar,
              active ? "animate-voice-bar" : "opacity-45"
            )}
            style={{
              height: `${active ? h : 35}%`,
              animationDelay: `${i * 110}ms`,
            }}
          />
        ))}
      </span>

      {label && <span>{label}</span>}
    </div>
  );
}
