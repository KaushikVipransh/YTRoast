import { expect, test } from "vitest";
import { findBannedPhrases, validateRoast } from "@/lib/roast/validate";
import type { RoastOutput } from "@/lib/roast/schema";
import type { Summary } from "@/lib/summary";

function summaryWithChannel(name: string): Summary {
  return {
    version: 1,
    source: "takeout",
    totals: { videos: 3, channels: 1, firstWatch: null, lastWatch: null, spanDays: 0 },
    topChannels: [{ name, count: 3 }],
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
}

function roastWith(lines: RoastOutput["lines"]): RoastOutput {
  return {
    headline: "a man of no taste",
    lines,
    personality: { label: "THE LURKER", description: "watches, never likes." },
    eras: [],
    captions: emptyCaptions,
  };
}

const emptyCaptions: RoastOutput["captions"] = {
  numbers: null,
  topChannels: null,
  rewatched: null,
  clock: null,
  binge: null,
  searches: null,
  contradictions: null,
};

const sixGoodLines = Array.from({ length: 6 }, (_, i) => ({
  text: `${i} more MrBeast videos and still broke`,
  evidence: "MrBeast",
}));

test("finds banned phrases case-insensitively", () => {
  expect(findBannedPhrases("Ah, a JOURNEY of self — discovery")).toEqual(["ah,", "journey", "—"]);
});

test("clean line passes", () => {
  expect(findBannedPhrases("31 rewatches of the same minecraft ending. it's not getting better.")).toEqual([]);
});

test("good roast is ok", () => {
  expect(validateRoast(roastWith(sixGoodLines), summaryWithChannel("MrBeast"))).toEqual({ ok: true, problems: [] });
});

test("flags line whose evidence is missing from its text", () => {
  const r = validateRoast(roastWith([{ text: "you watch too much", evidence: "MrBeast" }]), summaryWithChannel("MrBeast"));
  expect(r.ok).toBe(false);
  expect(r.problems).toContain('line 1: evidence "MrBeast" not in text');
});

test("flags evidence not found anywhere in summary", () => {
  const r = validateRoast(roastWith([{ text: "all that PewDiePie", evidence: "PewDiePie" }]), summaryWithChannel("MrBeast"));
  expect(r.problems).toContain('line 1: evidence "PewDiePie" not in data');
});

test("evidence matching is case-insensitive", () => {
  const r = validateRoast(roastWith([{ text: "all that mrbeast", evidence: "MRBEAST" }]), summaryWithChannel("MrBeast"));
  expect(r.problems).toEqual([]);
});

test("flags banned phrase in headline", () => {
  const r = validateRoast({ ...roastWith(sixGoodLines), headline: "Let's dive in" }, summaryWithChannel("MrBeast"));
  expect(r.problems).toContain('headline: banned "let\'s dive in"');
});

test("flags banned phrase in captions and personality", () => {
  const roast = {
    ...roastWith(sixGoodLines),
    personality: { label: "X", description: "a true tapestry" },
    captions: { ...emptyCaptions, clock: "it seems like you never sleep" },
  };
  const r = validateRoast(roast, summaryWithChannel("MrBeast"));
  expect(r.problems).toContain('personality.description: banned "tapestry"');
  expect(r.problems).toContain('captions.clock: banned "it seems like"');
});

test("evidence with quotes or backslashes matches raw summary strings", () => {
  const s = summaryWithChannel('He said "no" \ twice');
  const r = validateRoast(roastWith([{ text: 'all that He said "no" \ twice', evidence: 'He said "no" \ twice' }]), s);
  expect(r.problems).toEqual([]);
});
