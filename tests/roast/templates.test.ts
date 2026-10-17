import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { RoastOutputSchema } from "@/lib/roast/schema";
import { TEMPLATE_COUNT, generateTemplateRoast, yearsPhrase } from "@/lib/roast/templates";
import { validateRoast } from "@/lib/roast/validate";
import { buildTakeoutSummary } from "@/lib/stats/build-summary";
import type { Summary } from "@/lib/summary";

const personaDir = join(__dirname, "..", "..", "spike", "personas");
const persona = (name: string): Summary => JSON.parse(readFileSync(join(personaDir, `${name}.json`), "utf8"));

const oneVideo = buildTakeoutSummary([{ title: "Lofi Beats", channel: "Lofi Girl", videoId: "a", time: new Date("2024-01-01T12:00:00Z") }], []);
const bare: Summary = { ...persona("gym-bro"), searches: null, samples: { latestNight: [], oneOffs: [] }, topRewatched: [], longestBinge: null, eras: [] };

const cases: [string, Summary][] = [
  ...readdirSync(personaDir).map((f) => [f, persona(f.replace(".json", ""))] as [string, Summary]),
  ["one video", oneVideo],
  ["no searches, no samples", bare],
];

test.each(cases)("%s: valid, passes the validator, 6–10 lines", (_, summary) => {
  const out = generateTemplateRoast(summary);
  expect(() => RoastOutputSchema.parse(out)).not.toThrow();
  expect(validateRoast(out, summary)).toEqual({ ok: true, problems: [] });
  expect(out.lines.length).toBeGreaterThanOrEqual(6);
  expect(out.lines.length).toBeLessThanOrEqual(10);
});

test.each(cases)("%s: deterministic", (_, summary) => {
  expect(generateTemplateRoast(summary)).toEqual(generateTemplateRoast(summary));
});

test("different people get different headlines", () => {
  expect(generateTemplateRoast(persona("gym-bro")).headline).not.toBe(generateTemplateRoast(persona("3am-philosopher")).headline);
});

test("eras are named for every era in the summary", () => {
  const s = persona("3am-philosopher");
  expect(generateTemplateRoast(s).eras.map((e) => e.period)).toEqual(s.eras.map((e) => e.period));
});

test("at least 60 hand-written templates", () => {
  expect(TEMPLATE_COUNT).toBeGreaterThanOrEqual(60);
});

// Review fix M4: template copy must state true numbers.
test("one-channel personality states the real share", () => {
  const base = persona("thin-data");
  const s: Summary = {
    ...base,
    thinData: false,
    afterMidnightPct: 0,
    topRewatched: [],
    longestBinge: null,
    searches: null,
    totals: { ...base.totals, videos: 200 },
    topChannels: [{ name: "Vevo", count: 100 }],
  };
  const out = generateTemplateRoast(s);
  expect(out.personality.label).toBe("THE ONE-CHANNEL WONDER");
  expect(out.personality.description).toContain("50%");
  expect(out.personality.description).not.toContain("a fifth");
});

test("year counts are grammatical", () => {
  expect(yearsPhrase(100)).toBe("1 year");
  expect(yearsPhrase(800)).toBe("2 years");
});

test("no phrase repeats between headline and personality", () => {
  for (const [, s] of cases) {
    const out = generateTemplateRoast(s);
    expect(out.personality.description.includes("hostage") && out.headline.includes("hostage")).toBe(false);
  }
});
