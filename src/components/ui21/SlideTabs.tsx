"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface SlideTabItem<T extends string = string> {
  id: T;
  label: string;
  badge?: string | number;
  icon?: React.ComponentType<{ className?: string }>;
}

interface SlideTabsProps<T extends string = string> {
  items: SlideTabItem<T>[];
  value: T;
  onChange: (next: T) => void;
  variant?: "surface" | "hero";
  size?: "sm" | "md";
  className?: string;
}

/**
 * Animated sliding-pill tabs inspired by 21st.dev/@minhxthanh/slide-tabs and
 * @shadcnstore/motion-sliding-tabs, built without extra runtime motion dependencies.
 */
export function SlideTabs<T extends string = string>({
  items,
  value,
  onChange,
  variant = "surface",
  size = "md",
  className,
}: SlideTabsProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [pill, setPill] = useState<{ left: number; width: number; top: number; height: number } | null>(
    null
  );

  const measurePill = React.useCallback(() => {
    const activeBtn = buttonRefs.current.get(value);
    const container = containerRef.current;
    if (!activeBtn || !container) return;
    setPill({
      left: activeBtn.offsetLeft,
      top: activeBtn.offsetTop,
      width: activeBtn.offsetWidth,
      height: activeBtn.offsetHeight,
    });
  }, [value]);

  useLayoutEffect(() => {
    const raf = requestAnimationFrame(measurePill);
    return () => cancelAnimationFrame(raf);
  }, [measurePill, items]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measurePill());
    ro.observe(container);
    return () => ro.disconnect();
  }, [measurePill]);

  const isHero = variant === "hero";

  return (
    <div
      ref={containerRef}
      role="tablist"
      className={cn(
        "relative inline-flex flex-wrap items-center gap-0.5 rounded-2xl p-1",
        isHero
          ? "border border-white/20 bg-white/10 backdrop-blur-xs"
          : "border border-border bg-surface shadow-xs",
        className
      )}
    >
      {pill && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-0 left-0 rounded-xl transition-all duration-300 ease-out",
            isHero
              ? "bg-white shadow-xs"
              : "bg-primary shadow-xs"
          )}
          style={{
            transform: `translate3d(${pill.left}px, ${pill.top}px, 0)`,
            width: `${pill.width}px`,
            height: `${pill.height}px`,
          }}
        />
      )}

      {items.map((item) => {
        const active = item.id === value;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            ref={(el) => {
              if (el) buttonRefs.current.set(item.id, el);
              else buttonRefs.current.delete(item.id);
            }}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "relative z-10 inline-flex items-center gap-1.5 rounded-xl font-semibold transition-colors duration-200 cursor-pointer",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-xs sm:text-sm",
              active
                ? isHero
                  ? "text-slate-900"
                  : "text-primary-foreground"
                : isHero
                  ? "text-white/85 hover:text-white"
                  : "text-foreground/70 hover:text-foreground"
            )}
          >
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
            <span>{item.label}</span>
            {item.badge !== undefined && (
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-md text-[10px] font-mono leading-none",
                  active
                    ? isHero
                      ? "bg-slate-900/10 text-slate-900"
                      : "bg-white/20 text-primary-foreground"
                    : "bg-surface-muted text-foreground/65"
                )}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
