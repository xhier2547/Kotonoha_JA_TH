"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Award,
  BookMarked,
  BookOpen,
  Cloud,
  Compass,
  Languages,
  MessageCircle,
  Mic,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sun,
  UserCheck,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  CrestSealIcon,
  FlashcardDeckIcon,
  HankoSealEmblem,
} from "@/components/LuxuryIcons";
import { NumberTicker } from "@/components/ui21/NumberTicker";
import {
  DB_MUTATED_EVENT,
  db,
  getAppSettings,
  getJlptAttempts,
  getLearningSummary,
  getLocalDayKey,
  getMinnaProgressMap,
  saveAppSettings,
} from "@/lib/db";
import {
  computeLearnerProgressStats,
  type LearnerProgressStats,
} from "@/lib/gamification";
import {
  readLastRemindedDayKey,
  shouldTriggerReminderToday,
  showBrowserStudyNotification,
  updatePwaAppBadge,
  writeLastRemindedDayKey,
} from "@/lib/studyReminder";
import {
  scheduleBackgroundCloudSync,
  SYNC_STATUS_EVENT,
  type SyncStatusState,
} from "@/lib/cloudSync";
import { getSupabaseClient, getUserDisplayName } from "@/lib/supabase";
import {
  applyThemePreference,
  broadcastThemePreference,
  THEME_CHANGE_EVENT,
} from "@/lib/theme";
import type { ThemePreference } from "@/types/learning";

interface NavItem {
  href: string;
  label: string;
  subLabel?: string;
  icon: typeof Compass;
  badge?: string;
  group: "core" | "phases" | "tools";
}

const NAV_GROUPS: { id: NavItem["group"]; label: string }[] = [
  { id: "core", label: "ภาพรวม & หลักสูตร" },
  { id: "phases", label: "เส้นทางฝึก 4 เฟส" },
  { id: "tools", label: "พจนานุกรม & ระบบ" },
];

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "ภาพรวม & แผนเรียน", subLabel: "Dashboard", icon: Compass, group: "core" },
  { href: "/minna", label: "Minna no Nihongo", subLabel: "50 บท", icon: BookMarked, badge: "50 บท", group: "core" },
  { href: "/jlpt", label: "ข้อสอบ JLPT N5–N1", subLabel: "Mock Exams", icon: Award, badge: "สอบ", group: "core" },
  { href: "/kana", label: "Kana & ระบบเสียง", subLabel: "Phase 1", icon: Languages, badge: "P1", group: "phases" },
  { href: "/srs", label: "แฟลชการ์ด & FSRS", subLabel: "Phase 2", icon: FlashcardDeckIcon as typeof Compass, badge: "P2", group: "phases" },
  { href: "/reader", label: "อ่าน & Mine ประโยค", subLabel: "Phase 3", icon: BookOpen, badge: "P3", group: "phases" },
  { href: "/shadowing", label: "Shadowing & Pitch", subLabel: "Phase 4", icon: Mic, badge: "P4", group: "phases" },
  { href: "/kaiwa", label: "คู่สนทนา AI Kaiwa", subLabel: "Phase 4", icon: MessageCircle, badge: "P4", group: "phases" },
  { href: "/dictionary", label: "พจนานุกรม & คันจิ", subLabel: "Lookup", icon: Search, group: "tools" },
  { href: "/auth", label: "บัญชี & Cloud Sync", subLabel: "Account", icon: Cloud, group: "tools" },
  { href: "/settings", label: "ตั้งค่า & Backup", subLabel: "Settings", icon: Settings, group: "tools" },
];

const MOBILE_NAV = NAV_ITEMS.filter((item) =>
  ["/", "/minna", "/srs", "/reader", "/shadowing", "/kaiwa"].includes(item.href)
);

const THEME_LABELS: Record<ThemePreference, string> = {
  system: "ตามระบบ",
  light: "โหมดสว่าง",
  dark: "โหมดมืด",
};

function nextThemePreference(current: ThemePreference): ThemePreference {
  if (current === "system") return "light";
  if (current === "light") return "dark";
  return "system";
}

