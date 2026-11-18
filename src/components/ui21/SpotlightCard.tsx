"use client";

import React, { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type SpotlightTone = "rose" | "emerald" | "indigo" | "amber" | "primary";

const SPOTLIGHT_RGBA: Record<SpotlightTone, string> = {
  rose: "rgba(244, 63, 94, 0.14)",
  emerald: "rgba(16, 185, 129, 0.14)",
  indigo: "rgba(99, 102, 241, 0.15)",
  amber: "rgba(245, 158, 11, 0.15)",
  primary: "rgba(37, 99, 235, 0.14)",
};

/**
 * Pointer-tracking spotlight bento card inspired by 21st.dev/@preetsuthar17/spotlight-card
 * and @kevingirelli/spotlight, tuned for crisp contrast in both Washi Light & Sumi Dark.
 */
interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: SpotlightTone;
  children: React.ReactNode;
}

export function SpotlightCard({
  tone = "primary",
  className,
  children,
  onMouseMove,
  onMouseLeave,
  ...props
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      setPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        visible: true,
      });
    }
    onMouseMove?.(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    setPos((prev) => ({ ...prev, visible: false }));
    onMouseLeave?.(e);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "studio-card relative overflow-hidden rounded-2xl border border-border bg-surface/95 backdrop-blur-xs shadow-xs",
        className
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: pos.visible ? 1 : 0,
          background: `radial-gradient(260px circle at ${pos.x}px ${pos.y}px, ${SPOTLIGHT_RGBA[tone]}, transparent 72%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
