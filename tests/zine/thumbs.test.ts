import { expect, test } from "vitest";
import { thumbUrl, watchUrl } from "@/lib/zine/thumbs";

test("thumbnail and watch URLs for a real id", () => {
  expect(thumbUrl("dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg");
  expect(watchUrl("dQw4w9WgXcQ")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
});

test.each([null, "x", "<script>", "a/b/../c", "dQw4w9WgXcQ?x=1"])("no URL for %s", (id) => {
  expect(thumbUrl(id)).toBeNull();
  expect(watchUrl(id)).toBeNull();
});
