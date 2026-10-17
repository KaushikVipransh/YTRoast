import { afterEach, expect, test, vi } from "vitest";
import { QUOTA_ERROR, makeProviderGate, utcDay } from "@/lib/limits/budget";
import { failOpen, memoryStore } from "@/lib/limits/limiter";

afterEach(() => {
  vi.useRealTimers();
});

test("memoryStore counts and expires", async () => {
  let now = 0;
  const store = memoryStore(() => now);
  expect(await store.incr("k", 10)).toBe(1);
  expect(await store.incr("k", 10)).toBe(2);
  expect(await store.get("k")).toBe(2);
  now = 11_000;
  expect(await store.get("k")).toBe(0);
  expect(await store.incr("k", 10)).toBe(1);
  await store.set("s", 5, 1);
  expect(await store.get("s")).toBe(5);
});

test("failOpen: a hung promise falls back after ~1 s", async () => {
  vi.useFakeTimers();
  const p = failOpen(new Promise<number>(() => {}), 7, "test");
  vi.advanceTimersByTime(1_001);
  await expect(p).resolves.toBe(7);
});

test("failOpen: a rejection falls back", async () => {
  await expect(failOpen(Promise.reject(new Error("down")), "fb", "test")).resolves.toBe("fb");
});

test("utcDay uses the UTC calendar day", () => {
  expect(utcDay(new Date("2026-10-18T23:59:59+05:30"))).toBe("2026-10-18");
  expect(utcDay(new Date("2026-10-19T00:30:00+05:30"))).toBe("2026-10-18");
  expect(utcDay(new Date("2026-10-19T05:30:00+05:30"))).toBe("2026-10-19");
});

test("gate: budget per UTC day", async () => {
  let now = new Date("2026-10-18T10:00:00Z");
  const gate = makeProviderGate(memoryStore(() => now.getTime()), { gemini: 2, "gemini-lite": 400, groq: 40 }, () => now);
  expect(await gate.canUse("gemini")).toBe(true);
  await gate.recordCall("gemini");
  expect(await gate.canUse("gemini")).toBe(true);
  await gate.recordCall("gemini");
  expect(await gate.canUse("gemini")).toBe(false);
  expect(await gate.canUse("groq")).toBe(true);
  now = new Date("2026-10-19T00:01:00Z");
  expect(await gate.canUse("gemini")).toBe(true);
});

test("gate: quota error → 10-minute cooldown", async () => {
  let now = new Date("2026-10-18T10:00:00Z");
  const gate = makeProviderGate(memoryStore(() => now.getTime()), { gemini: 99, "gemini-lite": 99, groq: 99 }, () => now);
  await gate.recordQuotaError("groq");
  expect(await gate.canUse("groq")).toBe(false);
  now = new Date("2026-10-18T10:09:00Z");
  expect(await gate.canUse("groq")).toBe(false);
  now = new Date("2026-10-18T10:10:01Z");
  expect(await gate.canUse("groq")).toBe(true);
});

test.each([
  ["You exceeded your current quota, please check your plan", true],
  ["Rate limit reached for model `openai/gpt-oss-120b`", true],
  ["This model is currently experiencing high demand.", true],
  ["status 429", true],
  ["The model is overloaded", true],
  ["timed out after 25000 ms", false],
  ["output did not pass validation", false],
])("QUOTA_ERROR %s → %s", (msg, expected) => {
  expect(QUOTA_ERROR.test(msg)).toBe(expected);
});
