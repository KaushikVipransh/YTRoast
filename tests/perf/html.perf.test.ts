import { expect, test } from "vitest";
import { parseWatchHtml } from "@/lib/takeout/parse-html";

// Big HTML exports must stream, not build a DOM. Wall-clock time swings 2–5 s with laptop power state
// (measured 2026-10-18: ~2 s on mains, ~5 s throttled on battery, for unchanged code), so time only
// guards against quadratic blow-ups. Memory is the real signal: the old DOM build added ~1 GB of heap.
test("150k-entry HTML streams: bounded memory, no quadratic time", () => {
  const cell = (i: number) =>
    `<div class="outer-cell mdl-cell"><div class="mdl-grid"><div class="header-cell"><p>YouTube<br></p></div><div class="content-cell mdl-cell">Watched&nbsp;<a href="https://www.youtube.com/watch?v=id${i}">Video number ${i} with a reasonably long title</a><br><a href="https://www.youtube.com/channel/UC${i % 900}">Channel ${i % 900}</a><br>Mar 5, 2024, 3:30:00 AM IST<br></div><div class="content-cell mdl-cell"></div><div class="content-cell mdl-cell mdl-typography--caption"><b>Products:</b><br>&emsp;YouTube<br></div></div></div>`;
  const html = `<html><body><div class="mdl-grid">${Array.from({ length: 150_000 }, (_, i) => cell(i)).join("")}</div></body></html>`;

  const heapBefore = process.memoryUsage().heapUsed;
  let peak = heapBefore;
  const sampler = setInterval(() => (peak = Math.max(peak, process.memoryUsage().heapUsed)), 5);
  const t = performance.now();
  const { entries } = parseWatchHtml(html);
  const elapsed = performance.now() - t;
  clearInterval(sampler);
  peak = Math.max(peak, process.memoryUsage().heapUsed);

  expect(entries).toHaveLength(150_000);
  expect(peak - heapBefore).toBeLessThan(400 * 1024 * 1024);
  expect(elapsed).toBeLessThan(10_000);
  console.log(`[perf] html 150k: ${Math.round(elapsed)} ms, heap +${Math.round((peak - heapBefore) / 1048576)} MB`);
});
