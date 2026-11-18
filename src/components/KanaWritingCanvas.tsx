"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, Eye, EyeOff, PenTool, Play, Square } from "lucide-react";
import {
  STROKE_ORDER_MAP,
  type CharacterStrokeOrder,
} from "@/data/strokeOrders";

type StrokeOrderWithViewBox = CharacterStrokeOrder & { viewBox?: number };
const remoteStrokeCache = new Map<string, StrokeOrderWithViewBox | null>();

/** Interactive stroke practice pad with animated stroke-order guide (built-in + 2,850+ KanjiVG). */
export function KanaWritingCanvas({
  char,
  strokesCount,
  label,
}: {
  char: string;
  strokesCount?: number;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [showGhost, setShowGhost] = useState(true);
  const [animStep, setAnimStep] = useState<number | null>(null);
  const [remoteStroke, setRemoteStroke] = useState<StrokeOrderWithViewBox | null>(
    () => remoteStrokeCache.get(char) ?? null
  );

  const builtInStroke = STROKE_ORDER_MAP[char];
  const strokeOrder: StrokeOrderWithViewBox | undefined =
    builtInStroke ?? (remoteStroke?.char === char ? remoteStroke : undefined);
  const viewBoxSize = strokeOrder?.viewBox ?? 100;

  useEffect(() => {
    if (builtInStroke || !char) return;
    if (remoteStrokeCache.has(char)) return;

    let active = true;
    void fetch(`/api/kanji-stroke?char=${encodeURIComponent(char)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: StrokeOrderWithViewBox | null) => {
        remoteStrokeCache.set(char, data);
        if (active && data) {
          setRemoteStroke(data);
        }
      })
      .catch(() => {
        remoteStrokeCache.set(char, null);
      });

    return () => {
      active = false;
    };
  }, [char, builtInStroke]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [char]);

  useEffect(() => {
    if (animStep === null || !strokeOrder) return;
    const timer = window.setTimeout(() => {
      if (animStep + 1 < strokeOrder.strokes.length) {
        setAnimStep(animStep + 1);
      } else {
        setAnimStep(null);
      }
    }, 950);
    return () => window.clearTimeout(timer);
  }, [animStep, strokeOrder]);

  const handleTogglePlay = () => {
    if (!strokeOrder) return;
    if (animStep !== null) {
      setAnimStep(null);
    } else {
      setAnimStep(0);
    }
  };

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    setHasStrokes(true);

    const { x, y } = getPoint(e);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#1d4ed8";
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    drawingRef.current = false;
  };

  const effectiveTotalStrokes = strokesCount ?? strokeOrder?.strokes.length;

  return (
    <div className="rounded-xl border border-border bg-background p-3 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-foreground/75 inline-flex items-center gap-1.5">
          <PenTool className="w-3.5 h-3.5 text-primary" />
          <span>
            {label ?? "ฝึกคัดลายมือ"} ({char})
            {typeof effectiveTotalStrokes === "number"
              ? ` • ${effectiveTotalStrokes} ขีด`
              : ""}
          </span>
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {strokeOrder && (
            <button
              type="button"
              onClick={handleTogglePlay}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium cursor-pointer transition-colors ${
                animStep !== null
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                  : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
              }`}
            >
              {animStep !== null ? (
                <>
                  <Square className="w-3 h-3" />
                  <span>หยุดลำดับขีด</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  <span>ลำดับขีด 1→{strokeOrder.strokes.length}</span>
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowGhost((v) => !v)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border hover:bg-surface-muted text-[11px] cursor-pointer"
            title="สลับแสดง/ซ่อนตัวช่วยจางๆ"
          >
            {showGhost ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>{showGhost ? "ซ่อนเงา" : "แสดงเงา"}</span>
          </button>
          <button
            type="button"
            onClick={clearCanvas}
            disabled={!hasStrokes}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border hover:bg-surface-muted disabled:opacity-40 text-[11px] cursor-pointer"
          >
            <Eraser className="w-3 h-3" />
            <span>ล้างกระดาน</span>
          </button>
        </div>
      </div>

      <div className="relative w-44 h-44 mx-auto rounded-xl border-2 border-dashed border-border bg-surface overflow-hidden touch-none select-none">
        {/* Quadrant guide crosshair */}
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border/70 pointer-events-none" />
        <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-border/70 pointer-events-none" />
        {/* Ghost glyph */}
        {showGhost && (
          <div
            aria-hidden
            className="absolute inset-0 flex items-center justify-center font-jp text-[116px] leading-none text-foreground/10 pointer-events-none"
          >
            {char}
          </div>
        )}

        {/* Animated Stroke-Order SVG Overlay */}
        {strokeOrder && (
          <svg
            viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
            className="absolute inset-0 w-full h-full pointer-events-none z-0"
            aria-hidden
          >
            {strokeOrder.strokes.map((st, idx) => {
              const isPlaying = animStep !== null;
              const isActive = animStep === idx;
              const isDone = animStep !== null && idx < animStep;
              const showStartBadge = !isPlaying || isActive;

              return (
                <g key={idx}>
                  <path
                    d={st.d}
                    fill="none"
                    stroke={
                      isActive
                        ? "#dc2626"
                        : isDone
                          ? "#4338ca"
                          : "rgba(99, 102, 241, 0.25)"
                    }
                    strokeWidth={isActive ? 5.5 : 3.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pathLength={100}
                    strokeDasharray={isActive ? "100" : undefined}
                    strokeDashoffset={isActive ? "0" : undefined}
                    style={
                      isActive
                        ? { transition: "stroke-dashoffset 0.7s ease-out" }
                        : undefined
                    }
                  />
                  {showStartBadge && (
                    <g>
                      <circle
                        cx={st.start[0]}
                        cy={st.start[1]}
                        r={isActive ? 6.2 : 4.8}
                        fill={isActive ? "#dc2626" : "#4338ca"}
                        opacity={isActive ? 0.95 : 0.75}
                      />
                      <text
                        x={st.start[0]}
                        y={st.start[1] + 2.2}
                        textAnchor="middle"
                        fontSize="6.2"
                        fontWeight="700"
                        fill="#ffffff"
                      >
                        {idx + 1}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        <canvas
          ref={canvasRef}
          width={220}
          height={220}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative z-10 w-full h-full cursor-crosshair"
        />
      </div>

      {/* Stroke Order Step Selector & Rule Hint */}
      {strokeOrder ? (
        <div className="space-y-1.5 text-[11px] text-foreground/75">
          <div className="flex flex-wrap items-center justify-center gap-1">
            {strokeOrder.strokes.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setAnimStep(idx)}
                className={`w-5 h-5 rounded-full font-mono text-[10px] font-bold transition-colors cursor-pointer ${
                  animStep === idx
                    ? "bg-rose-600 text-white"
                    : "bg-surface-muted text-foreground/70 hover:bg-primary/15 hover:text-primary"
                }`}
                title={`ดูขีดที่ ${idx + 1}`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          <div className="text-center text-foreground/65">
            {animStep !== null
              ? `กำลังแสดงขีดที่ ${animStep + 1} จาก ${strokeOrder.strokes.length}`
              : strokeOrder.ruleTipTh}
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-center text-foreground/55">
          หลักการเขียน: บนลงล่าง • ซ้ายไปขวา • ขวางก่อนตั้ง • ปิดกรอบล่างท้ายสุด
        </div>
      )}
    </div>
  );
}
