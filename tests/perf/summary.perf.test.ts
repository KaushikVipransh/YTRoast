import { expect, test } from "vitest";
import { buildTakeoutSummary } from "@/lib/stats/build-summary";
import type { SearchEntry, WatchEntry } from "@/lib/takeout/types";

// Heavy tests run in their own vitest project, one file at a time, so they do not starve each other of memory.
function w(title: string, channel: string | null, iso: string, videoId: string | null = null): WatchEntry {
  return { title, channel, videoId, time: new Date(iso) };
}
function s(query: string, iso: string): SearchEntry {
  return { query, time: new Date(iso) };
}

test("100k entries: < 2000 ms and JSON < 30000 chars", () => {
  const big = Array.from({ length: 100_000 }, (_, i) =>
    w(
      `video ${i % 7000} ${"x".repeat(i % 200)}`,
      `ch${i % 1900}`,
      new Date(Date.UTC(2020, 0, 1) + i * 1_800_000).toISOString(),
      `id${i % 7000}`,
    ),
  );
  const t = performance.now();
  const sum = buildTakeoutSummary(big, []);
  expect(performance.now() - t).toBeLessThan(2000);
  expect(JSON.stringify(sum).length).toBeLessThan(30_000);
});

test("100k CJK/emoji entries: summary under 30,000 UTF-8 bytes", () => {
  const big = Array.from({ length: 100_000 }, (_, i) =>
    w(
      `动画视频😀${i % 7000}${"漢字テスト🔥".repeat(40)}`,
      `频道${"名".repeat(60)}${i % 1900}`,
      new Date(Date.UTC(2020, 0, 1) + i * 1_800_000).toISOString(),
      `id${i % 7000}`,
    ),
  );
  const searches = Array.from({ length: 5000 }, (_, i) => s(`搜索${"词".repeat(80)}${i % 40}`, new Date(Date.UTC(2021, 0, 1) + i * 3_600_000).toISOString()));
  const json = JSON.stringify(buildTakeoutSummary(big, searches));
  expect(new TextEncoder().encode(json).length).toBeLessThan(30_000);
});
