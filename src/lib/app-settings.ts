/**
 * Global user preferences — theme mode, motion control, simulation framerate
 * and text comfort.
 *
 * The animated background field and its two knobs ("background glow" and
 * "pointer-tracking background") were removed with the field itself. The glow
 * strength is therefore a CONSTANT now (`GLOW_LEVEL` below), pinned at the
 * value the old slider's ceiling produced, so every layer that used to brighten
 * or dim with it keeps exactly the look it was designed against.
 *
 * Deliberately framework-free: the live values live in a module singleton so
 * the STEM Lab's requestAnimationFrame loops can read them every frame
 * without re-subscribing to React state. `SettingsProvider` is the only writer.
 */
import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type TextComfort = "small" | "medium" | "large" | "dyslexic";
export type FrameTarget = "30" | "60" | "uncapped";

export interface AppSettings {
  /** Motionless mode: freezes every continuous loop and idle 3D orbit. */
  reduceMotion: boolean;
  frameTarget: FrameTarget;
  themeMode: ThemeMode;
  textComfort: TextComfort;
  /**
   * Eye comfort: a low-glare rendering of whichever theme is active — warm
   * neutral stone in the day theme, warm charcoal at night, with every surface
   * token (including the sidebar, menus and lab) redefined and a small
   * luminance trim on images and canvases. It is a reading mode, not a yellow
   * filter; colour-critical stains and spectra keep their meaning.
   */
  eyeComfort: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  reduceMotion: false,
  frameTarget: "60",
  themeMode: "dark",
  textComfort: "medium",
  eyeComfort: false,
};

/**
 * The one glow strength the site renders at. It is the value the old
 * "Background glow" slider produced at its ceiling (60%), because that is the
 * brightness every glow layer in the app was tuned against.
 */
export const GLOW_LEVEL = 1;

const STORE_KEY = "manthan-settings";
/** Legacy key the header toggle already reads/writes. */
const LEGACY_THEME_KEY = "manthan-theme";

/** Mutable mirror read inside 60fps render loops. */
export const settingsRuntime = {
  reduceMotion: false,
  /** Simulation canvases lean toward the pointer; always on now that the knob
   *  that used to disable it is gone. */
  cursorField: true,
  /** 0 means "uncapped". */
  frameTarget: 60,
  /** 0..1 glow strength — a constant, see `GLOW_LEVEL`. */
  ambient: GLOW_LEVEL,
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
    /* The header toggle used to write only this legacy key. If a browser has
       a theme there and no settings object yet, adopt it — otherwise the
       pre-paint script would open in light and SettingsProvider would snap
       straight back to the default dark on the first paint. */
    const legacy = window.localStorage.getItem(LEGACY_THEME_KEY);
    if (!raw) {
      return legacy === "light" || legacy === "dark"
        ? { ...DEFAULT_SETTINGS, themeMode: legacy }
        : DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    /* Fields from before the background field was removed (`ambient`,
       `cursorField`) are simply ignored: they are not part of AppSettings any
       more, so a stored object carrying them still loads cleanly. */
    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    if (!parsed.themeMode && (legacy === "light" || legacy === "dark")) {
      merged.themeMode = legacy;
    }
    return merged;
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
  settingsRuntime.reduceMotion = settings.reduceMotion;
  settingsRuntime.frameTarget = frameTargetToFps(settings.frameTarget);
  settingsRuntime.cursorField = true;
  settingsRuntime.ambient = GLOW_LEVEL;

  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const dark = resolveTheme(settings.themeMode) === "dark";

  root.classList.toggle("dark", dark);
  root.setAttribute("data-theme", dark ? "dark" : "light");
  root.setAttribute("data-motion", settings.reduceMotion ? "reduced" : "full");
  root.setAttribute("data-text", settings.textComfort);
  /* The whole eye-comfort treatment lives in index.css, keyed off this
     attribute, so the overlay tint and the warm token overrides land in the
     same paint as the theme switch. */
  root.setAttribute("data-comfort", settings.eyeComfort ? "on" : "off");
  /* Glow strength is pinned, not scalable. These three properties plus the
     band attribute are still written so every existing rule that reads them
     (`var(--ambient)`, `var(--ambient-dur)`, `var(--ambient-blur)`,
     `[data-ambient]`) keeps the exact look it was tuned against instead of
     falling back to a hardcoded default. */
  root.setAttribute("data-ambient", "full");
  root.style.setProperty("--ambient", GLOW_LEVEL.toFixed(3));
  root.style.setProperty("--ambient-dur", "1.00");
  root.style.setProperty("--ambient-blur", "1.00");
  root.style.setProperty("--bg-glow-opacity", GLOW_LEVEL.toFixed(3));
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
