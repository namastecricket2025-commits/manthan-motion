import { canUse, loadPlan, savePlan, type FeatureKey, type PlanId } from "@/lib/plans";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { PremiumLockModal } from "./PremiumLockModal";
import "./premium.css";

export interface PlanContextValue {
  /** The tier this account is on. Defaults to "free". */
  plan: PlanId;
  isPremium: boolean;
  setPlan: (plan: PlanId) => void;
  /** Plain capability check — never opens anything. */
  can: (feature: FeatureKey) => boolean;
  /**
   * Gate a click: returns true when the plan covers the feature, otherwise
   * opens the frosted lock prompt and returns false. Callers use the boolean
   * to decide whether to proceed.
   */
  requireAccess: (feature: FeatureKey) => boolean;
}

const PlanContext = createContext<PlanContextValue>({
  plan: "free",
  isPremium: false,
  setPlan: () => {},
  can: () => false,
  requireAccess: () => false,
});

/**
 * Owns `userPlan` for the whole app.
 *
 * Every premium surface reads the plan from here — the sidebar gates the Math
 * Lab link, notebook workspaces gate Cram Mode and the Voice Tutor, the Math
 * Lab gates photo solving, and the checkout simulation is the only writer.
 * The lock prompt is rendered once, at this level, so any caller can gate a
 * click with a single `requireAccess` call.
 *
 * Must sit inside the router: the lock prompt offers a jump to /pricing.
 */
export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlanState] = useState<PlanId>(() => loadPlan());
  const [gate, setGate] = useState<FeatureKey | null>(null);

  useEffect(() => {
    savePlan(plan);
  }, [plan]);

  const setPlan = useCallback((next: PlanId) => setPlanState(next), []);

  const can = useCallback((feature: FeatureKey) => canUse(plan, feature), [plan]);

  const requireAccess = useCallback(
    (feature: FeatureKey) => {
      if (canUse(plan, feature)) return true;
      setGate(feature);
      return false;
    },
    [plan],
  );

  const value = useMemo<PlanContextValue>(
    () => ({ plan, isPremium: plan !== "free", setPlan, can, requireAccess }),
    [plan, setPlan, can, requireAccess],
  );

  return (
    <PlanContext.Provider value={value}>
      {children}
      <PremiumLockModal feature={gate} onClose={() => setGate(null)} />
    </PlanContext.Provider>
  );
}

export function usePlan() {
  return useContext(PlanContext);
}

export default PlanProvider;
