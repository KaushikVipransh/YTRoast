import { expect, test } from "vitest";
import { SYSTEM_PROMPT, buildRoastPrompt } from "@/lib/roast/prompt";
import { BANNED_PHRASES } from "@/lib/roast/validate";
import type { Summary } from "@/lib/summary";

const thinSummary: Summary = {
  version: 1,
  source: "takeout",
  totals: { videos: 3, channels: 1, firstWatch: "2024-01-01T00:00:00.000Z", lastWatch: "2024-01-02T00:00:00.000Z", spanDays: 1 },
  topChannels: [{ name: "MrBeast", count: 3 }],
  topRewatched: [],
  hours: Array(24).fill(0),
  weekdays: Array(7).fill(0),
  afterMidnightPct: 0,
  lateNights: 0,
  longestBinge: null,
  eras: [],
  searches: null,
  samples: { latestNight: [], oneOffs: [] },
  thinData: true,
};

test("prompt embeds summary JSON and thin-data hint", () => {
  const p = buildRoastPrompt(thinSummary);
  expect(p).toContain(JSON.stringify(thinSummary));
  expect(p).toContain("THIN DATA");
});

test("no thin-data hint when there is plenty of data", () => {
  expect(buildRoastPrompt({ ...thinSummary, thinData: false })).not.toContain("THIN DATA");
});

test("system prompt carries the banned list", () => {
  for (const b of BANNED_PHRASES) expect(SYSTEM_PROMPT.toLowerCase()).toContain(b);
});

test("system prompt says times are the user's local time and time lines cite the title", () => {
  expect(SYSTEM_PROMPT).toContain("their local time");
  expect(SYSTEM_PROMPT).toContain("evidence is the title or search");
});

// Production bug: models wrote exactly 6 lines, so one bad line sank the roast; groq quoted raw JSON.
test("system prompt asks for 8–10 lines and forbids quoting JSON", () => {
  expect(SYSTEM_PROMPT).toContain("8 to 10 roast lines");
  expect(SYSTEM_PROMPT).toContain("never quote json");
});
