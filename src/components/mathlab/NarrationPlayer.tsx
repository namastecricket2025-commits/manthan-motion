import { NARRATION_RATES, type NarrationState } from "@/components/mathlab/useNarration";
import { Pause, Play, X } from "lucide-react";

/**
 * The audio player that replaces the two "Listen" buttons.
 *
 * It is only on screen while something is being read, and it always offers the
 * same three controls: play/pause, stop, and speed. The label names the step
 * currently being spoken so the bar and the highlighted step agree.
 */
export function NarrationPlayer({
  state,
  label,
  rate,
  onToggle,
  onStop,
  onRate,
}: {
  state: NarrationState;
  label: string;
  rate: number;
  onToggle: () => void;
  onStop: () => void;
  onRate: (rate: number) => void;
}) {
  return (
    <div className="mathlab-player" role="region" aria-label="Read-aloud player">
      <button
        type="button"
        className="mathlab-player__play"
        onClick={onToggle}
        aria-label={state === "paused" ? "Resume reading" : "Pause reading"}
      >
        {state === "paused" ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
      </button>
      <span className="mathlab-player__label">
        <span className="mathlab-player__dot" aria-hidden />
        {state === "paused" ? "Paused" : "Reading aloud"}
        {label ? <span className="mathlab-player__where"> · {label}</span> : null}
      </span>
      <div className="mathlab-player__rates" role="group" aria-label="Reading speed">
        {NARRATION_RATES.map((option) => (
          <button
            key={option}
            type="button"
            data-active={rate === option}
            aria-pressed={rate === option}
            onClick={() => onRate(option)}
          >
            {option}x
          </button>
        ))}
      </div>
      <button type="button" className="mathlab-player__stop" onClick={onStop} aria-label="Stop reading">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default NarrationPlayer;
