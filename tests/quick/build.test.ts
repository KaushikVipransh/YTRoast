import { expect, test } from "vitest";
import { buildQuickSummary } from "@/lib/quick/build";
import type { YouTubeData } from "@/lib/quick/youtube";
import { QuickSummarySchema } from "@/lib/summary-schema";

const like = (i: number, channel: string | null = `Channel ${i % 3}`) => ({ title: `video ${i}`, videoId: `vid${String(i).padStart(8, "0")}`, channel });

const data: YouTubeData = {
  totals: { likes: 5, subscriptions: 4, playlists: 1 },
  likes: [like(0, "MrBeast"), like(1, "MrBeast"), like(2, "Mark Rober"), like(3, null), like(4, "MrBeast")],
  subscriptions: [
    { name: "MrBeast", since: "2019-05-01T10:00:00Z" },
    { name: "Smosh", since: "2012-03-04T10:00:00Z" },
    { name: "Vsauce", since: "2013-01-01T10:00:00Z" },
    { name: "Mark Rober", since: "2020-01-01T10:00:00Z" },
  ],
  playlists: [{ title: "sad hours", count: 23, items: ["Someone Like You", "Skinny Love", "Hurt", "Creep"] }],
};

test("counts liked channels, finds abandoned and oldest subscriptions", () => {
  const s = buildQuickSummary(data);
  expect(s.source).toBe("quick");
  expect(s.totals).toEqual({ likes: 5, subscriptions: 4, playlists: 1 });
  expect(s.topChannels).toEqual([
    { name: "MrBeast", count: 3 },
    { name: "Mark Rober", count: 1 },
  ]);
  expect(s.subscriptions.abandoned).toEqual(["Smosh", "Vsauce"]);
  expect(s.subscriptions.oldest.map((o) => o.since)).toEqual(["2012-03-04", "2013-01-01", "2019-05-01", "2020-01-01"]);
  expect(s.playlists).toEqual([{ title: "sad hours", count: 23, sampleTitles: ["Someone Like You", "Skinny Love", "Hurt"] }]);
  expect(QuickSummarySchema.safeParse(s).success).toBe(true);
});

test("thinData for a nearly empty account", () => {
  expect(buildQuickSummary({ totals: { likes: 3, subscriptions: 2, playlists: 0 }, likes: [like(0), like(1), like(2)], subscriptions: [{ name: "a", since: "2020-01-01T00:00:00Z" }, { name: "b", since: "2020-01-01T00:00:00Z" }], playlists: [] }).thinData).toBe(true);
  expect(buildQuickSummary(data).thinData).toBe(true); // 5 + 4 < 20
});

test("liked samples are evenly spaced, at most 15", () => {
  const many = { ...data, likes: Array.from({ length: 300 }, (_, i) => like(i)) };
  const s = buildQuickSummary(many);
  expect(s.likedSamples).toHaveLength(15);
  expect(s.likedSamples[0].title).toBe("video 0");
  expect(s.likedSamples[1].title).toBe("video 20");
});

test("titles are clipped to 120 characters", () => {
  const s = buildQuickSummary({ ...data, likes: [{ ...like(0), title: "x".repeat(300) }] });
  expect(s.likedSamples[0].title).toHaveLength(120);
});

test("an empty account still produces a valid summary", () => {
  const s = buildQuickSummary({ totals: { likes: 0, subscriptions: 0, playlists: 0 }, likes: [], subscriptions: [], playlists: [] });
  expect(QuickSummarySchema.safeParse(s).success).toBe(true);
  expect(s.thinData).toBe(true);
});

test("a huge account stays under 30,000 UTF-8 bytes", () => {
  const huge: YouTubeData = {
    totals: { likes: 500, subscriptions: 500, playlists: 10 },
    likes: Array.from({ length: 500 }, (_, i) => ({ title: `動画タイトル🔥${"長".repeat(60)}${i}`, videoId: `vid${String(i).padStart(8, "0")}`, channel: `チャンネル${"名".repeat(40)}${i % 50}` })),
    subscriptions: Array.from({ length: 500 }, (_, i) => ({ name: `登録${"名".repeat(50)}${i}`, since: "2015-01-01T00:00:00Z" })),
    playlists: Array.from({ length: 10 }, (_, i) => ({ title: `リスト${"名".repeat(60)}${i}`, count: 50, items: Array.from({ length: 50 }, (_, k) => `曲${"名".repeat(60)}${k}`) })),
  };
  const json = JSON.stringify(buildQuickSummary(huge));
  expect(new TextEncoder().encode(json).length).toBeLessThan(30_000);
});

test("totals and thinData use the real totals, not the fetched samples", () => {
  const s = buildQuickSummary({ ...data, totals: { likes: 3000, subscriptions: 1200, playlists: 40 } });
  expect(s.totals).toEqual({ likes: 3000, subscriptions: 1200, playlists: 40 });
  expect(s.thinData).toBe(false);
});
