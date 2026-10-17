import { expect, test } from "vitest";
import { parseSearchJson, parseWatchJson } from "@/lib/takeout/parse-json";
import { fixture } from "./helpers";

const watch = parseWatchJson(fixture("watch-history.json"));

test("json: drops ads and removed videos, strips 'Watched '", () => {
  expect(watch.entries).toHaveLength(4);
  expect(watch.skipped).toBe(2);
  expect(watch.entries[0]).toEqual({
    title: "Never Gonna Give You Up",
    videoId: "dQw4w9WgXcQ",
    channel: "Rick Astley",
    time: new Date("2024-03-05T03:30:00.000Z"),
  });
});

test("json: missing subtitles → channel null", () => {
  const music = watch.entries.find((e) => e.title === "Blinding Lights");
  expect(music?.channel).toBeNull();
  expect(music?.videoId).toBe("4NRXx6U8ABQ");
});

test("json: ampersand and emoji kept verbatim", () => {
  expect(watch.entries.map((e) => e.title)).toContain("Tom & Jerry 😂");
});

test("json: bad time is skipped, not thrown", () => {
  const text = JSON.stringify([{ title: "Watched x", titleUrl: "https://www.youtube.com/watch?v=x", time: "nope" }]);
  expect(parseWatchJson(text)).toEqual({ entries: [], skipped: 1 });
});

test("search json: query from URL, ads dropped", () => {
  const search = parseSearchJson(fixture("search-history.json"));
  expect(search.entries).toEqual([{ query: "how to fix my life", time: new Date("2024-03-05T03:31:00.000Z") }]);
  expect(search.skipped).toBe(1);
});

test("json: whitespace-only channel → null", () => {
  const text = JSON.stringify([{ title: "Watched x", titleUrl: "https://www.youtube.com/watch?v=x", subtitles: [{ name: "   " }], time: "2024-01-01T00:00:00Z" }]);
  expect(parseWatchJson(text).entries[0].channel).toBeNull();
});

test("json: URL-only title (video went private) is skipped", () => {
  const text = JSON.stringify([{ title: "Watched https://www.youtube.com/watch?v=abc", titleUrl: "https://www.youtube.com/watch?v=abc", time: "2024-01-01T00:00:00Z" }]);
  expect(parseWatchJson(text)).toEqual({ entries: [], skipped: 1 });
});
