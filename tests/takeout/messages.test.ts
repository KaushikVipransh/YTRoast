import { expect, test } from "vitest";
import { errorMessage } from "@/lib/takeout/messages";

test.each([
  ["no-watch-history", ["me.jpg"], "that's not your watch history, that's me.jpg. we need watch-history.json."],
  ["no-entries", [], "your history is empty. either you're a saint or you turned history off. both are suspicious."],
  ["unreadable-zip", ["t.zip"], "that zip is broken"],
  ["unreadable-history", [], "that file is corrupted"],
  ["unsupported-archive", ["t.tgz"], "export it again as .zip"],
  ["unknown", [], "something broke on our side"],
] as const)("%s", (code, found, expected) => {
  expect(errorMessage(code, [...found])).toContain(expected);
});

test("wrong file inside a zip names the first thing we found", () => {
  expect(errorMessage("no-watch-history", ["Takeout/Drive/notes.txt", "Takeout/x"])).toContain("that's Takeout/Drive/notes.txt");
});

test("wrong file with nothing found still reads well", () => {
  expect(errorMessage("no-watch-history", [])).toContain("we need watch-history.json");
});
