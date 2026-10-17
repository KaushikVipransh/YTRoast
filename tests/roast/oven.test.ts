import { expect, test } from "vitest";
import { templateNotice } from "@/lib/copy";

test("template notice copy (design §5.10)", () => {
  expect(templateNotice()).toBe(
    "too many people getting roasted right now. here's a quick one from your stats, come back later for the real thing.",
  );
});
