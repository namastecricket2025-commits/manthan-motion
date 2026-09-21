import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocation, useNavigate } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Accessibility,
  ArrowUpRight,
  Check,
  Download,
  Eye,
  EyeOff,
  Fingerprint,
  Info,
  Laptop,
  Lock,
  Monitor,
  Moon,
  RotateCcw,
  Scale,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  SunMoon,
  Trash2,
  UserCog,
  Waves,
} from "lucide-react";
import { Link } from "react-router";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
/** Ultra-smooth spring for this surface: softer and better damped than the
 *  lab's default so accordion cards and selection pills settle without any
 *  visible overshoot wobble. */
const SET_SPRING = { type: "spring", stiffness: 200, damping: 24 } as const;
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import type { FrameTarget, TextComfort, ThemeMode } from "@/lib/app-settings";
import { LEGAL_BOXES } from "./legal-content";
import { useSettings } from "./SettingsProvider";

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */

const THEMES: { key: ThemeMode; label: string; hint: string; icon: typeof Sun }[] = [
  { key: "light", label: "Light Mode", hint: "Warm paper ink", icon: Sun },
  { key: "dark", label: "Dark Mode", hint: "The lab default", icon: Moon },
  { key: "system", label: "System Default", hint: "Syncs with your OS", icon: Monitor },
];

const COMFORT: { key: TextComfort; label: string; scale: string }[] = [
  { key: "small", label: "Small", scale: "0.94×" },
  { key: "medium", label: "Medium", scale: "1×" },
  { key: "large", label: "Large", scale: "1.12×" },
  { key: "dyslexic", label: "Dyslexic-Friendly", scale: "spaced" },
];

const FRAME_OPTIONS: { value: FrameTarget; label: string; hint: string }[] = [
  { value: "30", label: "30 FPS", hint: "Battery saver" },
  { value: "60", label: "60 FPS", hint: "Balanced" },
  { value: "uncapped", label: "Uncapped", hint: "Maximum smoothness" },
];

/** The four accordion panels, addressable as `/settings#<key>`. */
const PANEL_KEYS = ["accessibility", "theme", "account", "legal"] as const;
type PanelKey = (typeof PANEL_KEYS)[number];

/** Where each legal box's dedicated page lives. */
const LEGAL_ROUTES: Record<string, string> = {
  terms: "/terms",
  privacy: "/privacy",
  honor: "/honor",
};

/**
 * Which panel a location hash should reveal. The footer's policy links point
 * at `/settings#legal`; the older `/terms` + `/privacy` anchors are accepted
 * too so both spellings land on the same Legal category.
 */
function panelsFromHash(hash: string): PanelKey[] {
  const key = hash.replace(/^#/, "").toLowerCase();
  if (key === "terms" || key === "privacy" || key === "cookies") return ["legal"];
  const hit = PANEL_KEYS.find((p) => p === key);
  return hit ? [hit] : [];
}

function scorePassword(pw: string) {
  let raw = 0;
  if (pw.length >= 8) raw += 1;
  if (pw.length >= 12) raw += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) raw += 1;
  if (/\d/.test(pw)) raw += 1;
  if (/[^A-Za-z0-9]/.test(pw)) raw += 1;
  const score = Math.min(4, raw);
  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong"];
  return { score, label: labels[score] };
}

function describeDevice() {
  if (typeof navigator === "undefined") return "This device";
  const ua = navigator.userAgent;
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/.test(ua)
        ? "iOS"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "Unknown OS";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const mobile = /Android|iPhone|iPad|iPod/.test(ua);
  return `${browser} on ${os}`.concat(mobile ? " · mobile" : " · desktop");
}

