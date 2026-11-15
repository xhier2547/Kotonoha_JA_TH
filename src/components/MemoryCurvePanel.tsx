"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Clock, ShieldCheck, TrendingUp } from "lucide-react";
import {
  MEMORY_CURVE_MILESTONES,
  buildSingleDecaySeries,
  buildSpacedSawtoothSeries,
  getCardRetrievability,
} from "@/lib/fsrs";
import type { SrsCardRecord } from "@/types/learning";
import { FlashcardDeckIcon, MemoryCurveIcon } from "@/components/LuxuryIcons";

interface MemoryCurvePanelProps {
  /** All user SRS cards to compute real memory health stats in overview mode */
  cards?: SrsCardRecord[];
  /** Pass a specific card to render its individual forgetting curve */
  focusedCard?: SrsCardRecord | null;
  /** Timestamp snapshot for deterministic React rendering */
  nowMs?: number;
  desiredRetention?: number;
  onStartFlashcard?: () => void;
  startLabel?: string;
  compact?: boolean;
}

const SVG_W = 640;
const SVG_H = 220;
const PAD_L = 42;
const PAD_R = 18;
const PAD_T = 18;
const PAD_B = 30;

function toSvgCoords(day: number, retention: number, maxDays: number) {
  const plotW = SVG_W - PAD_L - PAD_R;
  const plotH = SVG_H - PAD_T - PAD_B;
  const x = PAD_L + (Math.min(Math.max(day, 0), maxDays) / maxDays) * plotW;
  const y = PAD_T + ((100 - Math.min(Math.max(retention, 0), 100)) / 100) * plotH;
  return { x, y };
}

