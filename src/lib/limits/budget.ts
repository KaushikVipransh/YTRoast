// Per-provider daily call budgets and quota cooldowns, so a provider we know is exhausted is skipped
// instantly instead of costing the user a timeout. Budgets are set just under each free tier.
import type { ChainStep } from "@/lib/roast/generate";
import { failOpen, type Store } from "./limiter";

type AiGenerator = ChainStep["generator"];
export type Budgets = Record<AiGenerator, number>;

export type ProviderGate = {
  canUse(g: AiGenerator): Promise<boolean>;
  recordCall(g: AiGenerator): Promise<void>;
  recordQuotaError(g: AiGenerator): Promise<void>;
};

const COOLDOWN_SEC = 600;
const TWO_DAYS_SEC = 172_800;

/** Errors that mean "this provider is out of capacity for now", across Gemini and Groq wording. */
export const QUOTA_ERROR = /quota|rate.?limit|\b429\b|RESOURCE_EXHAUSTED|high demand|overloaded/i;

const envNumber = (key: string, fallback: number) => {
  const n = Number(process.env[key]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export function defaultBudgets(): Budgets {
  return {
    gemini: envNumber("GEMINI_DAILY_BUDGET", 15),
    "gemini-lite": envNumber("GEMINI_LITE_DAILY_BUDGET", 400),
    groq: envNumber("GROQ_DAILY_BUDGET", 40),
  };
}

/** Free-tier quotas reset on the provider's day; UTC is the common denominator. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function makeProviderGate(store: Store, budgets: Budgets, now: () => Date = () => new Date()): ProviderGate {
  const dayKey = (g: AiGenerator) => `cw:budget:${g}:${utcDay(now())}`;
  const coolKey = (g: AiGenerator) => `cw:cool:${g}`;
  return {
    async canUse(g) {
      const [used, cooling] = await Promise.all([
        failOpen(store.get(dayKey(g)), 0, `budget ${g}`),
        failOpen(store.get(coolKey(g)), 0, `cooldown ${g}`),
      ]);
      return used < budgets[g] && cooling === 0;
    },
    async recordCall(g) {
      await failOpen(store.incr(dayKey(g), TWO_DAYS_SEC), 0, `record ${g}`);
    },
    async recordQuotaError(g) {
      await failOpen(store.set(coolKey(g), 1, COOLDOWN_SEC), undefined, `cooldown ${g}`);
    },
  };
}

/** Lets every provider through: used when a custom call function is injected (tests, scripts). */
export const openGate: ProviderGate = {
  canUse: async () => true,
  recordCall: async () => {},
  recordQuotaError: async () => {},
};
