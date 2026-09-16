/**
 * Global user preferences — theme mode, motion control, ambient intensity,
 * simulation framerate and text comfort.
 *
 * Deliberately framework-free: the live values live in a module singleton so
 * the STEM Lab's requestAnimationFrame loops can read them every frame
 * without re-subscribing to React state. `SettingsProvider` is the only writer.
 */
import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type TextComfort = "small" | "medium" | "large" | "dyslexic";
export type FrameTarget = "30" | "60" | "uncapped";
export type AmbientBand = "flat" | "low" | "mid" | "full";

export interface AppSettings {
  /** 0 = fully static / flat, 100 = maximum neon glow, blur and particles. */
  ambient: number;
  /** Motionless mode: freezes every continuous loop and idle 3D orbit. */
  reduceMotion: boolean;
  frameTarget: FrameTarget;
  themeMode: ThemeMode;
  textComfort: TextComfort;
}

export const DEFAULT_SETTINGS: AppSettings = {
  ambient: 100,
  reduceMotion: false,
  frameTarget: "60",
  themeMode: "dark",
  textComfort: "medium",
};

const STORE_KEY = "manthan-settings";
/** Legacy key the header toggle already reads/writes. */
const LEGACY_THEME_KEY = "manthan-theme";

/** Mutable mirror read inside 60fps render loops. */
export const settingsRuntime = {
  reduceMotion: false,
  /** 0 means "uncapped". */
  frameTarget: 60,
  /** 0..1 mirror of `ambient`. */
  ambient: 1,
};

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Typography scale written to `--text-scale`, which the global stylesheet
 * multiplies against the 16px root size (everything downstream is rem).
 */
export const TEXT_SCALE: Record<TextComfort, number> = {
  small: 0.94,
  medium: 1,
  large: 1.12,
  dyslexic: 1.06,
};

export function frameTargetToFps(target: FrameTarget) {
  return target === "30" ? 30 : target === "60" ? 60 : 0;
}

export function ambientBand(ambient: number): AmbientBand {
  if (ambient <= 0) return "flat";
  if (ambient < 34) return "low";
  if (ambient < 67) return "mid";
  return "full";
}

/** Ambient loops slow down (never stop) as intensity is dialled back. */
function ambientDuration(ambient: number) {
  return (1 + (1 - clamp01(ambient / 100)) * 1.2).toFixed(2);
}

function mediaMatches(query: string, fallback: boolean) {
  try {
    return window.matchMedia(query).matches;
  } catch {
    return fallback;
  }
}

export const systemPrefersDark = () => mediaMatches("(prefers-color-scheme: dark)", true);

export const systemPrefersReducedMotion = () =>
  mediaMatches("(prefers-reduced-motion: reduce)", false);

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light";
  return mode;
}

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      ambient: typeof parsed.ambient === "number" ? parsed.ambient : DEFAULT_SETTINGS.ambient,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(settings));
  } catch {
    /* private mode */
  }
}

/**
 * Push a settings object into the DOM. Everything downstream (CSS hooks in
 * settings.css / lab.css and the lab's render loops) reads from here, so a
 * single call repaints the whole experience instantly.
 */
export function applySettings(settings: AppSettings) {
  const ambient = clamp01(settings.ambient / 100);

  settingsRuntime.reduceMotion = settings.reduceMotion;
  settingsRuntime.frameTarget = frameTargetToFps(settings.frameTarget);
  settingsRuntime.ambient = ambient;

  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const dark = resolveTheme(settings.themeMode) === "dark";

  root.classList.toggle("dark", dark);
  root.setAttribute("data-theme", dark ? "dark" : "light");
  root.setAttribute("data-motion", settings.reduceMotion ? "reduced" : "full");
  root.setAttribute("data-text", settings.textComfort);
  root.setAttribute("data-ambient", ambientBand(settings.ambient));
  root.style.setProperty("--ambient", ambient.toFixed(3));
  root.style.setProperty("--ambient-dur", ambientDuration(settings.ambient));
  root.style.setProperty("--ambient-blur", (0.55 + 0.45 * ambient).toFixed(2));
  // Ambient Intensity -> the single global driver for every background glow.
  // 0% fades the blurred backdrop shapes out completely, 100% renders them
  // at full softness. Read by `.mesh-field` and the ambient glow layers.
  root.style.setProperty("--bg-glow-opacity", ambient.toFixed(3));
  // Text Comfort -> the typography scaling module (root rem size).
  root.style.setProperty("--text-scale", String(TEXT_SCALE[settings.textComfort] ?? 1));

  // Keep the header ThemeToggle on the same source of truth.
  try {
    window.localStorage.setItem(LEGACY_THEME_KEY, dark ? "dark" : "light");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("manthan:theme", { detail: { dark } }));
}

/** Frame delta for *autonomous* animation — 0 while motion is reduced. */
export const animDt = (dt: number) => (settingsRuntime.reduceMotion ? 0 : dt);

/**
 * Resolved-theme subscription for plain DOM widgets (used by the header
 * toggle) so preference changes made in the dashboard land immediately.
 */
export function useResolvedTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof document === "undefined"
      ? "dark"
      : document.documentElement.classList.contains("dark")
        ? "dark"
        : "light",
  );
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ dark: boolean }>).detail;
      if (detail) setTheme(detail.dark ? "dark" : "light");
    };
    window.addEventListener("manthan:theme", onChange);
    return () => window.removeEventListener("manthan:theme", onChange);
  }, []);
  return theme;
}
