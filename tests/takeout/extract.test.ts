import { strToU8, zipSync } from "fflate";
import { expect, test } from "vitest";
import { extractTakeoutFiles } from "@/lib/takeout/extract";

test("extract: zip with nested takeout paths", () => {
  const zip = zipSync({
    "Takeout/YouTube and YouTube Music/history/watch-history.json": strToU8("[]"),
    "Takeout/YouTube and YouTube Music/history/search-history.html": strToU8("<html/>"),
    "Takeout/archive_browser.html": strToU8("x"),
  });
  const f = extractTakeoutFiles("takeout-2026.zip", zip);
  expect(f.watch).toEqual({ format: "json", text: "[]" });
  expect(f.search?.format).toBe("html");
});

test("extract: JSON wins when both formats are in the zip", () => {
  const zip = zipSync({
    "Takeout/YouTube/history/watch-history.html": strToU8("<html/>"),
    "Takeout/YouTube/history/watch-history.json": strToU8("[]"),
  });
  expect(extractTakeoutFiles("t.zip", zip).watch.format).toBe("json");
});

test("extract: bare watch-history.html", () => {
  const f = extractTakeoutFiles("watch-history.html", strToU8("<html/>"));
  expect(f.watch).toEqual({ format: "html", text: "<html/>" });
  expect(f.search).toBeNull();
});

test("extract: bare watch-history (1).json from a re-download", () => {
  expect(extractTakeoutFiles("watch-history (1).json", strToU8("[]")).watch.format).toBe("json");
});

test("extract: zip without history → TakeoutError listing files", () => {
  const zip = zipSync({ "Takeout/Drive/notes.txt": strToU8("x") });
  expect(() => extractTakeoutFiles("t.zip", zip)).toThrowError(
    expect.objectContaining({ code: "no-watch-history", found: ["Takeout/Drive/notes.txt"] }),
  );
});

test("extract: non-zip random file → found is the filename", () => {
  expect(() => extractTakeoutFiles("me.jpg", new Uint8Array([1, 2]))).toThrowError(
    expect.objectContaining({ code: "no-watch-history", found: ["me.jpg"] }),
  );
});

test("extract: corrupted .zip → unreadable-zip", () => {
  expect(() => extractTakeoutFiles("t.zip", new Uint8Array([1, 2, 3]))).toThrowError(
    expect.objectContaining({ code: "unreadable-zip" }),
  );
});
