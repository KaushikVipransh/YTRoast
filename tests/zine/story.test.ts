import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { RoastOutput } from "@/lib/roast/schema";
import { generateTemplateRoast } from "@/lib/roast/templates";
import type { Summary } from "@/lib/summary";
import { storyContent } from "@/lib/zine/story";

const summary: Summary = JSON.parse(readFileSync(join(__dirname, "..", "..", "spike", "personas", "gym-bro.json"), "utf8"));
const base = generateTemplateRoast(summary);
const withLines = (texts: string[]): RoastOutput => ({ ...base, lines: texts.map((text) => ({ text, evidence: "x" })) });

test("picks the 3 shortest lines, keeping their original order", () => {
  const roast = withLines(["a much longer line here", "short one", "mid length line", "tiny", "another fairly long one"]);
  expect(storyContent(roast, summary).lines).toEqual(["short one", "mid length line", "tiny"]);
});

test("never returns a line over 140 characters", () => {
  const roast = withLines(["x".repeat(200), "y".repeat(150), "ok line", "z".repeat(141)]);
  expect(storyContent(roast, summary).lines).toEqual(["ok line"]);
});

test("headline size shrinks as the headline grows", () => {
  const size = (len: number) => storyContent({ ...base, headline: "w".repeat(len) }, summary).headlineSize;
  expect(size(20)).toBe(96);
  expect(size(60)).toBeLessThan(size(20));
  expect(size(140)).toBeLessThan(size(60));
  expect(size(140)).toBeGreaterThanOrEqual(56);
});

test("stat uses the top channel, or plain video count without one", () => {
  expect(storyContent(base, summary).stat).toBe("Jeff Nippard · 1,311 videos");
  expect(storyContent(base, { ...summary, topChannels: [] }).stat).toBe("18,432 videos");
});

// Review fix C1: the story layout must fit between the 250px safe zones (1920 − 2×250 = 1420px), worst case included.
test("worst case (140-char headline, three 140-char lines, long personality) fits the height budget", () => {
  const roast: RoastOutput = {
    ...base,
    headline: "w ".repeat(70).trim(),
    personality: { label: "THE ALGORITHM'S MOST LOYAL HOSTAGE EVER", description: "x" },
    lines: Array.from({ length: 6 }, (_, i) => ({ text: `${i} ${"long words here ".repeat(9)}`.slice(0, 140), evidence: "x" })),
  };
  const story = storyContent(roast, summary);
  expect(story.estimatedHeight).toBeLessThanOrEqual(1420);
  expect(story.lineSize).toBeGreaterThanOrEqual(32);
  expect(story.lines.length).toBeGreaterThanOrEqual(2);
});

test("a normal roast keeps 3 lines at full size", () => {
  const story = storyContent(withLines(["you watched it 31 times.", "88 videos in one day.", "nobody needs that much minecraft."]), summary);
  expect(story.lines).toHaveLength(3);
  expect(story.lineSize).toBe(44);
  expect(story.estimatedHeight).toBeLessThanOrEqual(1420);
});
