/**
 * Manthan's subscription model.
 *
 * One place owns every number a student can see on the Plans page, and the
 * capability matrix that decides which workspaces open without a prompt.
 * Nothing here talks to a payment provider — the checkout is an explicit
 * sandbox simulation — but the arithmetic (term discounts, totals, savings)
 * is the real thing.
 */

export type PlanId = "free" | "sprint" | "eduvantage" | "prime";

export type DurationId = "1m" | "6m" | "12m";

/** Every workspace a plan can unlock. */
export type FeatureKey =
  | "cramMode"
  | "voiceTutor"
  | "canvasSolver"
  | "mathLabBasic"
  | "mathLabFull";

export interface DurationOption {
  id: DurationId;
  label: string;
  months: number;
  /** 0.1 = ten percent off the straight monthly total. */
  discount: number;
}

export const DURATIONS: DurationOption[] = [
  { id: "1m", label: "1 Month", months: 1, discount: 0 },
  { id: "6m", label: "6 Months (10% Off)", months: 6, discount: 0.1 },
  { id: "12m", label: "12 Months (20% Off)", months: 12, discount: 0.2 },
];

export const DEFAULT_DURATION: DurationId = "1m";

export function getDuration(id: DurationId): DurationOption {
  return DURATIONS.find((option) => option.id === id) ?? DURATIONS[0];
}

export interface PlanTier {
  id: PlanId;
  name: string;
  summary: string;
  /** Rupees per month (or per pass, for the Sprint Pass). */
  price: number;
  /** What the price buys. */
  unit: string;
  allowance: string;
  features: string[];
  featured: boolean;
  /** EduVantage and Manthan Prime offer the 1 / 6 / 12 month schemes. */
  flexible: boolean;
}

export const PLAN_TIERS: PlanTier[] = [
  {
    id: "sprint",
    name: "Sprint Pass",
    summary: "Built for quick revision cycles.",
    price: 49,
    unit: "7 days",
    allowance: "60,000 tokens",
    features: [
      "Cram Mode textbook analyzer",
      "5 custom mock exams",
      "Full STEM Lab dashboard",
    ],
    featured: false,
    flexible: false,
  },
  {
    id: "eduvantage",
    name: "EduVantage",
    summary: "Built for daily assignments.",
    price: 199,
    unit: "month",
    allowance: "250,000 monthly tokens",
    features: [
      "Photo question solver in Math Lab",
      "Math Lab basic graphs",
      "Automated lab reports",
      "250,000 monthly tokens",
    ],
    featured: true,
    flexible: true,
  },
  {
    id: "prime",
    name: "Manthan Prime",
    summary: "The comprehensive elite tier.",
    price: 349,
    unit: "month",
    allowance: "500,000 monthly tokens",
    features: [
      "Full interactive Math Lab suite",
      "24/7 personal AI Voice Tutor",
      "Deep AI Mistake Analytics dashboard",
      "500,000 premium monthly tokens",
      "Everything in EduVantage",
    ],
    featured: false,
    flexible: true,
  },
];

export function getTier(id: PlanId): PlanTier | null {
  return PLAN_TIERS.find((tier) => tier.id === id) ?? null;
}

/**
 * The generation allowance each plan buys, in tokens.
 *
 * One map owns the number for the pricing page, the dashboard meter and the
 * server that enforces it, so the card a student reads is the limit the
 * engine actually applies. The paid tiers meter monthly — a month is the unit
 * they are sold in (the Sprint Pass's 60k budget simply outlives its 7 days
 * in a monthly bucket) — while the free plan meters daily, which keeps a
 * fresh account's spend visible and bounded from day one.
 */
export const PLAN_ALLOWANCES: Record<PlanId, number> = {
  free: 60_000,
  sprint: 60_000,
  eduvantage: 250_000,
  prime: 500_000,
};

/** Whether a plan's allowance resets each day (free) or each UTC month. */
export function allowanceWindow(plan: PlanId): "day" | "month" {
  return plan === "free" ? "day" : "month";
}

/** The allowance and its window together — what the meter and engine read. */
export function planAllowance(plan: PlanId) {
  return {
    limit: PLAN_ALLOWANCES[plan],
    window: allowanceWindow(plan),
  };
}

export function planName(id: PlanId): string {
  if (id === "free") return "Free";
  return getTier(id)?.name ?? "Free";
}

/** What each plan opens. The free plan keeps the notebook workspace. */
export const PLAN_CAPABILITIES: Record<PlanId, FeatureKey[]> = {
  free: [],
  sprint: ["cramMode"],
  eduvantage: ["canvasSolver", "mathLabBasic"],
  prime: ["cramMode", "voiceTutor", "canvasSolver", "mathLabBasic", "mathLabFull"],
};

export interface FeatureMeta {
  label: string;
  required: PlanId;
  blurb: string;
}

