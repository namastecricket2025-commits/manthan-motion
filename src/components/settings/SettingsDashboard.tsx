import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocation, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
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
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  SunMoon,
  Trash2,
  UserCog,
  Waves,
} from "lucide-react";

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
import { supabase } from "@/lib/supabase";
import type { FrameTarget, TextComfort, ThemeMode } from "@/lib/app-settings";
import { useSettings } from "./SettingsProvider";

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */

const THEMES: { key: ThemeMode; label: string; hint: string; icon: typeof Sun }[] = [
  { key: "light", label: "Light", hint: "Warm paper ink", icon: Sun },
  { key: "dark", label: "Dark", hint: "The lab default", icon: Moon },
  { key: "system", label: "System", hint: "Follows your device", icon: Monitor },
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
const PANEL_KEYS = ["experience", "appearance", "account", "data"] as const;
type PanelKey = (typeof PANEL_KEYS)[number];

/** Which panel a location hash should reveal. */
function panelsFromHash(hash: string): PanelKey[] {
  const key = hash.replace(/^#/, "").toLowerCase();
  const alias: Record<string, PanelKey> = {
    motion: "experience",
    accessibility: "experience",
    theme: "appearance",
    security: "account",
    privacy: "data",
  };
  const hit = PANEL_KEYS.find((p) => p === key) ?? alias[key];
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

/** One line in a grouped settings list — label on the left, control right. */
function ListRow({
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
    <div className="set-lrow">
      <div className="set-lrow__text">
        <div className="set-lrow__title">
          <span>{title}</span>
          {badge ? <span className="set-badge">{badge}</span> : null}
        </div>
        <p className="set-lrow__hint">{hint}</p>
        {note ? <p className="set-lrow__note">{note}</p> : null}
      </div>
      <div className="set-lrow__ctl">{children}</div>
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
  const location = useLocation();

  const account = useQuery(api.settings.myAccount);
  const saveProfileMutation = useMutation(api.settings.updateProfile);
  const deleteAccountMutation = useMutation(api.settings.deleteAccount);

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
      // Keep the Supabase account metadata in step so the greeting elsewhere
      // and the next sign-in use the same name.
      await supabase.auth.updateUser({ data: { name: name.trim() } });
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

  const onChangePassword = async (e: React.FormEvent) => {
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
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    if (error) {
      toast.error("Could not update password", { description: error.message });
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
      // Supabase revokes every other refresh token for this account; the
      // browser cannot list them, but it can end them.
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw new Error(error.message);
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
  const [openPanels, setOpenPanels] = useState<string[]>([
    "experience",
    "appearance",
    ...panelsFromHash(typeof window === "undefined" ? "" : window.location.hash),
  ]);

  /**
   * Deep link: a hash like `#account` opens that panel and brings it into view.
   * Runs for both a fresh navigation and an in-page hash change.
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
        <header className="set-hero">
          <div className="set-hero__meta">
            <span className="set-kicker">
              <Sparkles className="h-3 w-3" />
              Preferences
            </span>
            <h2 id="settings-heading" className="set-hero__title">
              Settings
            </h2>
            <p className="set-hero__sub">
              Motion, appearance, security and your data. Every change applies the moment you make
              it, and is remembered on this device.
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
          {/* ============ 1. MOTION ============ */}
          <AccordionItem id="set-panel-experience" value="experience" className="set-item">
            <AccordionTrigger className="set-trigger">
              <PanelTitle
                icon={Waves}
                title="Motion"
                blurb="How much the interface moves and animates"
              />
            </AccordionTrigger>
            <AccordionContent className="set-content">
              <div className="set-group">
                <ListRow
                  title="Motionless mode"
                  badge={settings.reduceMotion ? "On" : "Off"}
                  hint="Stops every continuous loop, floating particle and orbiting 3D model, holding each instrument in a clean fixed state. Dragging and zooming keep working for close inspection."
                  note={
                    systemReducedMotion && !settings.reduceMotion
                      ? "Your device is already asking for reduced motion."
                      : undefined
                  }
                >
                  <Switch
                    className="set-switch"
                    checked={settings.reduceMotion}
                    aria-label="Motionless mode"
                    onCheckedChange={(v) => update({ reduceMotion: v })}
                  />
                </ListRow>

                <ListRow
                  title="Simulation frame rate"
                  badge={FRAME_OPTIONS.find((o) => o.value === settings.frameTarget)?.label}
                  hint="Caps the render loop of every 3D simulation, trading smoothness for battery life. It takes effect the moment you choose."
                >
                  <Select
                    value={settings.frameTarget}
                    onValueChange={(v) => update({ frameTarget: v as FrameTarget })}
                  >
                    <SelectTrigger className="set-select" aria-label="Simulation frame rate">
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
                </ListRow>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ============ 2. APPEARANCE & READING ============ */}
          <AccordionItem id="set-panel-appearance" value="appearance" className="set-item">
            <AccordionTrigger className="set-trigger">
              <PanelTitle
                icon={SunMoon}
                title="Appearance & Reading"
                blurb="Theme and text comfort"
              />
            </AccordionTrigger>
            <AccordionContent className="set-content">
              <div className="set-group">
                <div className="set-lrow set-lrow--stack">
                  <div className="set-lrow__text">
                    <div className="set-lrow__title">
                      <span>Appearance</span>
                      <span className="set-badge">{THEMES.find((t) => t.key === settings.themeMode)?.label}</span>
                    </div>
                    <p className="set-lrow__hint">
                      Pick a fixed theme, or let Manthan follow your device automatically.
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

                <ListRow
                  title="Text comfort"
                  badge={COMFORT[comfortIndex]?.label}
                  hint="Scales dashboard typography, and switches the whole interface to a spaced, dyslexia-friendly letterform when you need it."
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
                </ListRow>

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

          {/* ============ 3. ACCOUNT & SECURITY ============ */}
          <AccordionItem id="set-panel-account" value="account" className="set-item">
            <AccordionTrigger className="set-trigger">
              <PanelTitle
                icon={ShieldCheck}
                title="Account & Security"
                blurb="Profile, password and signed-in devices"
              />
            </AccordionTrigger>
            <AccordionContent className="set-content">
              <div className="set-group">
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
                    Signed-in devices
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
                        Other devices aren&apos;t listed here, but signing out ends every session
                        except this one.
                      </li>
                    )}
                  </ul>
                  <div className="set-actions">
                    <button
                      type="button"
                      className="set-btn"
                      onClick={onRevokeOthers}
                      disabled={revoking}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {revoking ? "Signing out…" : "Sign out of all other devices"}
                    </button>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ============ 4. YOUR DATA ============ */}
          <AccordionItem id="set-panel-data" value="data" className="set-item">
            <AccordionTrigger className="set-trigger">
              <PanelTitle
                icon={Download}
                title="Your Data"
                blurb="Take a copy, or erase everything permanently"
              />
            </AccordionTrigger>
            <AccordionContent className="set-content">
              <div className="set-group">
                <div className="set-card set-card--danger">
                  <p className="set-note set-note--plain">
                    <Info className="h-3 w-3" />
                    Export keeps every preference, lab metric and account detail Manthan holds for
                    you. Deletion is permanent and cannot be undone.
                  </p>
                  <div className="set-actions">
                    <button type="button" className="set-btn set-btn--primary" onClick={onExport}>
                      <Download className="h-3.5 w-3.5" />
                      Export my lab progress
                    </button>
                    <button
                      type="button"
                      className="set-btn set-btn--danger"
                      onClick={() => setConfirmOpen(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete account &amp; data
                    </button>
                  </div>
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
