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

test("extract: duplicate copies → unsuffixed name wins in either zip order", () => {
  const a = zipSync({ "T/watch-history (1).json": strToU8("[1]"), "T/watch-history.json": strToU8("[0]") });
  const b = zipSync({ "T/watch-history.json": strToU8("[0]"), "T/watch-history (1).json": strToU8("[1]") });
  expect(extractTakeoutFiles("a.zip", a).watch.text).toBe("[0]");
  expect(extractTakeoutFiles("b.zip", b).watch.text).toBe("[0]");
});

test("extract: only suffixed copies → largest wins", () => {
  const z = zipSync({ "T/watch-history (1).json": strToU8("[1,2,3]"), "T/watch-history (2).json": strToU8("[9]") });
  expect(extractTakeoutFiles("z.zip", z).watch.text).toBe("[1,2,3]");
});

test.each(["takeout.tgz", "takeout.tar.gz"])("extract: %s → unsupported-archive", (name) => {
  expect(() => extractTakeoutFiles(name, new Uint8Array([1]))).toThrowError(
    expect.objectContaining({ code: "unsupported-archive", found: [name] }),
  );
});
