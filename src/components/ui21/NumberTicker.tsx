"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Animated number counter inspired by 21st.dev Number Ticker / Count Up Animation.
 * Uses rAF easing (zero external motion deps) and respects prefers-reduced-motion.
 */
interface NumberTickerProps {
  value: number;
  durationMs?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}

export function NumberTicker({
  value,
  durationMs = 700,
  suffix = "",
  prefix = "",
  className,
}: NumberTickerProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousRef = useRef(0);

  useEffect(() => {
    const startVal = previousRef.current;
    previousRef.current = value;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let rafId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      if (prefersReduced || startVal === value) {
        setDisplayValue(value);
        return;
      }
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(startVal + (value - startVal) * eased);
      setDisplayValue(next);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setDisplayValue(value);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [value, durationMs]);

  return (
    <span className={cn("tabular-nums", className)}>
      {prefix}
      {displayValue.toLocaleString()}
      {suffix}
    </span>
  );
}
