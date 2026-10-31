import { Glasses } from "lucide-react";
import { useSettings } from "@/components/settings/SettingsProvider";

/**
 * Eye comfort, one tap away.
 *
 * The preference itself lives in the settings store (and in Settings →
 * Appearance), but a reading mode buried three clicks deep is a reading mode
 * nobody turns on. This sits beside the theme toggle in every header and
 * writes the same `eyeComfort` flag, so the whole display — tokens, charts and
 * the 3D canvases — re-lights on the same paint. It is a warm reading mode,
 * not a grey filter: the white point drops (warm paper in light, warm charcoal
 * in dark), the theme stays light or dark as chosen, and stains and data
 * colours keep their meaning.
 */
export function ComfortToggle({ className }: { className?: string }) {
  const { settings, update } = useSettings();
  const on = settings.eyeComfort;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? "Turn off eye comfort" : "Turn on eye comfort"}
      title={on ? "Eye comfort is on — warm display" : "Eye comfort — warm display"}
      onClick={() => update({ eyeComfort: !on })}
      className={
        "glass-chip btn-ghost inline-flex h-10 w-10 items-center justify-center transition-colors duration-200 " +
        (on ? "text-[var(--signal)]" : "text-text-dim hover:text-[var(--signal)] ") +
        (className ?? "")
      }
    >
      <Glasses className="h-4 w-4" />
    </button>
  );
}

export default ComfortToggle;
