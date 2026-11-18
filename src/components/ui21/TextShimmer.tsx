"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Adapted from 21st.dev/@wensity/text-shimmer (component id 27522)
 * with CSS animations in globals.css and React 19 clean ref handling.
 */
export interface TextShimmerProps {
  text: string;
  as?: "span" | "h2" | "h3" | "p" | "div";
  duration?: number;
  baseColor?: string;
  shimmerColor?: string;
  spread?: number;
  angle?: number;
  direction?: "left" | "right";
  yoyo?: boolean;
  pauseOnHover?: boolean;
  paused?: boolean;
  className?: string;
}

export function TextShimmer({
  text,
  as = "span",
  duration = 2.2,
  baseColor,
  shimmerColor,
  spread = 24,
  angle = 90,
  direction = "left",
  yoyo = false,
  pauseOnHover = false,
  paused,
  className,
}: TextShimmerProps) {
  const nodeRef = React.useRef<HTMLElement | null>(null);
  const pausedPropRef = React.useRef(paused);
  const hoverPausedRef = React.useRef(false);
  const inViewRef = React.useRef(true);

  React.useEffect(() => {
    pausedPropRef.current = paused;
  }, [paused]);

  const safeDuration = Math.max(2, duration);
  const clampedSpread = Math.min(60, Math.max(8, spread));
  const bandPx = Math.max(10, Math.round((text.length || 1) * (clampedSpread / 11)));

  React.useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    let pageVisible = document.visibilityState !== "hidden";

    const syncPlayState = () => {
      const forced = pausedPropRef.current;
      const autoPause = !(inViewRef.current && pageVisible);
      const shouldPause =
        forced === true ||
        hoverPausedRef.current ||
        (forced !== false && autoPause);
      node.dataset.shimmerPaused = shouldPause ? "true" : "false";
    };

    if (paused === true) {
      syncPlayState();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        inViewRef.current = entries.some((entry) => entry.isIntersecting);
        syncPlayState();
      },
      { threshold: 0.01 }
    );

    const onVisibility = () => {
      pageVisible = document.visibilityState !== "hidden";
      syncPlayState();
    };

    if (paused !== false) {
      io.observe(node);
      document.addEventListener("visibilitychange", onVisibility);
    }

    syncPlayState();

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [paused]);

  const syncHoverPause = (next: boolean) => {
    hoverPausedRef.current = next;
    const node = nodeRef.current;
    if (!node) return;
    if (pausedPropRef.current === true) {
      node.dataset.shimmerPaused = "true";
      return;
    }
    if (pausedPropRef.current === false) {
      node.dataset.shimmerPaused = next ? "true" : "false";
      return;
    }
    if (next) {
      node.dataset.shimmerPaused = "true";
      return;
    }
    const pageVisible = document.visibilityState !== "hidden";
    node.dataset.shimmerPaused = inViewRef.current && pageVisible ? "false" : "true";
  };

  const Tag = as;

  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        nodeRef.current = node;
      }}
      data-shimmer-paused={paused === true ? "true" : "false"}
      data-shimmer-yoyo={yoyo ? "true" : "false"}
      data-shimmer-direction={direction}
      onMouseEnter={pauseOnHover ? () => syncHoverPause(true) : undefined}
      onMouseLeave={pauseOnHover ? () => syncHoverPause(false) : undefined}
      className={cn(
        "wensity-text-shimmer relative inline-block overflow-visible",
        "py-[0.06em] leading-[1.3]",
        "[background-size:250%_100%,auto] [background-clip:text]",
        "[background-repeat:no-repeat,padding-box]",
        "[-webkit-background-clip:text] [-webkit-text-fill-color:transparent]",
        "[box-decoration-break:clone] [-webkit-box-decoration-break:clone]",
        "[transform:translateZ(0)]",
        "[--wensity-shimmer-base:#64748b] [--wensity-shimmer-hi:#0f172a]",
        "dark:[--wensity-shimmer-base:#94a3b8] dark:[--wensity-shimmer-hi:#ffffff]",
        className
      )}
      style={
        {
          ...(baseColor ? { "--wensity-shimmer-base": baseColor } : null),
          ...(shimmerColor ? { "--wensity-shimmer-hi": shimmerColor } : null),
          "--wensity-shimmer-duration": `${safeDuration}s`,
          "--wensity-shimmer-spread": `${bandPx}px`,
          backgroundImage: [
            `linear-gradient(${angle}deg, transparent calc(50% - var(--wensity-shimmer-spread)), var(--wensity-shimmer-hi), transparent calc(50% + var(--wensity-shimmer-spread)))`,
            "linear-gradient(var(--wensity-shimmer-base), var(--wensity-shimmer-base))",
          ].join(", "),
        } as React.CSSProperties
      }
    >
      {text}
    </Tag>
  );
}