export const FEATURE_META: Record<FeatureKey, FeatureMeta> = {
  cramMode: {
    label: "Cram Mode",
    required: "sprint",
    blurb:
      "Compresses a whole textbook into ranked, exam-ready notes measured against the syllabus.",
  },
  voiceTutor: {
    label: "Voice Tutor",
    required: "prime",
    blurb:
      "A spoken tutor that walks a problem through with you and answers out loud.",
  },
  canvasSolver: {
    label: "Photo question solver",
    required: "eduvantage",
    blurb:
      "Photograph a question sheet or hand-written working and get its inputs, formulas and step-by-step solution.",
  },
  mathLabBasic: {
    label: "Math Lab graphs",
    required: "eduvantage",
    blurb: "Live graphing and step-by-step solutions for Class 8 and Class 9 chapters.",
  },
  mathLabFull: {
    label: "The full Math Lab suite",
    required: "prime",
    blurb: "Conic sections and calculus derivative tangents for Class 10 and Class 11.",
  },
};

export function canUse(plan: PlanId, feature: FeatureKey): boolean {
  return PLAN_CAPABILITIES[plan].includes(feature);
}

/* ------------------------------------------------------------------ */
/* Fair-use caps                                                       */
/* ------------------------------------------------------------------ */

/**
 * The per-account ceilings each plan applies, in the unit the feature is
 * actually used in.
 *
 * Tokens are the only cap the engine already meters (see `usage.ts`); these
 * counters are the product's fair-use policy, stated once here so the pricing
 * page, the lock prompt and any server-side check read the same number. A
 * number is either a count per window (`Infinity` = no cap) or `0` = the
 * feature is not on this plan at all.
 */
export interface PlanCaps {
  /** Study kits generated from sources, per allowance window. */
  studyKits: number;
  /** Custom mock exam papers per allowance window. */
  mockExams: number;
  /** Notebooks an account can keep. */
  notebooks: number;
  /** Sources attached to one notebook. */
  sourcesPerNotebook: number;
  /** Voice-tutor minutes a day (Prime only). */
  voiceMinutesPerDay: number;
}

export const PLAN_CAPS: Record<PlanId, PlanCaps> = {
  free: {
    studyKits: 5,
    mockExams: 1,
    notebooks: 3,
    sourcesPerNotebook: 6,
    voiceMinutesPerDay: 0,
  },
  sprint: {
    studyKits: 25,
    mockExams: 5,
    notebooks: 5,
    sourcesPerNotebook: 10,
    voiceMinutesPerDay: 0,
  },
  eduvantage: {
    studyKits: 40,
    mockExams: 15,
    notebooks: 10,
    sourcesPerNotebook: 25,
    voiceMinutesPerDay: 0,
  },
  prime: {
    studyKits: Infinity,
    mockExams: Infinity,
    notebooks: Infinity,
    sourcesPerNotebook: Infinity,
    voiceMinutesPerDay: 60,
  },
};

/** "Unlimited" for an uncapped counter, otherwise the number as words. */
export function capLabel(value: number): string {
  return value === Infinity ? "Unlimited" : String(value);
}

/* ------------------------------------------------------------------ */
/* The comparison table                                               */
/* ------------------------------------------------------------------ */

export interface PlanRow {
  label: string;
  /** One short line under the label — only where the row needs it. */
  detail?: string;
  /** What each plan gets. "—" means the plan does not include it. */
  values: Record<PlanId, string>;
}

export interface PlanRowGroup {
  title: string;
  rows: PlanRow[];
}

const ALL_PLANS = (value: string): Record<PlanId, string> => ({
  free: value,
  sprint: value,
  eduvantage: value,
  prime: value,
});

/**
 * Every difference between the plans, in one table.
 *
 * The rows are grouped by the workspace they belong to, because that is how a
 * student decides: "do I need the Math Lab?" comes before "how many tokens do
 * I get?". Allowance sizes are read from the same map the engine enforces, so
 * a price change can never leave the table quoting an old number.
 */
