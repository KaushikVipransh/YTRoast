import { expect, test } from "vitest";
import { seededTilt } from "@/lib/zine/tilt";

test("seededTilt is deterministic and bounded", () => {
  expect(seededTilt("abc", 12)).toBe(seededTilt("abc", 12));
  for (let i = 0; i < 1000; i++) {
    const t = seededTilt(`seed-${i}`, 3);
    expect(t).toBeGreaterThanOrEqual(-3);
    expect(t).toBeLessThanOrEqual(3);
    expect(Math.round(t * 10)).toBe(t * 10);
  }
});

test("different seeds usually tilt differently", () => {
  const values = new Set(Array.from({ length: 1000 }, (_, i) => seededTilt(`s${i}`, 12)));
  expect(values.size).toBeGreaterThan(200); // 241 possible values at 0.1° steps
});
