"use client";

import { BarChart3, CalendarDays } from "lucide-react";
import type { StudyAnalyticsData } from "@/lib/db";

function heatCellClass(total: number): string {
  if (total === 0) return "bg-surface-muted border-border/60";
  if (total <= 5) return "bg-matcha/25 border-matcha/35";
  if (total <= 15) return "bg-matcha/50 border-matcha/60";
  if (total <= 30) return "bg-matcha/75 border-matcha/85";
  return "bg-matcha border-matcha";
}

export function StudyAnalyticsPanel({
  analytics,
}: {
  analytics: StudyAnalyticsData | null;
}) {
  if (!analytics) return null;

  // Group 84 days into 12 weekly columns of 7 rows for the calendar matrix
  const weeks: StudyAnalyticsData["heatmapDays"][] = [];
  for (let i = 0; i < analytics.heatmapDays.length; i += 7) {
    weeks.push(analytics.heatmapDays.slice(i, i + 7));
  }

  const maxForecast = Math.max(
    1,
    ...analytics.forecast7Days.map((d) => d.count)
  );

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* 84-Day Study Activity Heatmap */}
      <div className="lg:col-span-7 rounded-2xl border border-border bg-surface p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
              <CalendarDays className="w-3.5 h-3.5" strokeWidth={1.6} />
              <span>Study Consistency • 84 วันย้อนหลัง</span>
            </div>
            <h2 className="text-base font-bold mt-0.5">ปฏิทินความสม่ำเสมอในการเรียน</h2>
          </div>

          <div className="flex items-center gap-3 text-xs text-foreground/70">
            <span>
              ทบทวนสะสม{" "}
              <strong className="font-mono text-foreground">
                {analytics.totalReviewsAllTime}
              </strong>{" "}
              ครั้ง
            </span>
            <span>
              เข้าเรียน{" "}
              <strong className="font-mono text-foreground">
                {analytics.activeDaysCount}
              </strong>{" "}
              วัน
            </span>
          </div>
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="inline-flex gap-1.5 min-w-full justify-between">
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1.5">
                {week.map((day) => (
                  <div
                    key={day.dayKey}
                    title={`${day.dayKey}: ทบทวน ${day.reviews} การ์ด, ข้อสอบ ${day.exams} ชุด`}
                    className={`w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-[4px] border transition-transform hover:scale-110 ${heatCellClass(
                      day.total
                    )}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-foreground/60 pt-1">
          <span>12 สัปดาห์ที่ผ่านมา</span>
          <div className="flex items-center gap-1.5">
            <span>น้อย</span>
            <span className="w-3 h-3 rounded-[3px] border border-border/60 bg-surface-muted" />
            <span className="w-3 h-3 rounded-[3px] border border-matcha/35 bg-matcha/25" />
            <span className="w-3 h-3 rounded-[3px] border border-matcha/60 bg-matcha/50" />
            <span className="w-3 h-3 rounded-[3px] border border-matcha/85 bg-matcha/75" />
            <span className="w-3 h-3 rounded-[3px] border border-matcha bg-matcha" />
            <span>มาก</span>
          </div>
        </div>
      </div>

      {/* 7-Day Review Forecast */}
      <div className="lg:col-span-5 rounded-2xl border border-border bg-surface p-5 flex flex-col justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
            <BarChart3 className="w-3.5 h-3.5" strokeWidth={1.6} />
            <span>FSRS Load Forecast • 7 วันข้างหน้า</span>
          </div>
          <h2 className="text-base font-bold mt-0.5">ปริมาณการ์ดที่ถึงกำหนดทบทวน</h2>
          <p className="text-xs text-foreground/65 mt-0.5">
            คาดการณ์ภาระทบทวนล่วงหน้าเพื่อวางแผนเติมศัพท์ใหม่ได้สมดุล
          </p>
        </div>

        <div className="grid grid-cols-7 gap-2 items-end h-32 pt-4">
          {analytics.forecast7Days.map((day, idx) => {
            const pct = Math.max(8, Math.round((day.count / maxForecast) * 100));
            return (
              <div
                key={day.dayKey}
                className="flex flex-col items-center justify-end h-full gap-1.5"
              >
                <span className="text-[11px] font-mono font-semibold text-foreground/80">
                  {day.count}
                </span>
                <div className="w-full max-w-[28px] flex-1 flex items-end">
                  <div
                    style={{ height: `${day.count === 0 ? 6 : pct}%` }}
                    className={`w-full rounded-t-md transition-all ${
                      idx === 0
                        ? "bg-primary"
                        : day.count > 0
                          ? "bg-primary/45"
                          : "bg-surface-muted"
                    }`}
                  />
                </div>
                <span className="text-[10px] text-foreground/65 truncate max-w-full">
                  {day.labelTh}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