export const PLAN_MATRIX: PlanRowGroup[] = [
  {
    title: "Allowance",
    rows: [
      {
        label: "AI allowance",
        detail: "Tokens read from your sources and written back as material.",
        values: {
          free: "60,000 a day",
          sprint: "60,000 in the pass",
          eduvantage: "250,000 a month",
          prime: "500,000 a month",
        },
      },
      {
        label: "Resets",
        values: {
          free: "Every day",
          sprint: "Monthly bucket",
          eduvantage: "Every month",
          prime: "Every month",
        },
      },
      {
        label: "Study kits",
        detail: "One kit is a summary, flashcards, a quiz, a mind map and slides.",
        values: {
          free: "5 a day",
          sprint: "25 in the pass",
          eduvantage: "40 a month",
          prime: "Unlimited",
        },
      },
      {
        label: "Notebooks",
        values: {
          free: "3",
          sprint: "5",
          eduvantage: "10",
          prime: "Unlimited",
        },
      },
      {
        label: "Sources in a notebook",
        values: {
          free: "6",
          sprint: "10",
          eduvantage: "25",
          prime: "Unlimited",
        },
      },
      {
        label: "Custom mock exams",
        values: {
          free: "1 a week",
          sprint: "5 in the pass",
          eduvantage: "15 a month",
          prime: "Unlimited",
        },
      },
    ],
  },
  {
    title: "Notebook studio",
    rows: [
      { label: "Summaries", values: ALL_PLANS("Included") },
      { label: "Flashcards and quizzes", values: ALL_PLANS("Included") },
      { label: "Mind maps and slides", values: ALL_PLANS("Included") },
      {
        label: "Board papers, 2019–2025",
        detail: "Real board questions, labelled by year, inside generated sets.",
        values: ALL_PLANS("Included"),
      },
      { label: "AI notebook chat", values: ALL_PLANS("Included") },
      { label: "Audio overviews", values: ALL_PLANS("Included") },
      { label: "Hindi one-shot lectures", values: ALL_PLANS("Included") },
      { label: "Export and print", values: ALL_PLANS("Included") },
      {
        label: "Cram Mode textbook analyzer",
        detail: "Ranks a whole textbook against the syllabus before you revise.",
        values: {
          free: "—",
          sprint: "Included",
          eduvantage: "Included",
          prime: "Included",
        },
      },
    ],
  },
  {
    title: "Math Lab",
    rows: [
      {
        label: "Formula sheet, Classes 8–12",
        values: {
          free: "—",
          sprint: "—",
          eduvantage: "Included",
          prime: "Included",
        },
      },
      {
        label: "Step-by-step solver",
        values: {
          free: "—",
          sprint: "—",
          eduvantage: "Included",
          prime: "Included",
        },
      },
      {
        label: "Graphing calculator",
        values: {
          free: "—",
          sprint: "—",
          eduvantage: "Basic graphs",
          prime: "Full suite",
        },
      },
      {
        label: "Photo question solver",
        values: {
          free: "—",
          sprint: "—",
          eduvantage: "Included",
          prime: "Included",
        },
      },
      {
        label: "Conics, calculus and tangent tools",
        values: {
          free: "—",
          sprint: "—",
          eduvantage: "—",
          prime: "Included",
        },
      },
    ],
  },
  {
    title: "STEM Lab",
    rows: [
      {
        label: "Physics, chemistry and biology sims",
        values: ALL_PLANS("Included"),
      },
      {
        label: "3D organ models and label drills",
        values: ALL_PLANS("Included"),
      },
      {
        label: "Lab dashboard and reports",
        values: {
          free: "—",
          sprint: "Included",
          eduvantage: "Included",
          prime: "Included",
        },
      },
    ],
  },
  {
    title: "Voice and support",
    rows: [
      {
        label: "Personal AI voice tutor",
        values: {
          free: "—",
          sprint: "—",
          eduvantage: "—",
          prime: "60 min a day",
        },
      },
      {
        label: "Mistake analytics",
        values: {
          free: "Basic",
          sprint: "Basic",
          eduvantage: "Basic",
          prime: "Deep dashboard",
        },
      },
      { label: "Answers within the day", values: ALL_PLANS("Included") },
      {
        label: "Priority support",
        values: {
          free: "—",
          sprint: "—",
          eduvantage: "—",
          prime: "Included",
        },
      },
    ],
  },
];

/** The free plan, for the card that sits beside the three paid ones. */
export const FREE_PLAN = {
  id: "free" as const,
  name: "Free",
  summary: "The whole notebook studio, kept open.",
  price: 0,
  unit: "forever",
  allowance: "60,000 tokens a day",
  features: [
    "5 study kits a day, every output format",
    "3 notebooks · 6 sources each",
    "Board papers from 2019 to 2025",
    "AI notebook chat, audio overviews and Hindi lectures",
    "The full STEM Lab — every sim and 3D model",
  ],
};


/** Total charged for a tier over a chosen term, discount already applied. */
export function durationTotal(tier: PlanTier, duration: DurationOption): number {
  return Math.round(tier.price * duration.months * (1 - duration.discount));
}

/** Rupees saved against paying the monthly rate for the same term. */
export function durationSavings(tier: PlanTier, duration: DurationOption): number {
  return Math.round(tier.price * duration.months) - durationTotal(tier, duration);
}

export function formatINR(value: number): string {
  return `\u20B9${value.toLocaleString("en-IN")}`;
}

const PLAN_STORE_KEY = "manthan-plan";

export function loadPlan(): PlanId {
  if (typeof window === "undefined") return "free";
  try {
    const raw = window.localStorage.getItem(PLAN_STORE_KEY);
    if (raw === "sprint" || raw === "eduvantage" || raw === "prime") return raw;
    return "free";
  } catch {
    return "free";
  }
}

export function savePlan(plan: PlanId): void {
  try {
    window.localStorage.setItem(PLAN_STORE_KEY, plan);
  } catch {
    /* private mode */
  }
}

/** Token allowance printed on a plan, in plain words. */
export const FREE_ALLOWANCE = "60,000 tokens per day";