function ThemeModeIcon({ theme }: { theme: ThemePreference }) {
  if (theme === "light") return <Sun className="w-4 h-4" strokeWidth={1.6} />;
  if (theme === "dark") return <Moon className="w-4 h-4" strokeWidth={1.6} />;
  return <Monitor className="w-4 h-4" strokeWidth={1.6} />;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [collapsed, setCollapsed] = useState(false);
  const [accountLabel, setAccountLabel] = useState<string | null>(null);
  const [dueCount, setDueCount] = useState<number>(0);
  const [xpStats, setXpStats] = useState<LearnerProgressStats | null>(null);
  const [syncState, setSyncState] = useState<SyncStatusState>({
    syncing: false,
    lastSyncedAt: null,
    error: null,
  });

  useEffect(() => {
    let active = true;

    const refreshMetricsAndReminder = async () => {
      try {
        const [s, summary, totalReviews, minnaMap, jlptAttempts] = await Promise.all([
          getAppSettings(),
          getLearningSummary(),
          db.reviewLogs.count(),
          getMinnaProgressMap(),
          getJlptAttempts(),
        ]);
        if (!active) return;
        const pref = s.theme ?? "system";
        setTheme(pref);
        applyThemePreference(pref);
        setDueCount(summary.dueCount);
        setXpStats(
          computeLearnerProgressStats({
            totalReviews,
            learnedCount: summary.learnedCount,
            masteredCount: summary.masteredCount,
            kanaMasteredCount: summary.kanaMasteredCount,
            completedMinnaCount: Object.values(minnaMap).filter((m) => m.completed)
              .length,
            jlptAttempts,
            streak: summary.streak,
          })
        );
        updatePwaAppBadge(summary.dueCount);

        const todayKey = getLocalDayKey();
        if (
          shouldTriggerReminderToday({
            enabled: s.reminderEnabled,
            reminderTime: s.reminderTime,
            dueCount: summary.dueCount,
            lastRemindedDayKey: readLastRemindedDayKey(),
            todayKey,
          })
        ) {
          const sent = showBrowserStudyNotification({
            dueCount: summary.dueCount,
            dailyMinutes: s.dailyMinutes,
            learnerLevel: s.learnerLevel,
            onClick: () => router.push("/srs"),
          });
          if (sent) {
            writeLastRemindedDayKey(todayKey);
          }
        }
      } catch {
        // Ignore transient IndexedDB read errors during reset/init
      }
    };

    void refreshMetricsAndReminder();
    const reminderInterval = window.setInterval(() => {
      void refreshMetricsAndReminder();
    }, 60_000);

    const handleThemeEvent = (event: Event) => {
      const custom = event as CustomEvent<ThemePreference>;
      if (custom.detail) {
        setTheme(custom.detail);
        applyThemePreference(custom.detail);
      }
    };
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeEvent);

    const handleSyncEvent = (event: Event) => {
      const custom = event as CustomEvent<SyncStatusState>;
      if (custom.detail) setSyncState(custom.detail);
    };
    window.addEventListener(SYNC_STATUS_EVENT, handleSyncEvent);

    const handleDbMutated = () => {
      void refreshMetricsAndReminder();
      scheduleBackgroundCloudSync(2500);
    };
    window.addEventListener(DB_MUTATED_EVENT, handleDbMutated);

    const client = getSupabaseClient();
    let unsubAuth: (() => void) | undefined;
    if (client) {
      void client.auth.getUser().then(({ data }) => {
        if (!active) return;
        const u = data.user;
        setAccountLabel(u ? getUserDisplayName(u) : null);
      });
      const { data: sub } = client.auth.onAuthStateChange((_ev, session) => {
        const u = session?.user;
        setAccountLabel(u ? getUserDisplayName(u) : null);
      });
      unsubAuth = () => sub.subscription.unsubscribe();
    }

    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ignore registration errors in restricted contexts
      });
    }

    return () => {
      active = false;
      window.clearInterval(reminderInterval);
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeEvent);
      window.removeEventListener(SYNC_STATUS_EVENT, handleSyncEvent);
      window.removeEventListener(DB_MUTATED_EVENT, handleDbMutated);
      unsubAuth?.();
    };
  }, [router]);

  const handleSelectTheme = async (next: ThemePreference) => {
    setTheme(next);
    broadcastThemePreference(next);
    const current = await getAppSettings();
    await saveAppSettings({ ...current, theme: next });
  };

  const handleCycleTheme = async () => {
    await handleSelectTheme(nextThemePreference(theme));
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground">
      {/* Desktop Sidebar (21st.dev collapsible rail style) */}
      <aside
        className={`hidden md:flex md:flex-col md:fixed md:inset-y-0 border-r border-border/80 bg-surface/95 backdrop-blur-xl z-30 transition-[width] duration-300 ease-out ${
          collapsed ? "md:w-[76px]" : "md:w-64 lg:w-72"
        }`}
      >
        {/* Brand Header + Collapse Rail Toggle */}
        <div
          className={`relative overflow-hidden border-b border-border/75 bg-gradient-to-br from-primary/10 via-transparent to-accent/5 flex items-center transition-all ${
            collapsed ? "flex-col gap-2 px-2 py-3.5" : "justify-between gap-2 px-4 py-4"
          }`}
        >
          <Link
            href="/"
            title="Kotonoha Studio"
            className="group flex items-center gap-3 min-w-0"
          >
            <HankoSealEmblem className="w-10 h-10 shrink-0 transition-transform duration-300 group-hover:scale-105" />
            {!collapsed && (
              <div className="min-w-0">
                <div className="font-bold text-[15px] tracking-tight text-foreground truncate">
                  Kotonoha Studio
                </div>
                <div className="text-[11px] text-foreground/60 font-jp truncate">
                  言の葉スタジオ • Zero to Fluent
                </div>
              </div>
            )}
          </Link>

          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "ขยายแถบเมนูด้านข้าง" : "ย่อแถบเมนูเป็นไอคอน"}
            aria-label={collapsed ? "ขยายแถบเมนู" : "ย่อแถบเมนู"}
            className="p-1.5 rounded-lg border border-border/70 bg-background/70 hover:bg-surface-muted text-foreground/65 hover:text-foreground transition-colors shrink-0 cursor-pointer"
          >
            {collapsed ? (
              <PanelLeftOpen className="w-3.5 h-3.5" />
            ) : (
              <PanelLeftClose className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Grouped Navigation */}
        <nav
          aria-label="เมนูหลัก"
          className="flex-1 px-2.5 py-3.5 space-y-4 overflow-y-auto overflow-x-hidden"
        >
          {NAV_GROUPS.map((group) => {
            const groupItems = NAV_ITEMS.filter((item) => item.group === group.id);
            return (
              <div key={group.id} className="space-y-1">
                {!collapsed ? (
                  <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/45 select-none">
                    {group.label}
                  </div>
                ) : (
                  <div className="mx-3 my-1.5 h-px bg-border/60" aria-hidden="true" />
                )}
                {groupItems.map((item) => {
                  const Icon = item.icon;
                  const active =
                    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex items-center rounded-xl text-[13px] font-medium transition-all duration-200 ${
                        collapsed ? "justify-center p-2" : "gap-2.5 px-2.5 py-2"
                      } ${
                        active
                          ? "bg-primary/10 text-primary dark:bg-primary/16 dark:text-white border border-primary/25 shadow-xs"
                          : "border border-transparent text-foreground/75 hover:bg-surface-muted/85 hover:text-foreground"
                      }`}
                    >
                      {/* Active left accent bar */}
                      <span
                        aria-hidden="true"
                        className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full transition-all duration-200 ${
                          active
                            ? "h-5 bg-primary opacity-100"
                            : "h-0 bg-primary/40 opacity-0 group-hover:h-3 group-hover:opacity-60"
                        }`}
                      />

                      {/* Icon Tile */}
                      <span
                        className={`relative w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ${
                          active
                            ? "bg-gradient-to-br from-primary to-indigo-600 text-white shadow-xs"
                            : "bg-surface-muted/85 text-foreground/70 group-hover:bg-background group-hover:text-primary"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
                        {collapsed && item.href === "/srs" && dueCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-surface" />
                        )}
                      </span>

                      {!collapsed && (
                        <>
                          <span className="flex-1 min-w-0 truncate">{item.label}</span>

                          {item.href === "/srs" && dueCount > 0 ? (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold font-mono shrink-0 ${
                                active
                                  ? "bg-primary text-white"
                                  : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {dueCount}
                            </span>
                          ) : (
                            item.badge && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 ${
                                  active
                                    ? "bg-primary/15 text-primary dark:bg-white/15 dark:text-white"
                                    : "bg-surface-muted text-foreground/55 group-hover:text-foreground/80"
                                }`}
                              >
                                {item.badge}
                              </span>
                            )
                          )}
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Bottom Dock Card: XP Rank + Cloud Status + Segmented Theme Bar */}
        {collapsed ? (
          <div className="p-2 m-2 rounded-2xl bg-surface-muted/65 border border-border/80 flex flex-col items-center gap-2">
            {xpStats && (
              <div
                title={`Lv.${xpStats.currentRank.level} ${xpStats.currentRank.titleTh} • ${xpStats.totalXp.toLocaleString()} XP`}
                className="w-9 h-9 rounded-xl bg-primary/12 border border-primary/25 flex items-center justify-center font-jp font-bold text-xs text-primary"
              >
                {xpStats.currentRank.kanjiSeal}
              </div>
            )}
            <Link
              href="/auth"
              title={accountLabel ? `${accountLabel} (ออนไลน์)` : "เข้าสู่ระบบ / Sync"}
              className="w-9 h-9 rounded-xl border border-border/75 bg-background/85 hover:bg-background flex items-center justify-center relative"
            >
              {accountLabel ? (
                <>
                  <UserCheck className="w-4 h-4 text-emerald-500" />
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </>
              ) : (
                <Cloud className="w-4 h-4 text-foreground/65" />
              )}
            </Link>
            <button
              type="button"
              onClick={() => void handleCycleTheme()}
              title={`ธีมปัจจุบัน: ${THEME_LABELS[theme]} (คลิกเพื่อสลับ)`}
              aria-label={`สลับธีม (${THEME_LABELS[theme]})`}
              className="w-9 h-9 rounded-xl border border-border/75 bg-background/85 hover:bg-background flex items-center justify-center text-foreground/80 cursor-pointer"
            >
              <ThemeModeIcon theme={theme} />
            </button>
          </div>
        ) : (
          <div className="p-3 m-2.5 rounded-2xl bg-surface-muted/65 border border-border/80 text-xs space-y-2.5">
            {xpStats && (
              <div className="rounded-xl bg-background/85 border border-border/75 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[11px] truncate text-foreground">
                    <span className="font-jp mr-1 text-primary">{xpStats.currentRank.kanjiSeal}</span>
                    Lv.{xpStats.currentRank.level} {xpStats.currentRank.titleTh}
                  </span>
                  <span className="font-mono font-bold text-[11px] text-amber-600 dark:text-amber-300 shrink-0">
                    <NumberTicker value={xpStats.totalXp} /> XP
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${xpStats.currentRank.gradientClass} transition-all duration-500`}
                    style={{ width: `${xpStats.progressPct}%` }}
                  />
                </div>
              </div>
            )}

            <Link
              href="/auth"
              className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border border-border/75 bg-background/85 hover:bg-background transition-colors"
            >
              <span className="inline-flex items-center gap-2 font-medium min-w-0">
                {accountLabel ? (
                  <>
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="truncate text-foreground">{accountLabel}</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-3.5 h-3.5 text-foreground/60 shrink-0" />
                    <span className="text-foreground/75 truncate">เข้าสู่ระบบ / Sync</span>
                  </>
                )}
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary shrink-0">
                {syncState.syncing
                  ? "Syncing..."
                  : syncState.lastSyncedAt
                    ? "Synced"
                    : accountLabel
                      ? "ออนไลน์"
                      : "Cloud"}
              </span>
            </Link>

            {/* 3-Way Segmented Theme Switcher */}
            <div
              role="group"
              aria-label="เลือกโหมดสีหน้าจอ"
              className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-background/85 border border-border/75"
            >
              {(
                [
                  { id: "light", label: "สว่าง", icon: Sun },
                  { id: "dark", label: "มืด", icon: Moon },
                  { id: "system", label: "ระบบ", icon: Monitor },
                ] as const
              ).map((opt) => {
                const OptIcon = opt.icon;
                const selected = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => void handleSelectTheme(opt.id)}
                    aria-pressed={selected}
                    className={`inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                      selected
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-foreground/65 hover:text-foreground hover:bg-surface-muted/70"
                    }`}
                  >
                    <OptIcon className="w-3 h-3" strokeWidth={1.8} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[10px] text-foreground/55 pt-0.5">
              <CrestSealIcon className="w-3 h-3 text-primary/70 shrink-0" />
              <span className="truncate">Memory Curve 15m • อ่าน i+1 • Shadowing</span>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-border/80 bg-surface/90 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2.5">
          <HankoSealEmblem className="w-8 h-8 shrink-0" />
          <div>
            <div className="font-bold text-sm leading-tight">Kotonoha Studio</div>
            <div className="text-[11px] text-foreground/60 font-jp">Zero to Natural Japanese</div>
          </div>
        </Link>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleCycleTheme}
            className="p-2 rounded-lg hover:bg-surface-muted text-foreground/75 cursor-pointer"
            aria-label={`Theme: ${THEME_LABELS[theme]}`}
            title={THEME_LABELS[theme]}
          >
            <ThemeModeIcon theme={theme} />
          </button>
          <Link
            href="/kana"
            className="p-2 rounded-lg hover:bg-surface-muted text-foreground/75"
            aria-label="Kana Dojo"
            title="Kana & ระบบเสียง"
          >
            <Languages className="w-5 h-5" />
          </Link>
          <Link
            href="/jlpt"
            className="p-2 rounded-lg hover:bg-surface-muted text-foreground/75"
            aria-label="JLPT Exams"
          >
            <Award className="w-5 h-5" />
          </Link>
          <Link
            href="/dictionary"
            className="p-2 rounded-lg hover:bg-surface-muted text-foreground/75"
            aria-label="Dictionary"
          >
            <Search className="w-5 h-5" />
          </Link>
          <Link
            href="/auth"
            className={`p-2 rounded-lg hover:bg-surface-muted ${
              accountLabel ? "text-matcha" : "text-foreground/75"
            }`}
            aria-label="Account & Sync"
            title={accountLabel ?? "เข้าสู่ระบบ / Cloud Sync"}
          >
            {accountLabel ? <UserCheck className="w-5 h-5" /> : <Cloud className="w-5 h-5" />}
          </Link>
          <Link
            href="/settings"
            className="p-2 rounded-lg hover:bg-surface-muted text-foreground/75"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main
        className={`flex-1 pb-20 md:pb-8 transition-[padding] duration-300 ease-out ${
          collapsed ? "md:pl-[76px]" : "md:pl-64 lg:pl-72"
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur-md border-t border-border grid grid-cols-6 px-1 py-1.5">
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 rounded-lg text-[10px] font-medium transition-colors ${
                active ? "text-primary" : "text-foreground/60"
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="truncate max-w-[56px]">
                {item.href === "/"
                  ? "หน้าหลัก"
                  : item.href === "/minna"
                    ? "Minna"
                    : item.href === "/srs"
                      ? "FSRS"
                      : item.href === "/reader"
                        ? "อ่าน"
                        : item.href === "/shadowing"
                          ? "Shadow"
                          : "Kaiwa"}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
