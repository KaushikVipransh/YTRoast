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

export function findBannedPhrases(text: string): string[] {
  const lower = text.toLowerCase().replaceAll("’", "'");
  return BANNED_PHRASES.filter((phrase) => lower.includes(phrase));
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
    check(where, line.text);
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
