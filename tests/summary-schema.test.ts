import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { z } from "zod";
import { SummarySchema, parseSummary } from "@/lib/summary-schema";
import type { Summary } from "@/lib/summary";
import { buildTakeoutSummary } from "@/lib/stats/build-summary";
import { parseWatchJson } from "@/lib/takeout/parse-json";
import { fixture } from "./takeout/helpers";

// Compile-time: the schema's output type is assignable to Summary.
const _typeCheck: Summary = {} as z.infer<typeof SummarySchema>;
void _typeCheck;

const personaDir = join(__dirname, "..", "spike", "personas");
const personas = readdirSync(personaDir).map((f) => [f, JSON.parse(readFileSync(join(personaDir, f), "utf8"))] as const);

test.each(personas)("persona %s passes", (_, persona) => {
  expect(parseSummary(persona)).toEqual(persona);
});

const real = buildTakeoutSummary(parseWatchJson(fixture("watch-history.json")).entries, []);

test("summary built from a real fixture passes", () => {
  expect(parseSummary(real)).toEqual(real);
});

const clone = (): Summary => structuredClone(real);

test.each<[string, (s: Summary & Record<string, unknown>) => void]>([
  ["unknown top-level key", (s) => void (s.extra = 1)],
  ["25 hours", (s) => void s.hours.push(0)],
  ["negative count", (s) => void (s.totals.videos = -1)],
  ["11 top channels", (s) => void (s.topChannels = Array.from({ length: 11 }, (_, i) => ({ name: `c${i}`, count: 1 })))],
  ["201-char title", (s) => void (s.samples.oneOffs = [{ title: "x".repeat(201), channel: null, videoId: null }])],
  ["version 2", (s) => void ((s as { version: number }).version = 2)],
  ["afterMidnightPct 101", (s) => void (s.afterMidnightPct = 101)],
  ["UTC Z time", (s) => void (s.totals.firstWatch = "2024-03-05T03:30:00.000Z")],
  ["lone surrogate", (s) => void (s.topChannels = [{ name: "a\ud83d", count: 1 }])],
  ["bad era period", (s) => void (s.eras = [{ period: "2024-Q5", count: 1, topChannels: [], sampleTitles: [] }])],
  ["fractional count", (s) => void (s.lateNights = 1.5)],
])("rejects %s", (_, mutate) => {
  const s = clone() as Summary & Record<string, unknown>;
  mutate(s);
  expect(parseSummary(s)).toBeNull();
});

test("rejects non-objects", () => {
  expect(parseSummary(null)).toBeNull();
  expect(parseSummary("summary")).toBeNull();
});

// Review fix M3: a roast needs at least one watch to be about.
test("rejects a summary with zero videos", () => {
  const s = clone();
  s.totals.videos = 0;
  expect(parseSummary(s)).toBeNull();
});
