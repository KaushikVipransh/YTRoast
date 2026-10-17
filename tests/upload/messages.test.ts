import { expect, test } from "vitest";
import { uploadErrorMessage } from "@/lib/upload-messages";

// Review fix M10: "try again" only where trying again can help.
test.each([
  [400, "export your history again"],
  [413, "too big"],
  [500, "the roast oven jammed. try again."],
  [503, "the roast oven jammed. try again."],
])("status %i", (status, expected) => {
  expect(uploadErrorMessage(status)).toContain(expected);
});

test("429 tells them to come back tomorrow", () => {
  expect(uploadErrorMessage(429)).toContain("you've been roasted 3 times today. come back tomorrow, you need the rest.");
});
