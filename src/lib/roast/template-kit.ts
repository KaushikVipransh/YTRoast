// Small shared pieces for hand-written template roasts.

export type Line = { text: string; evidence: string };

/** Stable 32-bit hash so the same summary always gets the same template picks. */
export function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Picks one of the usable (truthy) candidates by seed, or null when none apply. */
export function choose<T>(items: (T | null | undefined | "" | 0 | false)[], seed: number): T | null {
  const valid = items.filter(Boolean) as T[];
  return valid.length ? valid[seed % valid.length] : null;
}

export const line = (text: string, evidence: string): Line => ({ text, evidence });

/** Collects distinct lines (by text) up to a target count; skips nulls and too-short evidence. */
export function lineCollector(target: number) {
  const lines: Line[] = [];
  const seen = new Set<string>();
  return {
    lines,
    add(l: Line | null | undefined) {
      if (!l || l.evidence.trim().length < 1 || seen.has(l.text) || lines.length >= target) return;
      seen.add(l.text);
      lines.push(l);
    },
  };
}
