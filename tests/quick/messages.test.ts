import { expect, test } from "vitest";
import { quickErrorMessage } from "@/lib/quick/messages";

test.each([
  ["denied", "you blinked. we need read-only YouTube access to roast you."],
  ["popup_closed", "you blinked. we need read-only YouTube access to roast you."],
  ["forbidden", "youtube said no. try again in a bit, or do the full roast with your takeout file."],
  ["network", "youtube said no. try again in a bit, or do the full roast with your takeout file."],
  ["no-channel", "this google account has no youtube channel. sign in with the one you actually watch on."],
  ["no-client-id", "quick roast isn't set up yet. use the full roast."],
] as const)("%s", (code, message) => {
  expect(quickErrorMessage(code)).toBe(message);
});
