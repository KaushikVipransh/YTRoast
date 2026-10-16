import { expect, test } from "vitest";
import { buildTakeoutSummary } from "@/lib/stats/build-summary";
import { localDateKey, quarterKey } from "@/lib/stats/time";
import type { SearchEntry, WatchEntry } from "@/lib/takeout/types";

// Tests run with TZ=UTC, so local time == the ISO strings below.
function w(title: string, channel: string | null, iso: string, videoId: string | null = null): WatchEntry {
  return { title, channel, videoId, time: new Date(iso) };
}
function s(query: string, iso: string): SearchEntry {
  return { query, time: new Date(iso) };
}

test("time helpers use local date and quarter", () => {
  expect(localDateKey(new Date("2024-03-05T23:59:00Z"))).toBe("2024-03-05");
  expect(quarterKey(new Date("2024-03-31T10:00:00Z"))).toBe("2024-Q1");
  expect(quarterKey(new Date("2024-10-01T00:00:00Z"))).toBe("2024-Q4");
});

test("top channels: count desc, name asc tie-break, null channel excluded", () => {
  const sum = buildTakeoutSummary(
    [
      w("a", "B", "2024-01-01T10:00Z"),
      w("b", "A", "2024-01-01T11:00Z"),
      w("c", "B", "2024-01-02T10:00Z"),
      w("d", null, "2024-01-02T11:00Z"),
      w("e", "C", "2024-01-02T12:00Z"),
    ],
    [],
  );
  expect(sum.topChannels).toEqual([
    { name: "B", count: 2 },
    { name: "A", count: 1 },
    { name: "C", count: 1 },
  ]);
  expect(sum.totals).toEqual({
    videos: 5,
    channels: 3,
    firstWatch: "2024-01-01T10:00:00.000Z",
    lastWatch: "2024-01-02T12:00:00.000Z",
    spanDays: 1,
  });
});

test("top channels capped at 10", () => {
  const many = Array.from({ length: 15 }, (_, i) => w(`v${i}`, `ch${String(i).padStart(2, "0")}`, "2024-01-01T10:00Z"));
  expect(buildTakeoutSummary(many, []).topChannels).toHaveLength(10);
});

test("rewatched groups by videoId (else title), count ≥ 2 only, title of latest watch", () => {
  const sum = buildTakeoutSummary(
    [
      w("Old Title", "Ch", "2024-01-01T10:00Z", "X"),
      w("New Title", "Ch", "2024-02-01T10:00Z", "X"),
      w("Mid Title", "Ch", "2024-01-15T10:00Z", "X"),
      w("No Id", "Other", "2024-01-01T10:00Z"),
      w("No Id", "Other", "2024-01-02T10:00Z"),
      w("Once", "Other", "2024-01-03T10:00Z", "Y"),
    ],
    [],
  );
  expect(sum.topRewatched).toEqual([
    { title: "New Title", channel: "Ch", videoId: "X", count: 3 },
    { title: "No Id", channel: "Other", videoId: null, count: 2 },
  ]);
});

test("hours / weekdays / afterMidnightPct", () => {
  const sum = buildTakeoutSummary(
    [
      w("a", "c", "2024-03-05T03:30Z"), // Tuesday
      w("b", "c", "2024-03-05T13:00Z"),
      w("c", "c", "2024-03-06T13:00Z"), // Wednesday
      w("d", "c", "2024-03-10T22:00Z"), // Sunday
    ],
    [],
  );
  expect(sum.hours).toHaveLength(24);
  expect(sum.hours[3]).toBe(1);
  expect(sum.hours[13]).toBe(2);
  expect(sum.weekdays).toEqual([1, 0, 2, 1, 0, 0, 0]);
  expect(sum.afterMidnightPct).toBe(25);
});

test("lateNights counts distinct dates with 02:00–04:59", () => {
  const sum = buildTakeoutSummary(
    [
      w("a", "c", "2024-03-05T03:00Z"),
      w("b", "c", "2024-03-05T03:10Z"),
      w("c", "c", "2024-03-06T02:10Z"),
      w("d", "c", "2024-03-07T05:00Z"),
      w("e", "c", "2024-03-08T01:59Z"),
    ],
    [],
  );
  expect(sum.lateNights).toBe(2);
});

test("longestBinge: max per-day count, earliest date on tie, ≤5 distinct titles in time order", () => {
  const day1 = ["t1", "t2", "t1", "t3", "t4", "t5", "t6"].map((t, i) => w(t, "c", `2024-05-02T1${i}:00Z`));
  const day0 = Array.from({ length: 7 }, (_, i) => w(`x${i}`, "c", `2024-05-01T1${i}:00Z`));
  const sum = buildTakeoutSummary([...day1, ...day0], []);
  expect(sum.longestBinge).toEqual({ date: "2024-05-01", count: 7, sampleTitles: ["x0", "x1", "x2", "x3", "x4"] });

  const only = buildTakeoutSummary(day1, []);
  expect(only.longestBinge).toEqual({ date: "2024-05-02", count: 7, sampleTitles: ["t1", "t2", "t3", "t4", "t5"] });
});