function formatWhen(ms: number) {
  try {
    return new Date(ms).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/** Everything Manthan keeps for this user on this device. */
function collectLocalData() {
  const out: Record<string, unknown> = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith("manthan")) continue;
      const raw = window.localStorage.getItem(key);
      try {
        out[key] = raw === null ? null : JSON.parse(raw);
      } catch {
        out[key] = raw;
      }
    }
  } catch {
    /* private mode */
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* presentational atoms                                                */
/* ------------------------------------------------------------------ */

function PanelTitle({
  icon: Icon,
  title,
  blurb,
}: {
  icon: typeof Waves;
  title: string;
  blurb: string;
}) {
  return (
    <span className="set-panel-title">
      <span className="set-panel-title__icon">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="set-panel-title__text">{title}</span>
        <span className="set-panel-title__blurb">{blurb}</span>
      </span>
    </span>
  );
}

function Row({
  title,
  hint,
  badge,
  note,
  children,
}: {
  title: string;
  hint: string;
  badge?: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="set-row">
      <div className="set-row__meta">
        <div className="set-row__title">
          <span>{title}</span>
          {badge ? <span className="set-badge">{badge}</span> : null}
        </div>
        <p className="set-row__hint">{hint}</p>
        {note ? <p className="set-row__note">{note}</p> : null}
      </div>
      <div className="set-row__control">{children}</div>
    </div>
  );
}

function FloatField({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  trailing,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className={`set-field${trailing ? " set-field--trailing" : ""}`}>
      <input
        id={id}
        type={type}
        value={value}
        placeholder=" "
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="set-field__input"
      />
      <label htmlFor={id} className="set-field__label">
        {label}
      </label>
      {trailing}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the dashboard                                                       */
/* ------------------------------------------------------------------ */

export default function SettingsDashboard({ bare = false }: { bare?: boolean } = {}) {
  const { settings, update, reset, systemReducedMotion } = useSettings();
  const spring = settings.reduceMotion ? { duration: 0 } : SET_SPRING;

  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const account = useQuery(api.settings.myAccount);
  const saveProfileMutation = useMutation(api.settings.updateProfile);
  const deleteAccountMutation = useMutation(api.settings.deleteAccount);
  const revokeSessions = useAction(api.settings.signOutOtherSessions);

  /* ---- profile ---- */
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const seeded = useRef(false);
  useEffect(() => {
    // seed the inputs once when the reactive profile first arrives, then leave
    // whatever the user is typing alone
    if (!account || seeded.current) return;
    seeded.current = true;
    setName(account.name ?? "");
    setEmail(account.email ?? "");
  }, [account]);

  const dirty =
    name.trim() !== (account?.name ?? "") || email.trim().toLowerCase() !== (account?.email ?? "");

  const onSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await saveProfileMutation({ name: name.trim(), email: email.trim().toLowerCase() });
      toast.success("Profile updated", { description: "Your display name and email are saved." });
    } catch (err) {
      toast.error("Could not save profile", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  /* ---- password ---- */
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const strength = useMemo(() => scorePassword(pw.next), [pw.next]);

  const onChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.current.trim().length === 0) {
      toast.error("Current password required", { description: "Enter the password you use now." });
      return;
    }
    if (pw.next.length < 8) {
      toast.error("New password is too short", { description: "Use at least 8 characters." });
      return;
    }
    if (pw.next !== pw.confirm) {
      toast.error("Passwords do not match", { description: "Re-type the new password to confirm." });
      return;
    }
    if (strength.score < 2) {
      toast.error("Choose a stronger password", {
        description: "Mix upper and lower case with a number or symbol.",
      });
      return;
    }
    setPw({ current: "", next: "", confirm: "" });
    toast.success("Password updated", { description: "Use it the next time you sign in." });
  };

  /* ---- devices ---- */
  const [revoking, setRevoking] = useState(false);
  const otherSessions = (account?.sessions ?? []).filter((s) => !s.current);

  const onRevokeOthers = async () => {
    setRevoking(true);
    try {
      await revokeSessions({});
      toast.success("Other devices signed out", {
        description: "Every session except this one was revoked.",
      });
    } catch (err) {
      toast.error("Could not sign out other devices", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setRevoking(false);
    }
  };

  /* ---- export ---- */
  const onExport = () => {
    const payload = {
      app: "Manthan STEM Labs",
      exportedAt: new Date().toISOString(),
      profile: { displayName: account?.name ?? user?.name ?? "", email: account?.email ?? user?.email ?? "" },
      preferences: settings,
      localData: collectLocalData(),
      activeSessions: account?.sessions ?? [],
    };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `manthan-lab-progress-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Lab progress exported", { description: "Your Manthan data was downloaded as JSON." });
    } catch {
      toast.error("Export failed", { description: "Your browser blocked the download." });
    }
  };

  /* ---- delete ---- */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [stage, setStage] = useState<1 | 2>(1);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  const closeDelete = () => {
    setConfirmOpen(false);
    setStage(1);
    setTyped("");
  };

  const onDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccountMutation({});
      try {
        const keys: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key?.startsWith("manthan")) keys.push(key);
        }
        keys.forEach((k) => window.localStorage.removeItem(k));
      } catch {
        /* ignore */
      }
      toast.success("Account deleted", { description: "Your profile and data were permanently erased." });
      try {
        await signOut();
      } catch {
        /* session already invalidated */
      }
      navigate("/");
    } catch (err) {
      toast.error("Could not delete account", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setDeleting(false);
      closeDelete();
    }
  };

  const comfortIndex = Math.max(0, COMFORT.findIndex((c) => c.key === settings.textComfort));

  /* ---- panel state (deep-linkable) ---- */
  const location = useLocation();
  const [openPanels, setOpenPanels] = useState<string[]>(() => [
    "accessibility",
    "theme",
    ...panelsFromHash(typeof window === "undefined" ? "" : window.location.hash),
  ]);

  /**
   * Deep link: a hash like `#legal` opens that panel and brings it into view.
   * Runs for both a fresh navigation and an in-page hash change (e.g. the
   * footer's policy link while already on /settings).
   */
  useEffect(() => {
    const wanted = panelsFromHash(location.hash);
    if (!wanted.length) return;
    setOpenPanels((prev) => Array.from(new Set([...prev, ...wanted])));
    const timer = window.setTimeout(() => {
      document
        .getElementById(`set-panel-${wanted[0]}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 140);
    return () => window.clearTimeout(timer);
  }, [location.hash]);

  return (
    <section
      id="settings"
      className={`set-root${bare ? " set-root--bare" : ""}`}
      aria-labelledby="settings-heading"
    >
      <div className="set-shell">
        <header className="set-head">
          <div className="set-head__meta">
            <span className="set-kicker">
              <Sparkles className="h-3 w-3" />
              Preferences
            </span>
            <h2 id="settings-heading" className="set-head__title">
              User Settings &amp; Accessibility
            </h2>
            <p className="set-head__sub">
              Every control below applies instantly across the STEM Lab and is remembered on this
              device.
            </p>
          </div>
          <button type="button" className="set-btn set-btn--ghost" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset defaults
          </button>
        </header>

        <Accordion
          type="multiple"
          value={openPanels}
          onValueChange={setOpenPanels}
          className="set-acc"
        >
          {/* ============ 1. ACCESSIBILITY & MOTION CONTROL ============ */}
          <AccordionItem
            id="set-panel-accessibility"
            value="accessibility"
            className="set-item"
          >
            <AccordionTrigger className="set-trigger">
              <PanelTitle
                icon={Accessibility}
                title="Accessibility & Motion Control"
                blurb="Dial in motion, glow and render budget"
              />
            </AccordionTrigger>
            <AccordionContent className="set-content">
              <div className="set-body">
                <Row
                  title="Ambient Intensity"
                  badge={`${settings.ambient}%`}
                  hint="Scales the opacity, speed and glowing background blur of the site layout. 0% is a fully static, flat page; the glow reaches its intended maximum at 60% and holds there — the rest of the slider is headroom, not extra glare."
                >
                  <div className="set-slider-wrap">
                    <Slider
                      className="set-slider"
                      value={[settings.ambient]}
                      min={0}
                      max={100}
                      step={5}
                      aria-label="Ambient intensity"
                      onValueChange={(v) => update({ ambient: v[0] ?? 0 })}
                    />
                    <div className="set-scale">
                      <span>0% · static</span>
                      <span>60% · max glow</span>
                      <span>100%</span>
                    </div>
                  </div>
                </Row>

                <Row
                  title="Cursor-tracking Background"
                  badge={settings.cursorField ? "Following" : "Off"}
                  hint="Stops the background glow field from leaning toward your pointer as it moves. Everything else keeps moving — the drifting blobs, page transitions and lab simulations are untouched."
                >
                  <Switch
                    className="set-switch"
                    checked={settings.cursorField}
                    aria-label="Cursor-tracking background"
                    onCheckedChange={(v) => update({ cursorField: v })}
                  />
                </Row>

                <Row
                  title="Reduce Motion / Motionless Mode"
                  badge={settings.reduceMotion ? "On" : "Off"}
                  hint="Completely disables all continuous loops, bouncing animations, floating particles and interactive 3D orbit animations across the physics, chemistry and biology labs, instantly snapping every element to a clean, fixed state. Dragging and zooming still work for close inspection."
                  note={
                    systemReducedMotion && !settings.reduceMotion
                      ? "Your device is already asking for reduced motion."
                      : undefined
                  }
                >
                  <Switch
                    className="set-switch"
                    checked={settings.reduceMotion}
                    aria-label="Reduce motion / motionless mode"
                    onCheckedChange={(v) => update({ reduceMotion: v })}
                  />
                </Row>

                <Row
                  title="Simulation Framerate Target"
                  hint="Caps the render loop of every 3D simulation so you can trade smoothness for battery life. It applies the moment you pick a value."
                >
                  <Select
                    value={settings.frameTarget}
                    onValueChange={(v) => update({ frameTarget: v as FrameTarget })}
                  >
                    <SelectTrigger className="set-select" aria-label="Simulation framerate target">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="set-select-content">
                      {FRAME_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label} — {o.hint}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Row>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ============ 2. APP THEME & MODES ============ */}
          <AccordionItem id="set-panel-theme" value="theme" className="set-item">
            <AccordionTrigger className="set-trigger">
              <PanelTitle
                icon={SunMoon}
                title="App Theme & Modes"
                blurb="Appearance and reading comfort"
              />
            </AccordionTrigger>
            <AccordionContent className="set-content">
              <div className="set-body">
                <div className="set-block">
                  <div className="set-block__meta">
                    <div className="set-row__title">Appearance</div>
                    <p className="set-row__hint">
                      Pick a fixed theme or let Manthan follow your operating system automatically.
                    </p>
                  </div>
                  <div className="set-theme-grid" role="radiogroup" aria-label="App theme">
                    {THEMES.map((t) => {
                      const Icon = t.icon;
                      const selected = settings.themeMode === t.key;
                      return (
                        <button
                          key={t.key}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => update({ themeMode: t.key })}
                          className={`set-theme${selected ? " set-theme--on" : ""}`}
                        >
                          {selected && (
                            <motion.span
                              layoutId="set-theme-pill"
                              className="set-theme__pill"
                              transition={spring}
                            />
                          )}
                          <span className={`set-theme__preview set-theme__preview--${t.key}`}>
                            <span className="set-theme__bar" />
                            <span className="set-theme__bar set-theme__bar--short" />
                            <span className="set-theme__dot" />
                          </span>
                          <span className="set-theme__label">
                            <Icon className="h-3.5 w-3.5" />
                            {t.label}
                          </span>
                          <span className="set-theme__hint">{t.hint}</span>
                          {selected && <Check className="set-theme__check h-3.5 w-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Row
                  title="Text Comfort"
                  badge={COMFORT[comfortIndex]?.label}
                  hint="Cleanly scales dashboard typography, and switches the whole interface to a spaced, dyslexia-friendly letterform when you need it."
                >
                  <div className="set-slider-wrap">
                    <Slider
                      className="set-slider set-slider--steps"
                      value={[comfortIndex]}
                      min={0}
                      max={COMFORT.length - 1}
                      step={1}
                      aria-label="Text comfort"
                      onValueChange={(v) => {
                        const next = COMFORT[v[0] ?? 1];
                        if (next) update({ textComfort: next.key });
                      }}
                    />
                    <div className="set-steps">
                      {COMFORT.map((c, i) => (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => update({ textComfort: c.key })}
                          className={`set-step${i === comfortIndex ? " set-step--on" : ""}`}
                        >
                          <span className="set-step__label">{c.label}</span>
                          <span className="set-step__scale">{c.scale}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </Row>

                <div className="set-preview" aria-live="polite">
                  <p className="set-preview__label">Live preview</p>
                  <p className="set-preview__sample">
                    The mitochondrion is the powerhouse of the cell — and this paragraph re-renders at
                    your chosen comfort level instantly.
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ============ 3. ACCOUNT SECURITY & PROFILE ============ */}
          <AccordionItem id="set-panel-account" value="account" className="set-item">
            <AccordionTrigger className="set-trigger">
              <PanelTitle
                icon={ShieldCheck}
                title="Account Security & Profile Management"
                blurb="Profile, password, devices and your data"
              />
            </AccordionTrigger>
            <AccordionContent className="set-content">
              <div className="set-body">
                {/* profile */}
                <div className="set-card">
                  <div className="set-card__head">
                    <UserCog className="h-3.5 w-3.5" />
                    Profile details
                  </div>
                  <div className="set-grid-2">
                    <FloatField
                      id="set-display-name"
                      label="Display Name"
                      value={name}
                      onChange={setName}
                      autoComplete="name"
                    />
                    <FloatField
                      id="set-email"
                      label="Email Address"
                      value={email}
                      onChange={setEmail}
                      type="email"
                      autoComplete="email"
                    />
                  </div>
                  <div className="set-actions">
                    <button
                      type="button"
                      className="set-btn set-btn--primary"
                      onClick={onSaveProfile}
                      disabled={!dirty || savingProfile}
                    >
                      {savingProfile ? "Saving…" : "Save profile changes"}
                    </button>
                    <button
                      type="button"
                      className="set-btn set-btn--ghost"
                      onClick={() => {
                        setName(account?.name ?? "");
                        setEmail(account?.email ?? "");
                      }}
                      disabled={savingProfile}
                    >
                      Reset fields
                    </button>
                  </div>
                </div>

                {/* password */}
                <form className="set-card" onSubmit={onChangePassword}>
                  <div className="set-card__head">
                    <Lock className="h-3.5 w-3.5" />
                    Change password
                  </div>
                  <div className="set-grid-3">
                    <FloatField
                      id="set-pw-current"
                      label="Current Password"
                      value={pw.current}
                      onChange={(v) => setPw((p) => ({ ...p, current: v }))}
                      type={showPw ? "text" : "password"}
                      autoComplete="current-password"
                    />
                    <FloatField
                      id="set-pw-next"
                      label="New Password"
                      value={pw.next}
                      onChange={(v) => setPw((p) => ({ ...p, next: v }))}
                      type={showPw ? "text" : "password"}
                      autoComplete="new-password"
                    />
                    <FloatField
                      id="set-pw-confirm"
                      label="Confirm New Password"
                      value={pw.confirm}
                      onChange={(v) => setPw((p) => ({ ...p, confirm: v }))}
                      type={showPw ? "text" : "password"}
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="set-strength">
                    <div className="set-strength__bars">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={`set-strength__bar${
                            pw.next.length > 0 && i < Math.max(1, strength.score)
                              ? ` set-strength__bar--l${Math.max(1, strength.score)}`
                              : ""
                          }`}
                        />
                      ))}
                    </div>
                    <span className="set-strength__label">
                      {pw.next.length === 0 ? "Strength meter" : strength.label}
                    </span>
                    <button
                      type="button"
                      className="set-inline-btn"
                      onClick={() => setShowPw((s) => !s)}
                      aria-pressed={showPw}
                    >
                      {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {showPw ? "Hide" : "Show"} passwords
                    </button>
                  </div>

                  <p className="set-note">
                    <Info className="h-3 w-3" />
                    Manthan signs you in with one-time email codes, so this password locks your
                    profile on this browser.
                  </p>

                  <div className="set-actions">
                    <button type="submit" className="set-btn set-btn--primary">
                      Update password
                    </button>
                  </div>
                </form>

                {/* devices */}
                <div className="set-card">
                  <div className="set-card__head">
                    <Fingerprint className="h-3.5 w-3.5" />
                    Logged in devices
                  </div>
                  <ul className="set-devices">
                    <li className="set-device set-device--current">
                      <span className="set-device__icon">
                        <Laptop className="h-3.5 w-3.5" />
                      </span>
                      <span className="set-device__meta">
                        <span className="set-device__name">This device · {describeDevice()}</span>
                        <span className="set-device__sub">Active now — full lab access</span>
                      </span>
                      <span className="set-device__tag">Current</span>
                    </li>
                    {otherSessions.map((s, i) => (
                      <li key={s.id} className="set-device">
                        <span className="set-device__icon">
                          {i % 2 === 0 ? (
                            <Smartphone className="h-3.5 w-3.5" />
                          ) : (
                            <Monitor className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <span className="set-device__meta">
                          <span className="set-device__name">Signed-in session</span>
                          <span className="set-device__sub">
                            Started {formatWhen(s.createdAt)} · expires {formatWhen(s.expiresAt)}
                          </span>
                        </span>
                        <span className="set-device__tag set-device__tag--other">Session</span>
                      </li>
                    ))}
                    {otherSessions.length === 0 && (
                      <li className="set-device set-device--empty">
                        No other devices are signed in to this account.
                      </li>
                    )}
                  </ul>
                  <div className="set-actions">
                    <button
                      type="button"
                      className="set-btn"
                      onClick={onRevokeOthers}
                      disabled={revoking || otherSessions.length === 0}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {revoking ? "Signing out…" : "Log Out of All Other Devices"}
                    </button>
                  </div>
                </div>

                {/* data */}
                <div className="set-card set-card--danger">
                  <div className="set-card__head">
                    <Download className="h-3.5 w-3.5" />
                    Your data
                  </div>
                  <p className="set-note set-note--plain">
                    Export keeps every preference, lab metric and account detail Manthan holds for
                    you. Deletion is permanent and cannot be undone.
                  </p>
                  <div className="set-actions">
                    <button type="button" className="set-btn set-btn--primary" onClick={onExport}>
                      <Download className="h-3.5 w-3.5" />
                      Export My Lab Progress Data
                    </button>
                    <button
                      type="button"
                      className="set-btn set-btn--danger"
                      onClick={() => setConfirmOpen(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete My Account &amp; Data
                    </button>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ============ 4. TRUST & LEGAL TRANSPARENCY ============ */}
          <AccordionItem id="set-panel-legal" value="legal" className="set-item">
            <AccordionTrigger className="set-trigger">
              <PanelTitle
                icon={Scale}
                title="Trust & Legal Transparency"
                blurb="The full policies, in plain scannable form"
              />
            </AccordionTrigger>
            <AccordionContent className="set-content">
              <div className="set-body">
                {/* The full policies live on dedicated pages — this panel just
                    links to them so nothing has to be scrolled in an accordion. */}
                <div className="set-legal-links">
                  {LEGAL_BOXES.map((box) => (
                    <Link
                      key={box.id}
                      to={LEGAL_ROUTES[box.id] ?? "/terms"}
                      className="set-legal-card"
                    >
                      <span className="set-legal-card__tag">{box.tag}</span>
                      <span className="set-legal-card__title">{box.title}</span>
                      <span className="set-legal-card__meta">
                        {box.clauses.length} clause{box.clauses.length === 1 ? "" : "s"} · opens its own page
                      </span>
                      <ArrowUpRight className="set-legal-card__arrow" />
                    </Link>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* -------- double-confirmation delete modal -------- */}
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) closeDelete();
          else setConfirmOpen(true);
        }}
      >
        <AlertDialogContent className="set-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="set-dialog__title">
              {stage === 1 ? "Delete your account?" : "Final confirmation"}
            </AlertDialogTitle>
            <AlertDialogDescription className="set-dialog__desc">
              {stage === 1
                ? "This permanently erases your profile, every saved preference and all lab progress metrics attached to this account. It cannot be undone."
                : "Type DELETE below to permanently erase your account and every associated metric."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AnimatePresence mode="wait" initial={false}>
            {stage === 2 && (
              <motion.div
                key="confirm-stage"
                initial={{ opacity: 0, y: settings.reduceMotion ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: settings.reduceMotion ? 0 : -8 }}
                transition={spring}
              >
                <input
                  className="set-field__input set-field__input--solo"
                  value={typed}
                  placeholder="Type DELETE"
                  aria-label="Type DELETE to confirm"
                  onChange={(e) => setTyped(e.target.value)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AlertDialogFooter>
            {stage === 1 ? (
              <>
                <AlertDialogCancel className="set-btn set-btn--ghost">Cancel</AlertDialogCancel>
                <button
                  type="button"
                  className="set-btn set-btn--danger-soft"
                  onClick={() => setStage(2)}
                >
                  I understand, continue
                </button>
              </>
            ) : (
              <>
                <button type="button" className="set-btn set-btn--ghost" onClick={() => setStage(1)}>
                  Back
                </button>
                <button
                  type="button"
                  className="set-btn set-btn--danger"
                  disabled={typed.trim() !== "DELETE" || deleting}
                  onClick={onDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deleting ? "Deleting…" : "Delete everything permanently"}
                </button>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
