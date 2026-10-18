import type { RoastOutput } from "@/lib/roast/schema";
import type { Summary } from "@/lib/summary";

const MAX_LINE = 140;
const CONTENT_WIDTH = 936; // 1080 − 2×72 padding
const BUDGET = 1420; // 1920 − 2×250 Instagram safe zones
const LINE_SIZES = [44, 40, 36, 32];

// Rough average glyph widths (em) for the two fonts in the image; deliberately on the wide side.
const DISPLAY_EM = 0.8; // Bowlby One, uppercase
const BODY_EM = 0.55; // Barlow SemiBold

const linesAt = (text: string, size: number, em: number, width: number) =>
  Math.max(1, Math.ceil((text.length * size * em) / width));

/** Estimated pixel height of everything between the safe zones; mirrors the JSX in /r/[id]/story. */
function estimate(headline: string, headlineSize: number, lines: string[], lineSize: number, personality: string) {
  const caseRow = 70;
  const head = 40 + linesAt(headline, headlineSize, DISPLAY_EM, CONTENT_WIDTH) * headlineSize * 1.12;
  const strips = lines.reduce((h, l) => h + linesAt(l, lineSize, BODY_EM, CONTENT_WIDTH - 68) * lineSize * 1.25 + 62 + 34, 60);
  const badge = linesAt(personality, 44, DISPLAY_EM, CONTENT_WIDTH - 52) * 52 + 28 + 18 + 42;
  const tape = 48 + 70;
  return Math.round(caseRow + head + strips + badge + tape);
}

/**
 * What goes on the 1080×1920 story image (design Part 6): the headline, up to 3 of the punchiest (shortest)
 * lines, personality and one stat, sized to fit between Instagram's safe zones. Line text shrinks first,
 * then the third line is dropped, so the verdict is never covered.
 */
export function storyContent(roast: RoastOutput, summary: Summary) {
  const picked = roast.lines
    .map((l, i) => ({ text: l.text, i }))
    .filter((l) => l.text.length <= MAX_LINE)
    .sort((a, b) => a.text.length - b.text.length || a.i - b.i)
    .slice(0, 3);
  const inOrder = (items: typeof picked) => [...items].sort((a, b) => a.i - b.i).map((l) => l.text);

  // 96px for short verdicts, shrinking linearly to 56px by 90 characters.
  const len = roast.headline.length;
  const headlineSize = Math.round(96 - (40 * Math.min(Math.max(len - 30, 0), 60)) / 60);
  const personality = roast.personality.label;

  let lines = inOrder(picked);
  let lineSize = LINE_SIZES[0];
  fit: for (const count of [3, 2, 1]) {
    lines = inOrder(picked.slice(0, count));
    for (const size of LINE_SIZES) {
      lineSize = size;
      if (estimate(roast.headline, headlineSize, lines, size, personality) <= BUDGET) break fit;
    }
  }
  const estimatedHeight = estimate(roast.headline, headlineSize, lines, lineSize, personality);

  const top = summary.topChannels[0];
  const stat = top ? `${top.name} · ${top.count.toLocaleString("en-US")} videos` : `${summary.totals.videos.toLocaleString("en-US")} videos`;

  return { headline: roast.headline, lines, personality, stat, headlineSize, lineSize, estimatedHeight };
}
