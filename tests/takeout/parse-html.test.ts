import { expect, test } from "vitest";
import { parseSearchHtml, parseTakeoutDate, parseWatchHtml } from "@/lib/takeout/parse-html";
import { parseTakeout } from "@/lib/takeout";
import { fixture } from "./helpers";

// vitest runs with TZ=UTC, so wall-clock times read back as the same ISO hour.
test.each([
  ["Mar 5, 2024, 3:30:00 AM IST", "2024-03-05T03:30:00.000Z"],
  ["Mar 5, 2024, 12:05:00 PM PST", "2024-03-05T12:05:00.000Z"],
  ["Dec 31, 2023, 12:00:01 AM GMT", "2023-12-31T00:00:01.000Z"],
  ["5 Sept 2024, 23:10:04 BST", "2024-09-05T23:10:04.000Z"],
  ["5 Mar 2024, 03:30:00 GMT", "2024-03-05T03:30:00.000Z"],
])("date %s", (s, iso) => {
  expect(parseTakeoutDate(s)?.toISOString()).toBe(iso);
});

test("date garbage → null", () => {
  expect(parseTakeoutDate("yesterday-ish")).toBeNull();
  expect(parseTakeoutDate("Foo 5, 2024, 3:30:00 AM")).toBeNull();
});

const watch = parseWatchHtml(fixture("watch-history.html"));

test("html: first entry fully parsed", () => {
  expect(watch.entries[0]).toEqual({
    title: "Never Gonna Give You Up",
    videoId: "dQw4w9WgXcQ",
    channel: "Rick Astley",
    time: new Date("2024-03-05T03:30:00.000Z"),
  });
});

test("html: decodes entities, drops ads/removed/bad-date, null channel", () => {
  expect(watch.entries.map((e) => e.title)).toEqual([
    "Never Gonna Give You Up",
    "Bake Off Finale",
    "Tom & Jerry 😂",
    "No Channel Vid",
  ]);
  expect(watch.skipped).toBe(3);
  expect(watch.entries.find((e) => e.title === "No Channel Vid")?.channel).toBeNull();
});

test("search html: query text, ads dropped", () => {
  const search = parseSearchHtml(fixture("search-history.html"));
  expect(search.entries).toEqual([{ query: "how to fix my life", time: new Date("2024-03-05T03:31:00.000Z") }]);
  expect(search.skipped).toBe(1);
});

test("parseTakeout dispatches on format and sums skipped", () => {
  const r = parseTakeout({
    watch: { format: "json", text: fixture("watch-history.json") },
    search: { format: "html", text: fixture("search-history.html") },
  });
  expect(r.watches).toHaveLength(4);
  expect(r.searches).toHaveLength(1);
  expect(r.skipped).toBe(3);
});

test("parseTakeout with no search file", () => {
  const r = parseTakeout({ watch: { format: "html", text: fixture("watch-history.html") }, search: null });
  expect(r.searches).toEqual([]);
});
