import { MovingBorderButton } from "@/components/landing/MovingBorderButton";
import { FEATURE_META, planName, type FeatureKey } from "@/lib/plans";
import { Lock, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { useNavigate } from "react-router";

/**
 * The premium lockout prompt.
 *
 * Opened whenever a free workspace is touched: the whole page is frosted out
 * (blur + saturation on a 40% white wash) while a single glass card explains
 * which tier owns the feature and offers the one useful next step — the plans.
 */
export function PremiumLockModal({
  feature,
  onClose,
}: {
  feature: FeatureKey | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const meta = feature ? FEATURE_META[feature] : null;

  useEffect(() => {
    if (!feature) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [feature, onClose]);

  return (
    <AnimatePresence>
      {meta && (
        <motion.div
          className="lock-veil"
          role="dialog"
          aria-modal="true"
          aria-label={`${meta.label} is a premium workspace`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.26, ease: [0.25, 1, 0.5, 1] }}
          onClick={onClose}
        >
          <motion.div
            className="lock-card"
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, scale: 0.94, y: 22 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 14 }}
            transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.9 }}
          >
            <span className="lock-orb">
              <Lock className="h-5 w-5" />
            </span>

            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-dim">
              Premium workspace
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">
              {meta.label}
            </h2>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-text-dim">
              {meta.blurb}
            </p>

            <div className="mt-5 rounded-2xl border border-[var(--glass-line)] bg-[color-mix(in_srgb,var(--signal)_7%,transparent)] px-4 py-3">
              <p className="flex items-center justify-center gap-2 text-[12px] font-medium text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-[var(--signal)]" />
                Included with {planName(meta.required)}
              </p>
            </div>

            <div className="mt-6 flex flex-col items-center gap-3">
              <MovingBorderButton
                onClick={() => {
                  onClose();
                  navigate("/pricing");
                }}
                className="w-full"
                innerClassName="w-full px-6 py-3 text-sm"
              >
                View plans
              </MovingBorderButton>
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-medium text-text-dim transition-colors hover:text-foreground"
              >
                Not now
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PremiumLockModal;
