import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { buildQuickSummary } from "@/lib/quick/build";
import { buildRoastPrompt } from "@/lib/roast/prompt";
import { RoastOutputSchema } from "@/lib/roast/schema";
import { generateTemplateRoast } from "@/lib/roast/templates";
import { validateRoast } from "@/lib/roast/validate";
import type { QuickSummary } from "@/lib/summary";

const fixture: QuickSummary = JSON.parse(readFileSync(join(__dirname, "..", "fixtures", "quick-summary.json"), "utf8"));
const thin = buildQuickSummary({
  likes: [
    { title: "Baby Shark Dance", videoId: "XqZsoesa55w", channel: "Pinkfong" },
    { title: "Despacito", videoId: "kJQP7kiw5Fk", channel: "Luis Fonsi" },
    { title: "Gangnam Style", videoId: "9bZkp7q19f0", channel: "officialpsy" },
  ],
  subscriptions: [{ name: "Pinkfong", since: "2017-06-01T00:00:00Z" }],
  playlists: [],
});
const empty = buildQuickSummary({ likes: [], subscriptions: [], playlists: [] });

test.each([
  ["fixture", fixture],
  ["thin (3 likes)", thin],
  ["empty account", empty],
])("%s: valid, passes the validator, 6–10 lines, deterministic, no eras", (_, s) => {
  const out = generateTemplateRoast(s);
  expect(() => RoastOutputSchema.parse(out)).not.toThrow();
  expect(validateRoast(out, s)).toEqual({ ok: true, problems: [] });
  expect(out.lines.length).toBeGreaterThanOrEqual(6);
  expect(out.lines.length).toBeLessThanOrEqual(10);
  expect(out.eras).toEqual([]);
  expect(generateTemplateRoast(s)).toEqual(out);
});

test("a quick prompt says it's likes and subscriptions, not watch history", () => {
  const p = buildRoastPrompt(fixture);
  expect(p).toContain("QUICK ROAST");
  expect(p).toContain("not their watch history");
  expect(buildRoastPrompt(fixture)).toContain(JSON.stringify(fixture));
});
