import {
  durationSavings,
  durationTotal,
  formatINR,
  type DurationOption,
  type PlanTier,
} from "@/lib/plans";
import { Check, CreditCard, Landmark, Loader2, Lock, Smartphone, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { usePlan } from "./PlanProvider";

type Method = "upi" | "card" | "netbanking";

const METHODS: { id: Method; label: string; icon: typeof Lock }[] = [
  { id: "upi", label: "UPI", icon: Smartphone },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "netbanking", label: "NetBanking", icon: Landmark },
];

const BANKS = [
  "State Bank of India",
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
];

/** Deterministic QR stand-in — a structural mock, never a real payload. */
const QR_CELLS = Array.from({ length: 64 }, (_, i) => (i * 37) % 11 < 5);

export function CheckoutModal({
  tier,
  duration,
  onClose,
}: {
  tier: PlanTier | null;
  duration: DurationOption;
  onClose: () => void;
}) {
  const { setPlan } = usePlan();
  const [method, setMethod] = useState<Method>("upi");
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvv: "" });
  const [bank, setBank] = useState(BANKS[0]);
  const [paying, setPaying] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!tier) setPaying(false);
  }, [tier]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !paying) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, paying]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const total = tier ? durationTotal(tier, duration) : 0;
  const savings = tier ? durationSavings(tier, duration) : 0;

  function simulate() {
    if (!tier || paying) return;
    setPaying(true);
    timer.current = window.setTimeout(() => {
      setPlan(tier.id);
      toast.success(`${tier.name} activated`, {
        description:
          "Sandbox payment accepted. The Math Lab and every premium workspace are unlocked on this account.",
        duration: 6000,
      });
      onClose();
    }, 1400);
  }

  function formatCard(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  }

  return (
    <AnimatePresence>
      {tier && (
        <motion.div
          className="checkout-veil"
          role="dialog"
          aria-modal="true"
          aria-label="Manthan Secure Checkout"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.25, 1, 0.5, 1] }}
          onClick={() => !paying && onClose()}
        >
          <motion.div
            className="checkout-card"
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, scale: 0.93, y: 26 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 18 }}
            transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.9 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="lock-orb h-10 w-10">
                  <Lock className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="font-display text-[15px] font-bold tracking-tight">
                    Manthan Secure Checkout
                  </h2>
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-dim">
                    Sandbox Environment
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close checkout"
                onClick={() => !paying && onClose()}
                className="rounded-full p-1.5 text-text-dim transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Order summary */}
            <div className="mt-6 rounded-2xl border border-[var(--glass-line)] bg-[color-mix(in_srgb,var(--signal)_6%,transparent)] p-4">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="font-display text-sm font-bold tracking-tight">
                    {tier.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-dim">
                    {tier.flexible
                      ? `${duration.label} term`
                      : `Single pass — ${tier.unit}`}
                    {" · "}
                    {tier.allowance}
                  </p>
                </div>
                <p className="font-display text-xl font-bold tabular-nums tracking-tight">
                  {formatINR(total)}
                </p>
              </div>
              {savings > 0 && (
                <p className="mt-2 text-[11px] font-medium text-[var(--signal)]">
                  You save {formatINR(savings)} against the monthly rate.
                </p>
              )}
            </div>

            {/* Payment method */}
            <div className="mt-5 flex gap-2">
              {METHODS.map((item) => {
                const Icon = item.icon;
                const active = method === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMethod(item.id)}
                    className={"checkout-method" + (active ? " is-active" : "")}
                  >
                    {active && (
                      <motion.span
                        layoutId="checkout-method-pill"
                        className="checkout-method__pill"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 min-h-[178px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={method}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.26, ease: [0.25, 1, 0.5, 1] }}
                >
                  {method === "upi" && (
                    <div className="flex items-center gap-5 rounded-2xl border border-[var(--glass-line)] p-4">
                      <div className="checkout-qr" aria-hidden="true">
                        {QR_CELLS.map((on, i) => (
                          <span key={i} className={on ? "" : "is-off"} />
                        ))}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold">
                          Scan, or enter a UPI ID
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-text-dim">
                          A collect request is sent to your UPI app. Sandbox —
                          nothing is debited.
                        </p>
                        <input
                          className="checkout-field mt-3"
                          placeholder="student@upi"
                          defaultValue=""
                          disabled={paying}
                        />
                      </div>
                    </div>
                  )}

                  {method === "card" && (
                    <div className="grid grid-cols-2 gap-3 rounded-2xl border border-[var(--glass-line)] p-4">
                      <input
                        className="checkout-field col-span-2"
                        placeholder="Card number"
                        inputMode="numeric"
                        value={card.number}
                        disabled={paying}
                        onChange={(event) =>
                          setCard((c) => ({
                            ...c,
                            number: formatCard(event.target.value),
                          }))
                        }
                      />
                      <input
                        className="checkout-field col-span-2"
                        placeholder="Name on card"
                        value={card.name}
                        disabled={paying}
                        onChange={(event) =>
                          setCard((c) => ({ ...c, name: event.target.value }))
                        }
                      />
                      <input
                        className="checkout-field"
                        placeholder="MM / YY"
                        value={card.expiry}
                        disabled={paying}
                        onChange={(event) =>
                          setCard((c) => ({ ...c, expiry: event.target.value }))
                        }
                      />
                      <input
                        className="checkout-field"
                        placeholder="CVV"
                        inputMode="numeric"
                        maxLength={4}
                        value={card.cvv}
                        disabled={paying}
                        onChange={(event) =>
                          setCard((c) => ({
                            ...c,
                            cvv: event.target.value.replace(/\D/g, ""),
                          }))
                        }
                      />
                    </div>
                  )}

                  {method === "netbanking" && (
                    <div className="flex flex-col gap-2 rounded-2xl border border-[var(--glass-line)] p-4">
                      {BANKS.map((name) => (
                        <button
                          key={name}
                          type="button"
                          disabled={paying}
                          onClick={() => setBank(name)}
                          className={
                            "checkout-bank" + (bank === name ? " is-selected" : "")
                          }
                        >
                          <span>{name}</span>
                          {bank === name && (
                            <Check className="h-3.5 w-3.5 text-[var(--signal)]" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={simulate}
              disabled={paying}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 font-display text-sm font-semibold tracking-wide text-[var(--primary-foreground)] transition-transform duration-200 active:scale-[0.98] disabled:opacity-80"
              style={{
                /* The filled-action tone, with `--primary-foreground` as the
                   label — the pair flips with the theme (near-black on bright
                   amber in light, near-black on white in dark), so no literal
                   label colour can go stale here. The deeper stop is a mix
                   toward the ink amber rather than `--signal-2`: that token is
                   the DEEP caramel in the light theme, which would put the
                   near-black label on a ~1.9:1 fill. */
                background:
                  "linear-gradient(180deg, var(--signal-strong) 0%, color-mix(in srgb, var(--signal-strong) 86%, var(--signal)) 100%)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.22), 0 18px 50px -24px rgba(0,0,0,0.6)",
              }}
            >
              {paying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Confirming payment…
                </>
              ) : (
                "Simulate Successful Test Payment"
              )}
            </button>

            <p className="mt-3 text-center text-[11px] leading-relaxed text-text-dim">
              Sandbox environment — this screen never contacts a payment
              network and no money moves.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CheckoutModal;
