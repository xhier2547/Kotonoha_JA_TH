"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
import {
  DB_MUTATED_EVENT,
  getAppSettings,
  saveAppSettings,
} from "@/lib/db";
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
  phase?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "ภาพรวม & แผนเรียน", subLabel: "Dashboard", icon: Compass },
  { href: "/minna", label: "Minna no Nihongo", subLabel: "Book Guide", icon: BookMarked, phase: "หนังสือ" },
  { href: "/jlpt", label: "ข้อสอบ JLPT N5–N1", subLabel: "Full Mock Tests", icon: Award, phase: "สอบ" },
  { href: "/kana", label: "Kana & ระบบเสียง", subLabel: "Phase 1", icon: Languages, phase: "1" },
  { href: "/srs", label: "แฟลชการ์ด & FSRS", subLabel: "Phase 2", icon: FlashcardDeckIcon as typeof Compass, phase: "2" },
  { href: "/reader", label: "อ่าน & Mine ประโยค", subLabel: "Phase 3", icon: BookOpen, phase: "3" },
  { href: "/shadowing", label: "Shadowing & Pitch", subLabel: "Phase 4", icon: Mic, phase: "4" },
  { href: "/kaiwa", label: "คู่สนทนา AI Kaiwa", subLabel: "Phase 4", icon: MessageCircle, phase: "4" },
  { href: "/dictionary", label: "พจนานุกรม & คันจิ", subLabel: "Lookup", icon: Search },
  { href: "/auth", label: "บัญชี & Cloud Sync", subLabel: "Account", icon: Cloud },
  { href: "/settings", label: "ตั้งค่า & Backup", subLabel: "Settings", icon: Settings },
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
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [accountLabel, setAccountLabel] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncStatusState>({
    syncing: false,
    lastSyncedAt: null,
    error: null,
  });

  useEffect(() => {
    let active = true;
    getAppSettings().then((s) => {
      if (!active) return;
      const pref = s.theme ?? "system";
      setTheme(pref);
      applyThemePreference(pref);
    });

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
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeEvent);
      window.removeEventListener(SYNC_STATUS_EVENT, handleSyncEvent);
      window.removeEventListener(DB_MUTATED_EVENT, handleDbMutated);
      unsubAuth?.();
    };
  }, []);

  const handleCycleTheme = async () => {
    const next = nextThemePreference(theme);
    setTheme(next);
    broadcastThemePreference(next);
    const current = await getAppSettings();
    await saveAppSettings({ ...current, theme: next });
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 lg:w-72 md:flex-col md:fixed md:inset-y-0 border-r border-border/80 bg-surface/85 backdrop-blur-md z-30">
        <div className="px-5 py-5 border-b border-border/80 flex items-center gap-3">
          <HankoSealEmblem className="w-10 h-10 shrink-0" />
          <div>
            <div className="font-bold text-base tracking-tight flex items-center gap-1.5">
              <span>Kotonoha Studio</span>
            </div>
            <div className="text-xs text-foreground/60 font-jp">言の葉スタジオ • Zero to Fluent</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm translate-x-0.5"
                    : "text-foreground/75 hover:bg-surface-muted/80 hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" strokeWidth={1.6} />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{item.label}</div>
                </div>
                {item.phase && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-surface-muted text-foreground/60"
                    }`}
                  >
                    P{item.phase}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 m-3 rounded-2xl bg-surface-muted/70 border border-border/80 text-xs space-y-2.5">
          <Link
            href="/auth"
            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border border-border/80 bg-surface hover:bg-surface-muted transition-colors"
          >
            <span className="inline-flex items-center gap-1.5 font-medium truncate">
              {accountLabel ? (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-matcha shrink-0" />
                  <span className="truncate">{accountLabel}</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5 text-foreground/60 shrink-0" />
                  <span className="text-foreground/75">Guest • เข้าสู่ระบบ</span>
                </>
              )}
            </span>
            <span className="text-[10px] text-primary shrink-0">
              {syncState.syncing
                ? "กำลังซิงค์..."
                : syncState.lastSyncedAt
                  ? "Synced"
                  : accountLabel
                    ? "ออนไลน์"
                    : "Sync"}
            </span>
          </Link>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-primary">
              <CrestSealIcon className="w-3.5 h-3.5" />
              <span>หลักการเรียนที่ได้ผลสูงสุด</span>
            </div>
            <button
              type="button"
              onClick={handleCycleTheme}
              title={`ธีมปัจจุบัน: ${THEME_LABELS[theme]} (คลิกเพื่อสลับ)`}
              aria-label={`สลับธีม (${THEME_LABELS[theme]})`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border/80 bg-surface hover:bg-surface-muted text-[11px] font-medium text-foreground/80 transition-colors cursor-pointer"
            >
              <ThemeModeIcon theme={theme} />
              <span>{THEME_LABELS[theme]}</span>
            </button>
          </div>
          <p className="text-foreground/70 leading-relaxed">
            ทบทวน Flashcard ตาม Memory Curve วันละ 15 นาที + อ่าน <span className="font-mono font-semibold">i+1</span> + Shadowing
          </p>
        </div>
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
      <main className="flex-1 md:pl-64 lg:pl-72 pb-20 md:pb-8">
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
