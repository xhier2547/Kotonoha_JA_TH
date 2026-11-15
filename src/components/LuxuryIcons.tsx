"use client";

interface IconProps {
  className?: string;
}

/**
 * Refined Hanko (印鑑) seal emblem for Kotonoha Studio.
 * Monochrome ink frame with subtle vermilion seal dot.
 */
export function HankoSealEmblem({ className = "w-10 h-10" }: IconProps) {
  return (
    <div
      className={`relative rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm ring-1 ring-white/15 overflow-hidden ${className}`}
    >
      <svg
        viewBox="0 0 40 40"
        className="w-full h-full"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="3.5"
          y="3.5"
          width="33"
          height="33"
          rx="8"
          stroke="currentColor"
          strokeOpacity="0.24"
          strokeWidth="1"
        />
        <circle cx="31" cy="9" r="2.3" fill="#c84b31" />
      </svg>
      <span className="absolute font-jp-serif font-bold text-[17px] tracking-tight select-none">
        言
      </span>
    </div>
  );
}

/**
 * Minimalist geometric stacked flashcard icon (1.5px fine stroke).
 */
export function FlashcardDeckIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="6" y="4" width="14" height="11" rx="2.5" strokeOpacity="0.45" />
      <rect x="3.5" y="7.5" width="14.5" height="12" rx="2.5" fill="none" />
      <path d="M7.5 12h6.5" />
      <path d="M7.5 15.2h4" strokeOpacity="0.7" />
    </svg>
  );
}

/**
 * Minimalist Ebbinghaus / FSRS Memory Retention Curve icon.
 */
export function MemoryCurveIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3.5 19.5h17" strokeOpacity="0.35" />
      <path d="M4.5 6.5c2.2 4.5 3.6 7.5 6.5 9.5" strokeDasharray="2 2.5" strokeOpacity="0.45" />
      <path d="M4.5 6.5c1.5 3.5 3 5.2 4.5 5.8V6.8c2 3.2 4 4.2 6.5 4.4V6.8c2.2 2 3.6 2.5 5 2.7" />
      <circle cx="9" cy="6.8" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="6.8" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Refined geometric Japanese crest / seal line icon for mastery badges.
 */
export function CrestSealIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" strokeOpacity="0.45" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2" />
    </svg>
  );
}
