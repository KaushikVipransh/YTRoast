import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { defaultChain, generateRoast, repairRoast, type CallFn, type ChainStep } from "@/lib/roast/generate";
import type { RoastOutput } from "@/lib/roast/schema";
import { validateRoast } from "@/lib/roast/validate";
import type { Summary } from "@/lib/summary";

const summary: Summary = JSON.parse(readFileSync(join(__dirname, "..", "..", "spike", "personas", "gym-bro.json"), "utf8"));

const noCaptions: RoastOutput["captions"] = {
  numbers: null, topChannels: null, rewatched: null, clock: null, binge: null, searches: null, contradictions: null,
};

function goodRoast(lineCount = 7): RoastOutput {
  const evidence = ["Jeff Nippard", "Greg Doucette", "Sam Sulek", "Will Tennyson", "Joe Rogan Clips", "Chris Bumstead", "Andrew Tate Clips", "Daily Dose Of Internet"];
  return {
    headline: "a gym nerd with no gains",
    lines: evidence.slice(0, lineCount).map((e) => ({ text: `all that ${e} and still soft`, evidence: e })),
    personality: { label: "THE THEORIST", description: "knows everything, lifts nothing." },
    eras: [],
    captions: noCaptions,
  };
}

const chain: ChainStep[] = [
  { generator: "gemini", provider: "gemini", model: "g", timeoutMs: 50 },
  { generator: "gemini-lite", provider: "gemini", model: "gl", timeoutMs: 50 },
  { generator: "groq", provider: "groq", model: "q", timeoutMs: 50 },
];

const hang: CallFn = (_step, _s, signal) =>
  new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));

afterEach(() => {
  delete process.env.ROAST_GENERATOR;
});

test("first step valid → gemini, called once", async () => {
  const calls: string[] = [];
  const r = await generateRoast(summary, { chain, call: async (step) => (calls.push(step.generator), goodRoast()) });
  expect(r.generator).toBe("gemini");
  expect(calls).toEqual(["gemini"]);
});

test("first step throws → gemini-lite", async () => {
  const r = await generateRoast(summary, {
    chain,
    call: async (step) => {
      if (step.generator === "gemini") throw new Error("quota");
      return goodRoast();
    },
  });
  expect(r.generator).toBe("gemini-lite");
});

test("first step hangs → aborted, gemini-lite within 200 ms", async () => {
  let firstSignal: AbortSignal | undefined;
  const start = performance.now();
  const r = await generateRoast(summary, {
    chain,
    call: (step, s, signal) => {
      if (step.generator === "gemini") {
        firstSignal = signal;
        return hang(step, s, signal);
      }
      return Promise.resolve(goodRoast());
    },
  });
  expect(r.generator).toBe("gemini-lite");
  expect(firstSignal?.aborted).toBe(true);
  expect(performance.now() - start).toBeLessThan(200);
});

test("all steps throw → template that passes the validator", async () => {
  const r = await generateRoast(summary, { chain, call: async () => { throw new Error("down"); } });
  expect(r.generator).toBe("template");
  expect(validateRoast(r.roast, summary).ok).toBe(true);
});

test("overall deadline → template in under 200 ms", async () => {
  const start = performance.now();
  const r = await generateRoast(summary, { chain, call: hang, deadlineMs: 80 });
  expect(r.generator).toBe("template");
  expect(performance.now() - start).toBeLessThan(200);
});

test("ROAST_GENERATOR=template skips the AI", async () => {
  process.env.ROAST_GENERATOR = "template";
  let called = false;
  const r = await generateRoast(summary, { chain, call: async () => ((called = true), goodRoast()) });
  expect(r.generator).toBe("template");
  expect(called).toBe(false);
});

test("repair: em dash in a line becomes a comma", () => {
  const roast = goodRoast();
  roast.lines[0] = { text: "all that Jeff Nippard — still soft", evidence: "Jeff Nippard" };
  expect(repairRoast(roast, summary)?.lines[0].text).toBe("all that Jeff Nippard, still soft");
});

test("repair: drops one bad line out of 8", () => {
  const roast = goodRoast(8);
  roast.lines[3] = { text: "made up stuff", evidence: "PewDiePie" };
  const fixed = repairRoast(roast, summary);
  expect(fixed?.lines).toHaveLength(7);
  expect(fixed && validateRoast(fixed, summary).ok).toBe(true);
});

test("repair: cannot drop below 6 lines → null", () => {
  const roast = goodRoast(6);
  roast.lines[0] = { text: "made up stuff", evidence: "PewDiePie" };
  expect(repairRoast(roast, summary)).toBeNull();
});

test("repair: banned phrase in headline → null", () => {
  expect(repairRoast({ ...goodRoast(), headline: "let's dive in" }, summary)).toBeNull();
});

test("repair: banned phrase in a caption → caption nulled", () => {
  const fixed = repairRoast({ ...goodRoast(), captions: { ...noCaptions, clock: "it seems like you never sleep", numbers: "18432 videos" } }, summary);
  expect(fixed?.captions.clock).toBeNull();
  expect(fixed?.captions.numbers).toBe("18432 videos");
});

test("chain uses the repaired roast", async () => {
  const roast = goodRoast(8);
  roast.lines[0] = { text: "made up stuff", evidence: "PewDiePie" };
  const r = await generateRoast(summary, { chain, call: async () => roast });
  expect(r.generator).toBe("gemini");
  expect(r.roast.lines).toHaveLength(7);
});

test("chain moves on when repair fails", async () => {
  const r = await generateRoast(summary, {
    chain,
    call: async (step) => (step.generator === "gemini" ? { ...goodRoast(), headline: "let's dive in" } : goodRoast()),
  });
  expect(r.generator).toBe("gemini-lite");
});

test("defaultChain: approved order, timeouts and models", () => {
  expect(defaultChain()).toEqual([
    { generator: "gemini", provider: "gemini", model: "gemini-3.8-flash", timeoutMs: 20_000 },
    { generator: "gemini-lite", provider: "gemini", model: "gemini-3.1-flash-lite", timeoutMs: 15_000 },
    { generator: "groq", provider: "groq", model: "openai/gpt-oss-120b", timeoutMs: 15_000 },
  ]);
});
