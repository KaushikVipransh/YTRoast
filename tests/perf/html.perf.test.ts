import { expect, test } from "vitest";
import { parseWatchHtml } from "@/lib/takeout/parse-html";

// Review fix: big HTML exports must stream, not build a DOM.
test("150k-entry HTML parses in under 2.5 s", () => {
  const cell = (i: number) =>
    `<div class="outer-cell mdl-cell"><div class="mdl-grid"><div class="header-cell"><p>YouTube<br></p></div><div class="content-cell mdl-cell">Watched&nbsp;<a href="https://www.youtube.com/watch?v=id${i}">Video number ${i} with a reasonably long title</a><br><a href="https://www.youtube.com/channel/UC${i % 900}">Channel ${i % 900}</a><br>Mar 5, 2024, 3:30:00\u202fAM IST<br></div><div class="content-cell mdl-cell"></div><div class="content-cell mdl-cell mdl-typography--caption"><b>Products:</b><br>&emsp;YouTube<br></div></div></div>`;
  const html = `<html><body><div class="mdl-grid">${Array.from({ length: 150_000 }, (_, i) => cell(i)).join("")}</div></body></html>`;
  const t = performance.now();
  const { entries } = parseWatchHtml(html);
  expect(entries).toHaveLength(150_000);
  expect(performance.now() - t).toBeLessThan(2500);
});

