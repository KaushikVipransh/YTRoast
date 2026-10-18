import { expect, test } from "vitest";
import { quickErrorMessage, quickServerMessage } from "@/lib/quick/messages";

test.each([
  ["denied", "you blinked. we need read-only YouTube access to roast you."],
  ["popup_closed", "you blinked. we need read-only YouTube access to roast you."],
  ["forbidden", "youtube said no. try again in a bit, or do the full roast with your takeout file."],
  ["network", "youtube said no. try again in a bit, or do the full roast with your takeout file."],
  ["no-channel", "this google account has no youtube channel. sign in with the one you actually watch on."],
  ["no-client-id", "quick roast isn't set up yet. use the full roast."],
  ["popup_blocked", "your browser blocked google's sign-in popup. allow popups for this site and tap again."],
] as const)("%s", (code, message) => {
  expect(quickErrorMessage(code)).toBe(message);
});

// Review minor (upgraded): quick users have no file to re-export.
test.each([
  [400, "something in your youtube data confused us. try again, or do the full roast."],
  [413, "your account is too big to roast in one go. do the full roast instead."],
  [429, "you've been roasted 3 times today. come back tomorrow, you need the rest."],
  [500, "the roast oven jammed. try again."],
  [0, "the roast oven jammed. try again."],
])("server status %i", (status, message) => {
  expect(quickServerMessage(status)).toBe(message);
});
