import type { RoastOutput } from "@/lib/roast/schema";
import type { Summary } from "@/lib/summary";

const MAX_LINE = 140;

/** What goes on the 1080×1920 story image (design Part 6): headline, the 3 punchiest (shortest) lines, personality, one stat. */
export function storyContent(roast: RoastOutput, summary: Summary) {
  const lines = roast.lines
    .map((l, i) => ({ text: l.text, i }))
    .filter((l) => l.text.length <= MAX_LINE)
    .sort((a, b) => a.text.length - b.text.length || a.i - b.i)
    .slice(0, 3)
    .sort((a, b) => a.i - b.i)
    .map((l) => l.text);

  // 96px for short verdicts, shrinking linearly to 56px by 90 characters, so long ones fit in about 5 lines.
  const len = roast.headline.length;
  const headlineSize = Math.round(96 - (40 * Math.min(Math.max(len - 30, 0), 60)) / 60);

  const top = summary.topChannels[0];
  const stat = top ? `${top.name} · ${top.count.toLocaleString("en-US")} videos` : `${summary.totals.videos.toLocaleString("en-US")} videos`;

  return { headline: roast.headline, lines, personality: roast.personality.label, stat, headlineSize };
}
