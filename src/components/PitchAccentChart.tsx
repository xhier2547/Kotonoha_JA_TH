"use client";

import { computePitchContour, getPitchLabelTh, splitMorae } from "@/lib/pitch";

interface PitchAccentChartProps {
  reading: string;
  pitch: number;
  compact?: boolean;
  showDescription?: boolean;
}

export function PitchAccentChart({
  reading,
  pitch,
  compact = false,
  showDescription = false,
}: PitchAccentChartProps) {
  const morae = splitMorae(reading);
  if (morae.length === 0) return null;

  const contour = computePitchContour(morae.length, pitch);
  const info = getPitchLabelTh(pitch, morae.length);

  const stepX = compact ? 26 : 36;
  const padX = compact ? 14 : 20;
  const highY = compact ? 10 : 14;
  const lowY = compact ? 30 : 40;
  const width = padX * 2 + (morae.length) * stepX;
  const height = compact ? 58 : 74;

  const points = contour.map((isHigh, idx) => ({
    x: padX + idx * stepX,
    y: isHigh ? highY : lowY,
    isHigh,
    isParticle: idx === morae.length,
    mora: idx < morae.length ? morae[idx] : "が",
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  return (
    <div className="inline-flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${info.badgeColor}`}
        >
          {info.label}
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="overflow-visible select-none"
          aria-label={`Pitch accent contour for ${reading}`}
        >
          <path
            d={pathD}
            fill="none"
            stroke="currentColor"
            strokeWidth={compact ? 2 : 2.5}
            className="text-primary"
          />
          {points.map((pt, i) => {
            const prev = points[i - 1];
            const isDropPoint = prev && prev.isHigh && !pt.isHigh;
            return (
              <g key={`${pt.mora}-${i}`}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={compact ? 4 : 5}
                  className={
                    pt.isParticle
                      ? "fill-background stroke-primary/60"
                      : isDropPoint
                        ? "fill-accent stroke-accent"
                        : "fill-primary stroke-primary"
                  }
                  strokeWidth={2}
                />
                <text
                  x={pt.x}
                  y={height - (compact ? 4 : 6)}
                  textAnchor="middle"
                  className={`font-jp ${
                    compact ? "text-[12px]" : "text-[14px]"
                  } ${
                    pt.isParticle
                      ? "fill-foreground/45"
                      : "fill-foreground font-medium"
                  }`}
                >
                  {pt.isParticle ? `(${pt.mora})` : pt.mora}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {showDescription && (
        <p className="text-xs text-foreground/70">{info.description}</p>
      )}
    </div>
  );
}
