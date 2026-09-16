import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SETTINGS,
  applySettings,
  loadSettings,
  resolveTheme,
  saveSettings,
  systemPrefersReducedMotion,
  type AppSettings,
} from "@/lib/app-settings";

export interface SettingsContextValue {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  reset: () => void;
  /** the theme actually painted right now ("system" already resolved) */
  resolvedTheme: "light" | "dark";
  /** true when the OS asks for reduced motion (shown as a hint in the UI) */
  systemReducedMotion: boolean;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  update: () => {},
  reset: () => {},
  resolvedTheme: "dark",
  systemReducedMotion: false,
});

/**
 * Paint stored preferences before React mounts so the first frame already
 * matches the user's theme / motion / text choices (no flash).
 */
if (typeof document !== "undefined") {
  applySettings(loadSettings());
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [systemReducedMotion] = useState(() => systemPrefersReducedMotion());

  useEffect(() => {
    applySettings(settings);
    saveSettings(settings);
  }, [settings]);

  /* "System Default" theme follows the OS live. */
  useEffect(() => {
    if (settings.themeMode !== "system") return;
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    const onChange = () => applySettings(settings);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [settings]);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      update,
      reset,
      resolvedTheme: resolveTheme(settings.themeMode),
      systemReducedMotion,
    }),
    [settings, update, reset, systemReducedMotion],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}

export default SettingsProvider;