test("eras: quarter keys ascending, last 12 only, top 3 channels, top 3 titles", () => {
  const watches: WatchEntry[] = [];
  for (let q = 0; q < 14; q++) {
    const year = 2021 + Math.floor(q / 4);
    const month = (q % 4) * 3 + 1;
    const iso = `${year}-${String(month).padStart(2, "0")}-15T12:00Z`;
    watches.push(w("t", "only", iso));
  }
  watches.push(
    w("A", "big", "2024-07-01T10:00Z"),
    w("A", "big", "2024-07-02T10:00Z"),
    w("B", "big", "2024-07-03T10:00Z"),
    w("C", "mid", "2024-07-04T10:00Z"),
    w("D", "mid", "2024-07-05T10:00Z"),
    w("E", "small", "2024-07-06T10:00Z"),
  );
  // 15 quarters in total (2021-Q1 … 2024-Q3) → keep the last 12: 2021-Q4 … 2024-Q3.
  const sum = buildTakeoutSummary(watches, []);
  expect(sum.eras).toHaveLength(12);
  expect(sum.eras[0]).toEqual({ period: "2021-Q4", count: 1, topChannels: ["only"], sampleTitles: ["t"] });
  expect(sum.eras.at(-1)).toEqual({
    period: "2024-Q3",
    count: 6,
    topChannels: ["big", "mid", "small"],
    sampleTitles: ["A", "B", "C"],
  });
});

test("searches: null when none", () => {
  expect(buildTakeoutSummary([w("a", "c", "2024-01-01T10:00Z")], []).searches).toBeNull();
});

test("searches: topRepeated count ≥ 2; lateNight = 0–4h, newest first, ≤10", () => {
  const searches = [
    s("fix sleep", "2024-01-01T03:00Z"),
    s("fix sleep", "2024-01-02T03:00Z"),
    s("fix sleep", "2024-01-03T15:00Z"),
    s("ex", "2024-01-04T01:00Z"),
    s("ex", "2024-01-05T12:00Z"),
    s("once", "2024-01-06T12:00Z"),
    ...Array.from({ length: 12 }, (_, i) => s(`late ${i}`, `2024-02-${String(i + 1).padStart(2, "0")}T04:00Z`)),
  ];
  const sum = buildTakeoutSummary([w("a", "c", "2024-01-01T10:00Z")], searches);
  expect(sum.searches?.total).toBe(18);
  expect(sum.searches?.topRepeated).toEqual([
    { name: "fix sleep", count: 3 },
    { name: "ex", count: 2 },
  ]);
  expect(sum.searches?.lateNight).toHaveLength(10);
  expect(sum.searches?.lateNight[0]).toEqual({ query: "late 11", time: "2024-02-12T04:00:00.000Z" });
});

test("samples.latestNight: watches in 0–4h, latest clock time first, ≤5", () => {
  const sum = buildTakeoutSummary(
    [
      w("one", "c", "2024-01-01T01:00Z"),
      w("four59", "c", "2024-01-02T04:59Z"),
      w("two", "c", "2024-01-03T02:00Z"),
      w("five", "c", "2024-01-04T05:00Z"),
      w("three", "c", "2024-01-05T03:00Z"),
      w("zero", "c", "2024-01-06T00:10Z"),
      w("four", "c", "2024-01-07T04:00Z"),
    ],
    [],
  );
  expect(sum.samples.latestNight.map((x) => x.title)).toEqual(["four59", "four", "three", "two", "one"]);
  expect(sum.samples.latestNight[0]).toEqual({ title: "four59", channel: "c", videoId: null, time: "2024-01-02T04:59:00.000Z" });
});

test("samples.oneOffs: channels watched exactly once, ≤10, evenly spaced through history", () => {
  const watches = Array.from({ length: 30 }, (_, i) =>
    w(`once ${i}`, `solo${i}`, new Date(Date.UTC(2024, 0, 1 + i)).toISOString()),
  );
  watches.push(w("x", "twice", "2024-03-01T10:00Z"), w("y", "twice", "2024-03-02T10:00Z"));
  const sum = buildTakeoutSummary(watches, []);
  expect(sum.samples.oneOffs.map((x) => x.title)).toEqual([0, 3, 6, 9, 12, 15, 18, 21, 24, 27].map((i) => `once ${i}`));
});

test("thinData true under 50 videos, false at 50", () => {
  const make = (n: number) => Array.from({ length: n }, (_, i) => w(`v${i}`, "c", "2024-01-01T10:00Z"));
  expect(buildTakeoutSummary(make(49), []).thinData).toBe(true);
  expect(buildTakeoutSummary(make(50), []).thinData).toBe(false);
});

test("titles, channels and queries truncated to 120 chars with …", () => {
  const long = "x".repeat(300);
  const sum = buildTakeoutSummary([w(long, long, "2024-01-01T03:00Z"), w(long, long, "2024-01-02T03:00Z")], [s(long, "2024-01-01T03:00Z"), s(long, "2024-01-02T03:00Z")]);
  const expected = "x".repeat(119) + "…";
  expect(sum.topChannels[0].name).toBe(expected);
  expect(sum.topRewatched[0].title).toBe(expected);
  expect(sum.samples.latestNight[0].title).toBe(expected);
  expect(sum.searches?.topRepeated[0].name).toBe(expected);
  expect(sum.longestBinge?.sampleTitles[0]).toBe(expected);
});

test("empty input → zeros, nulls, thinData true, no throw", () => {
  const sum = buildTakeoutSummary([], []);
  expect(sum.totals).toEqual({ videos: 0, channels: 0, firstWatch: null, lastWatch: null, spanDays: 0 });
  expect(sum.afterMidnightPct).toBe(0);
  expect(sum.longestBinge).toBeNull();
  expect(sum.eras).toEqual([]);
  expect(sum.searches).toBeNull();
  expect(sum.thinData).toBe(true);
});

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
