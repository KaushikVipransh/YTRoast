import { expect, test } from "vitest";
import { clockBars } from "@/lib/zine/clock";

const R = { inner: 40, outer: 100 };

test("always 24 bars; late = 12am–4am", () => {
  const bars = clockBars(Array(24).fill(1), R);
  expect(bars).toHaveLength(24);
  expect(bars.filter((b) => b.late).map((b) => b.hour)).toEqual([0, 1, 2, 3, 4]);
});

test("the busiest hour reaches the outer radius, an empty hour stays at the inner one", () => {
  const hours = Array(24).fill(0);
  hours[3] = 10;
  hours[15] = 5;
  const bars = clockBars(hours, R);
  expect(bars[3].tip).toBe(100);
  expect(bars[15].tip).toBe(70);
  expect(bars[9].tip).toBe(40);
});

test("all-zero data draws without NaN", () => {
  const bars = clockBars(Array(24).fill(0), R);
  for (const b of bars) {
    expect(b.path).not.toMatch(/NaN/);
    expect(b.tip).toBe(40);
  }
});

test("midnight points straight up", () => {
  const hours = Array(24).fill(0);
  hours[0] = 1;
  const [x, y] = clockBars(hours, R)[0].path.match(/-?[\d.]+/g)!.slice(2, 4).map(Number);
  expect(Math.abs(x)).toBeLessThan(15);
  expect(y).toBeLessThan(-90);
});