function pointsToPath(points: { day: number; retention: number }[], maxDays: number): string {
  if (points.length === 0) return "";
  return points
    .map((pt, idx) => {
      const { x, y } = toSvgCoords(pt.day, pt.retention, maxDays);
      return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function MemoryCurvePanel({
  cards,
  focusedCard,
  nowMs = 0,
  desiredRetention = 0.9,
  onStartFlashcard,
  startLabel = "ทบทวนแฟลชการ์ดตอนนี้",
  compact = false,
}: MemoryCurvePanelProps) {
  const [activeMilestoneIdx, setActiveMilestoneIdx] = useState(2); // Highlight "ทบทวน 2 วัน" by default

  const targetPct = Math.round(desiredRetention * 100);
  const maxDays = 32;

  const sawtooth = useMemo(() => buildSpacedSawtoothSeries(maxDays), []);

  // Focused card stability curve vs projected "after Good review" curve
  const focusedData = useMemo(() => {
    if (!focusedCard) return null;
    const stability = Math.max(focusedCard.fsrs.stability || 1, 0.9);
    const boostedStability = Math.max(stability * 2.35, stability + 2.5);
    const currentCurve = buildSingleDecaySeries(stability, maxDays, 48);
    const nextCurve = buildSingleDecaySeries(boostedStability, maxDays, 48);
    const currentRet =
      nowMs > 0 ? getCardRetrievability(focusedCard.fsrs, nowMs) : null;
    return {
      stability,
      boostedStability,
      currentPath: pointsToPath(currentCurve, maxDays),
      nextPath: pointsToPath(nextCurve, maxDays),
      currentPct: currentRet !== null ? Math.round(currentRet * 100) : 100,
    };
  }, [focusedCard, nowMs]);

  // Deck health breakdown
  const deckHealth = useMemo(() => {
    if (!cards || cards.length === 0) return null;
    let strong = 0;
    let dueSoon = 0;
    let fading = 0;
    let fresh = 0;
    let sumPct = 0;
    let learnedTotal = 0;

    for (const c of cards) {
      if (c.fsrs.reps === 0) {
        fresh += 1;
        continue;
      }
      learnedTotal += 1;
      const r = nowMs > 0 ? (getCardRetrievability(c.fsrs, nowMs) ?? 0.9) : 0.9;
      const pct = r * 100;
      sumPct += pct;
      if (pct >= targetPct) {
        strong += 1;
      } else if (pct >= 80) {
        dueSoon += 1;
      } else {
        fading += 1;
      }
    }

    return {
      strong,
      dueSoon,
      fading,
      fresh,
      avgPct: learnedTotal > 0 ? Math.round(sumPct / learnedTotal) : 100,
      learnedTotal,
    };
  }, [cards, nowMs, targetPct]);

  const targetLineY = toSvgCoords(0, targetPct, maxDays).y;
  const unreviewedPath = pointsToPath(sawtooth.unreviewed, maxDays);
  const spacedPath = pointsToPath(sawtooth.spaced, maxDays);
  const milestone = MEMORY_CURVE_MILESTONES[activeMilestoneIdx] ?? MEMORY_CURVE_MILESTONES[0];
  const milestoneCoord = toSvgCoords(milestone.day === 2 ? 3 : milestone.day === 5 ? 8 : milestone.day === 14 ? 22 : milestone.day, 100, maxDays);

  if (focusedCard && focusedData) {
    return (
      <div className="rounded-2xl border border-border bg-background/85 p-4 space-y-3 animate-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <MemoryCurveIcon className="w-4 h-4" />
            <span>Memory Curve ของคำนี้ (FSRS-7)</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
              ความจำตอนนี้ ~{focusedData.currentPct}%
            </span>
            <span className="px-2 py-0.5 rounded-md bg-surface-muted text-foreground/75">
              Stability: {focusedData.stability.toFixed(1)} วัน &rarr; รอบถัดไป ~
              {focusedData.boostedStability.toFixed(1)} วัน
            </span>
          </div>
        </div>

        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-36 sm:h-40 overflow-visible"
          role="img"
          aria-label="กราฟเส้นโค้งความจำของการ์ดนี้"
        >
          {/* Grid lines */}
          {[100, 90, 50, 20].map((pct) => {
            const { y } = toSvgCoords(0, pct, maxDays);
            return (
              <g key={pct}>
                <line
                  x1={PAD_L}
                  y1={y}
                  x2={SVG_W - PAD_R}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={pct === targetPct ? 0.35 : 0.08}
                  strokeDasharray={pct === targetPct ? "4 4" : undefined}
                />
                <text
                  x={PAD_L - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-foreground/45 text-[10px] font-mono"
                >
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* Baseline decay if unreviewed */}
          <path
            d={focusedData.currentPath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeDasharray="5 4"
            strokeOpacity="0.65"
          />

          {/* Predicted flatter curve after recall */}
          <path
            d={focusedData.nextPath}
            fill="none"
            stroke="var(--matcha)"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="animate-curve-draw"
          />

          {[0, 2, 5, 14, 30].map((d) => {
            const { x } = toSvgCoords(d, 0, maxDays);
            return (
              <text
                key={d}
                x={x}
                y={SVG_H - 8}
                textAnchor="middle"
                className="fill-foreground/50 text-[10px] font-mono"
              >
                {d === 0 ? "วันนี้" : `+${d}d`}
              </text>
            );
          })}
        </svg>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-foreground/65">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-accent inline-block border-t border-dashed border-accent" />
              <span>เส้นลืมปัจจุบัน</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-matcha inline-block rounded-full" />
              <span>หลังทบทวนสำเร็จ (กราฟแบนลง จำได้นานขึ้น)</span>
            </span>
          </div>
          <span>เกณฑ์ทบทวน FSRS: {targetPct}%</span>
        </div>
      </div>
    );
  }

  return (
    <section
      className={`rounded-2xl border border-border bg-surface/95 backdrop-blur-xs shadow-xs overflow-hidden ${
        compact ? "p-4 sm:p-5 space-y-4" : "p-5 sm:p-6 space-y-5"
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary tracking-wide uppercase">
            <MemoryCurveIcon className="w-4 h-4" />
            <span>Memory Curve & Spaced Repetition (Ebbinghaus + FSRS-7)</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight">
            จังหวะทบทวนตามเส้นโค้งความจำ: วันแรก &rarr; 1 วัน &rarr; 2 วัน &rarr; 5 วัน &rarr; 14 วัน &rarr; 30 วัน
          </h2>
          <p className="text-xs text-foreground/70 leading-relaxed max-w-2xl">
            ตามทฤษฎี Ebbinghaus Forgetting Curve ถ้าเรียนแล้วปล่อยไว้ ความจำจะลดฮวบภายใน 48 ชม.
            ระบบ FSRS-7 ของเราจึงคำนวณจุดที่ความจำลดลงแตะ <span className="font-semibold text-primary">{targetPct}%</span>{" "}
            แล้วเตือนให้ทบทวนด้วยแฟลชการ์ดพอดีจังหวะ เพื่อยืดเส้นกราฟให้จำได้ถาวร
          </p>
        </div>

        {onStartFlashcard && (
          <button
            type="button"
            onClick={onStartFlashcard}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-medium shadow-sm hover:opacity-95 transition-all hover:-translate-y-0.5 shrink-0 cursor-pointer"
          >
            <FlashcardDeckIcon className="w-4 h-4" />
            <span>{startLabel}</span>
            <ArrowUpRight className="w-3.5 h-3.5 opacity-80" />
          </button>
        )}
      </div>

      {/* Interactive SVG Curve */}
      <div className="rounded-xl border border-border/80 bg-background/70 p-3 sm:p-4 space-y-2.5">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-44 sm:h-52 overflow-visible"
          role="img"
          aria-label="กราฟ Memory Curve แสดงการทบทวนแบบเว้นระยะ 1, 2, 5, 14, 30 วัน"
        >
          <defs>
            <linearGradient id="spacedFillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Horizontal reference grid */}
          {[100, 90, 60, 30, 0].map((pct) => {
            const { y } = toSvgCoords(0, pct, maxDays);
            const isTarget = pct === targetPct;
            return (
              <g key={pct}>
                <line
                  x1={PAD_L}
                  y1={y}
                  x2={SVG_W - PAD_R}
                  y2={y}
                  stroke={isTarget ? "var(--matcha)" : "currentColor"}
                  strokeOpacity={isTarget ? 0.5 : 0.08}
                  strokeWidth={isTarget ? 1.4 : 1}
                  strokeDasharray={isTarget ? "5 4" : undefined}
                />
                <text
                  x={PAD_L - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className={`text-[10px] font-mono ${
                    isTarget ? "fill-matcha font-semibold" : "fill-foreground/45"
                  }`}
                >
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* Label for target retention line */}
          <text
            x={SVG_W - PAD_R}
            y={targetLineY - 5}
            textAnchor="end"
            className="fill-matcha text-[10px] font-medium"
          >
            จุดเตือนทบทวนก่อนลืม ({targetPct}%)
          </text>

          {/* Soft area under spaced curve */}
          <path
            d={`${spacedPath} L ${(SVG_W - PAD_R).toFixed(1)} ${(SVG_H - PAD_B).toFixed(1)} L ${PAD_L} ${(SVG_H - PAD_B).toFixed(1)} Z`}
            fill="url(#spacedFillGrad)"
          />

          {/* Unreviewed steep forgetting curve */}
          <path
            d={unreviewedPath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.8"
            strokeDasharray="5 4"
            strokeOpacity="0.7"
          />

          {/* Active spaced repetition curve (animated draw) */}
          <path
            d={spacedPath}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-curve-draw"
          />

          {/* Review milestone nodes */}
          {[
            { day: 0, label: "Day 0", idx: 0 },
            { day: 1, label: "1 วัน", idx: 1 },
            { day: 3, label: "+2 วัน", idx: 2 },
            { day: 8, label: "+5 วัน", idx: 3 },
            { day: 22, label: "+14 วัน", idx: 4 },
            { day: 30, label: "30 วัน+", idx: 5 },
          ].map((node) => {
            const pt = toSvgCoords(node.day, 99, maxDays);
            const axis = toSvgCoords(node.day, 0, maxDays);
            const selected = activeMilestoneIdx === node.idx;
            return (
              <g
                key={node.label}
                className="cursor-pointer"
                onClick={() => setActiveMilestoneIdx(node.idx)}
              >
                <line
                  x1={pt.x}
                  y1={pt.y}
                  x2={pt.x}
                  y2={SVG_H - PAD_B}
                  stroke="var(--primary)"
                  strokeOpacity={selected ? 0.25 : 0.08}
                  strokeDasharray="2 3"
                />
                {selected && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="8"
                    fill="var(--primary)"
                    fillOpacity="0.18"
                    className="animate-pulse-ring"
                  />
                )}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={selected ? 4.8 : 3.6}
                  fill={selected ? "var(--accent)" : "var(--surface)"}
                  stroke="var(--primary)"
                  strokeWidth="2"
                />
                <text
                  x={axis.x}
                  y={SVG_H - 8}
                  textAnchor="middle"
                  className={`text-[10px] font-mono ${
                    selected ? "fill-primary font-bold" : "fill-foreground/55"
                  }`}
                >
                  {node.label}
                </text>
              </g>
            );
          })}

          {/* Highlight focus vertical marker if active milestone selected */}
          <circle
            cx={milestoneCoord.x}
            cy={milestoneCoord.y}
            r="2"
            fill="var(--accent)"
          />
        </svg>

        {/* Legend + Interactive Stage Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/60 text-[11px] text-foreground/70">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 bg-primary inline-block rounded-full" />
              <span>ทบทวนตามรอบ FSRS (กราฟยกกลับ & แบนลง)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 border-t-2 border-dashed border-accent inline-block" />
              <span>เรียนครั้งเดียวไม่ทบทวน (ลืมเร็วใน 2–5 วัน)</span>
            </span>
          </div>
          <span className="font-mono text-[10px] text-foreground/55">
            R(t) = (1 + t / 9S)^(-1)
          </span>
        </div>
      </div>

      {/* Stage Selector + Explanation */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          {MEMORY_CURVE_MILESTONES.map((m, idx) => {
            const active = idx === activeMilestoneIdx;
            return (
              <button
                key={m.stageTh}
                type="button"
                onClick={() => setActiveMilestoneIdx(idx)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-background border-border text-foreground/75 hover:bg-surface-muted"
                }`}
              >
                {m.stageTh}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-border bg-surface-muted/50 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div>
            <span className="font-semibold text-primary">{milestone.labelTh}: </span>
            <span className="text-foreground/80">{milestone.descTh}</span>
          </div>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-surface border border-border text-foreground/70 shrink-0 self-start sm:self-center">
            Stability ~{milestone.expectedStabilityDays}d
          </span>
        </div>
      </div>

      {/* Live Deck Memory Health Stats (when cards provided) */}
      {deckHealth && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="rounded-xl border border-border bg-background/80 p-3">
            <div className="flex items-center justify-between text-[11px] text-foreground/60">
              <span>ความจำเฉลี่ยคลัง</span>
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="text-lg font-bold mt-0.5">{deckHealth.avgPct}%</div>
          </div>

          <div className="rounded-xl border border-matcha/30 bg-matcha/5 p-3">
            <div className="flex items-center justify-between text-[11px] text-matcha">
              <span>จำแม่น (&ge;{targetPct}%)</span>
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div className="text-lg font-bold text-matcha mt-0.5">{deckHealth.strong} ใบ</div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-center justify-between text-[11px] text-amber-700 dark:text-amber-300">
              <span>ควรทบทวนเร็ว ๆ นี้</span>
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div className="text-lg font-bold text-amber-700 dark:text-amber-300 mt-0.5">
              {deckHealth.dueSoon + deckHealth.fading} ใบ
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background/80 p-3">
            <div className="flex items-center justify-between text-[11px] text-foreground/60">
              <span>การ์ดใหม่รอเริ่ม</span>
              <FlashcardDeckIcon className="w-3.5 h-3.5 text-foreground/60" />
            </div>
            <div className="text-lg font-bold mt-0.5">{deckHealth.fresh} ใบ</div>
          </div>
        </div>
      )}
    </section>
  );
}
