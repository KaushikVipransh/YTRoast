import type { Summary } from "@/lib/summary";
import type { RoastOutput } from "./schema";

/** Phrases that make a roast read like AI (PRD §7). Matched case-insensitively. */
export const BANNED_PHRASES: readonly string[] = [
  "ah,",
  "let's dive in",
  "it seems like",
  "not only",
  "a testament to",
  "journey",
  "delve",
  "tapestry",
  "whether you're",
  "but hey",
  "at least",
  "—",
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Word phrases must not match inside other words ("yeah," is not "ah,"); the em dash matches anywhere.
const BANNED_PATTERNS = BANNED_PHRASES.map((phrase) =>
  /[a-z]/.test(phrase) ? new RegExp(`(?<![a-z])${escape(phrase)}(?![a-z])`) : new RegExp(escape(phrase)),
);

export function findBannedPhrases(text: string): string[] {
  const lower = text.toLowerCase().replaceAll("’", "'");
  return BANNED_PHRASES.filter((_, i) => BANNED_PATTERNS[i].test(lower));
}

/** The line's text with its evidence cut out once, so a title like "Journey - …" doesn't trip the banned list. */
function withoutEvidence(text: string, evidence: string): string {
  if (!evidence.trim()) return text;
  const at = text.toLowerCase().indexOf(evidence.toLowerCase());
  return at < 0 ? text : text.slice(0, at) + " " + text.slice(at + evidence.length);
}

/** Every string and number in the value, unescaped, joined by newlines. */
function collectText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(collectText).join("\n");
  if (value && typeof value === "object") return Object.values(value).map(collectText).join("\n");
  return "";
}

export function validateRoast(out: RoastOutput, summary: Summary): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const data = collectText(summary).toLowerCase();

  const check = (where: string, text: string | null | undefined) => {
    if (!text) return;
    for (const phrase of findBannedPhrases(text)) problems.push(`${where}: banned "${phrase}"`);
  };

  check("headline", out.headline);
  out.lines.forEach((line, i) => {
    const where = `line ${i + 1}`;
    check(where, withoutEvidence(line.text, line.evidence));
    const evidence = line.evidence.toLowerCase();
    // One character (or nothing) matches almost any text, so it proves nothing.
    if (evidence.trim().length < 2) {
      problems.push(`${where}: evidence "${line.evidence}" too short`);
      return;
    }
    if (!line.text.toLowerCase().includes(evidence)) problems.push(`${where}: evidence "${line.evidence}" not in text`);
    if (!data.includes(evidence)) problems.push(`${where}: evidence "${line.evidence}" not in data`);
  });
  check("personality.label", out.personality.label);
  check("personality.description", out.personality.description);
  for (const [key, caption] of Object.entries(out.captions)) check(`captions.${key}`, caption);

  return { ok: problems.length === 0, problems };
}
