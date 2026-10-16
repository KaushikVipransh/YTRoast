import { expect, test } from "vitest";
import { parseTakeout } from "@/lib/takeout";

// Review fix (PRD US-20): corrupt or empty history is a typed error, never a silent "thin data" roast.
const json = (text: string) => parseTakeout({ watch: { format: "json", text }, search: null });
const html = (text: string) => parseTakeout({ watch: { format: "html", text }, search: null });

test("corrupt JSON → unreadable-history", () => {
  expect(() => json("{not json")).toThrowError(expect.objectContaining({ code: "unreadable-history" }));
});

test("JSON that is not an array → unreadable-history", () => {
  expect(() => json('{"a":1}')).toThrowError(expect.objectContaining({ code: "unreadable-history" }));
});

test("junk array entries are skipped without crashing → no-entries", () => {
  expect(() => json('[null, 5, {"title": 7, "titleUrl": "https://www.youtube.com/watch?v=x", "time": "2024-01-01T00:00:00Z"}]')).toThrowError(
    expect.objectContaining({ code: "no-entries" }),
  );
});

test("empty JSON array → no-entries", () => {
  expect(() => json("[]")).toThrowError(expect.objectContaining({ code: "no-entries" }));
});

test("HTML without any Takeout cells → no-entries", () => {
  expect(() => html("<html><body><p>hello</p></body></html>")).toThrowError(expect.objectContaining({ code: "no-entries" }));
});

test("corrupt search file does not sink a good watch file", () => {
  const r = parseTakeout({
    watch: { format: "json", text: '[{"title":"Watched a","titleUrl":"https://www.youtube.com/watch?v=a","time":"2024-01-01T00:00:00Z"}]' },
    search: { format: "json", text: "{broken" },
  });
  expect(r.watches).toHaveLength(1);
  expect(r.searches).toEqual([]);
});
