import type { ThemePreference } from "@/types/learning";

export const THEME_CHANGE_EVENT = "kotonoha-theme-change";

export function applyThemePreference(theme: ThemePreference = "system"): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "light" || theme === "dark") {
    root.dataset.theme = theme;
  } else {
    delete root.dataset.theme;
  }
}

export function broadcastThemePreference(theme: ThemePreference): void {
  applyThemePreference(theme);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<ThemePreference>(THEME_CHANGE_EVENT, { detail: theme }));
  }
}
