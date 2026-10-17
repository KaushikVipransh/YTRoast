import { strToU8, zipSync } from "fflate";
import { afterEach, expect, test, vi } from "vitest";
import * as stats from "@/lib/stats/build-summary";
import { processTakeout } from "@/lib/takeout/process";
import { fixture } from "./helpers";

afterEach(() => {
  vi.restoreAllMocks();
});

const zip = zipSync({
  "Takeout/YouTube and YouTube Music/history/watch-history.json": strToU8(fixture("watch-history.json")),
  "Takeout/YouTube and YouTube Music/history/search-history.json": strToU8(fixture("search-history.json")),
});

test("a real-shaped Takeout zip → summary and counts", () => {
  const r = processTakeout("takeout-20261017.zip", zip);
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.counts).toEqual({ videos: 4, channels: 2, searches: 1 });
    expect(r.summary.totals.videos).toBe(4);
  }
});

test("wrong file → no-watch-history naming it", () => {
  expect(processTakeout("me.jpg", new Uint8Array([1, 2]))).toEqual({ ok: false, code: "no-watch-history", found: ["me.jpg"] });
});

test("empty history → no-entries", () => {
  expect(processTakeout("watch-history.json", strToU8("[]"))).toMatchObject({ ok: false, code: "no-entries" });
});

test("a bug outside Takeout parsing → unknown, never a throw", () => {
  vi.spyOn(stats, "buildTakeoutSummary").mockImplementation(() => {
    throw new TypeError("boom");
  });
  expect(processTakeout("takeout.zip", zip)).toEqual({ ok: false, code: "unknown", found: [] });
});
