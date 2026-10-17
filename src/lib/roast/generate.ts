// The roast generation chain (approved 2026-10-17, docs/superpowers/specs/2026-10-17-spike-decision.md):
// Gemini 3.8 Flash → Gemini 3.1 Flash-Lite → Groq gpt-oss-120b → template. The user always gets a roast.
import type { Summary } from "@/lib/summary";
import { generateRoastWith, type ProviderName } from "./providers";
import type { RoastOutput } from "./schema";
import { generateTemplateRoast } from "./templates";
import { findBannedPhrases, validateRoast } from "./validate";

export type Generator = "gemini" | "gemini-lite" | "groq" | "template";
export type ChainStep = { generator: Exclude<Generator, "template">; provider: ProviderName; model: string; timeoutMs: number };
export type CallFn = (step: ChainStep, summary: Summary, signal: AbortSignal) => Promise<RoastOutput>;

const DEADLINE_MS = 45_000;
const MIN_STEP_MS = 1_000;
const MIN_LINES = 6;

// Timeouts from production data (2026-10-18): Gemini took 13–20 s (one 20 s timeout), Lite and Groq answer in 3–6 s.
export function defaultChain(): ChainStep[] {
  return [
    { generator: "gemini", provider: "gemini", model: process.env.GEMINI_MODEL ?? "gemini-3.8-flash", timeoutMs: 25_000 },
    { generator: "gemini-lite", provider: "gemini", model: process.env.GEMINI_LITE_MODEL ?? "gemini-3.1-flash-lite", timeoutMs: 10_000 },
    { generator: "groq", provider: "groq", model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b", timeoutMs: 10_000 },
  ];
}

const defaultCall: CallFn = (step, summary, signal) => generateRoastWith(step.provider, summary, step.model, signal);

const undash = (s: string) => s.replace(/\s*—\s*/g, ", ");

/** Undashes a line everywhere except inside its quoted evidence (a real title may contain an em dash). */
function undashLine(text: string, evidence: string): string {
  const at = evidence.trim() ? text.toLowerCase().indexOf(evidence.toLowerCase()) : -1;
  if (at < 0) return undash(text);
  return undash(text.slice(0, at)) + text.slice(at, at + evidence.length) + undash(text.slice(at + evidence.length));
}

/**
 * Fixes what can be fixed without another AI call: em dashes become commas, captions with banned
 * phrases are dropped, and bad lines are dropped while more than 6 remain. Returns null if the roast
 * still fails validation (e.g. a banned phrase in the headline).
 */
export function repairRoast(out: RoastOutput, summary: Summary): RoastOutput | null {
  if (validateRoast(out, summary).ok) return out;

  const headline = undash(out.headline);
  const personality = { label: undash(out.personality.label), description: undash(out.personality.description) };
  const captions = Object.fromEntries(
    Object.entries(out.captions).map(([key, value]) => {
      if (value === null) return [key, null];
      const fixed = undash(value);
      return [key, findBannedPhrases(fixed).length ? null : fixed];
    }),
  ) as RoastOutput["captions"];

  let lines = out.lines.map((l) => ({ ...l, text: undashLine(l.text, l.evidence) }));
  const lineIsBad = (i: number) =>
    validateRoast({ ...out, lines: [lines[i]], captions }, summary).problems.some((p) => p.startsWith("line 1:"));
  for (let i = lines.length - 1; i >= 0 && lines.length > MIN_LINES; i--) {
    if (lineIsBad(i)) lines = lines.filter((_, j) => j !== i);
  }

  const repaired = { ...out, headline, personality, lines, captions };
  return validateRoast(repaired, summary).ok ? repaired : null;
}

/** "not in text×2, banned×1": the kinds of validator problems, without the evidence (users' titles) in them. */
export function problemKinds(problems: string[]): string {
  const counts = new Map<string, number>();
  for (const p of problems) {
    const kind = p.match(/(not in text|not in data|too short|banned)/)?.[1] ?? "other";
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return [...counts].map(([kind, n]) => `${kind}×${n}`).join(", ");
}

/** Resolves with the call's result, or rejects when the timeout fires; either way the signal is aborted on timeout. */
function withTimeout(call: CallFn, step: ChainStep, summary: Summary, ms: number): Promise<RoastOutput> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`timed out after ${ms} ms`));
    }, ms);
  });
  return Promise.race([call(step, summary, controller.signal), timeout]).finally(() => clearTimeout(timer));
}

export async function generateRoast(
  summary: Summary,
  opts: { chain?: ChainStep[]; call?: CallFn; deadlineMs?: number } = {},
): Promise<{ roast: RoastOutput; generator: Generator }> {
  if (process.env.ROAST_GENERATOR === "template") return { roast: generateTemplateRoast(summary), generator: "template" };

  const call = opts.call ?? defaultCall;
  const deadline = Date.now() + (opts.deadlineMs ?? DEADLINE_MS);

  for (const step of opts.chain ?? defaultChain()) {
    const remaining = deadline - Date.now();
    if (remaining < Math.min(MIN_STEP_MS, step.timeoutMs)) break;
    try {
      const out = await withTimeout(call, step, summary, Math.min(step.timeoutMs, remaining));
      const repaired = repairRoast(out, summary);
      if (repaired) return { roast: repaired, generator: step.generator };
      const kinds = problemKinds(validateRoast(out, summary).problems);
      console.warn(`[roast] ${step.generator} failed: output did not pass validation (${out.lines.length} lines; ${kinds})`);
    } catch (err) {
      console.warn(`[roast] ${step.generator} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { roast: generateTemplateRoast(summary), generator: "template" };
}
