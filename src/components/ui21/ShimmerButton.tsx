"use client";

import React, { CSSProperties } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Adapted from 21st.dev/@dillionverma/shimmer-button (component id 833)
 * with polymorphic `href` support for Next.js App Router links and
 * theme-safe foreground contrast across Light & Dark modes.
 */
export interface ShimmerButtonProps {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  className?: string;
  children?: React.ReactNode;
  href?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  title?: string;
  "aria-label"?: string;
}

export function ShimmerButton({
  shimmerColor = "rgba(255, 255, 255, 0.85)",
  shimmerSize = "0.08em",
  shimmerDuration = "3.2s",
  borderRadius = "0.75rem",
  background = "linear-gradient(135deg, #f59e0b 0%, #f43f5e 100%)",
  className,
  children,
  href,
  disabled,
  type = "button",
  onClick,
  title,
  "aria-label": ariaLabel,
}: ShimmerButtonProps) {
  const styleVars = {
    "--spread": "90deg",
    "--shimmer-color": shimmerColor,
    "--radius": borderRadius,
    "--speed": shimmerDuration,
    "--cut": shimmerSize,
    "--bg": background,
  } as CSSProperties;

  const sharedClass = cn(
    "group relative z-0 inline-flex cursor-pointer items-center justify-center gap-2 overflow-hidden whitespace-nowrap border border-white/20 px-4 py-2.5 text-white shadow-md [background:var(--bg)] [border-radius:var(--radius)]",
    "transform-gpu transition-all duration-300 ease-out hover:-translate-y-0.5 hover:brightness-105 active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-50",
    className
  );

  const innerContent = (
    <>
      {/* Spark container */}
      <div
        aria-hidden="true"
        className="-z-30 blur-[2px] absolute inset-0 overflow-visible [container-type:size]"
      >
        <div className="absolute inset-0 h-[100cqh] animate-shimmer-slide [aspect-ratio:1] [border-radius:0] [mask:none]">
          <div className="animate-spin-around absolute -inset-full w-auto rotate-0 [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))] [translate:0_0]" />
        </div>
      </div>

      <span className="relative z-10 inline-flex items-center justify-center gap-2">
        {children}
      </span>

      {/* Gloss highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none inset-0 absolute size-full [border-radius:var(--radius)] shadow-[inset_0_-6px_12px_rgba(255,255,255,0.22)] transform-gpu transition-all duration-300 ease-in-out group-hover:shadow-[inset_0_-4px_14px_rgba(255,255,255,0.34)]"
      />

      {/* Backdrop fill inside shimmer border */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -z-20 [background:var(--bg)] [border-radius:var(--radius)] [inset:var(--cut)]"
      />
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        style={styleVars}
        className={sharedClass}
        onClick={onClick}
        title={title}
        aria-label={ariaLabel}
      >
        {innerContent}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      style={styleVars}
      className={sharedClass}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
    >
      {innerContent}
    </button>
  );
}
