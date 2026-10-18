import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ReportView } from "@/components/roast/ReportView";
import { generateTemplateRoast } from "@/lib/roast/templates";
import type { QuickSummary } from "@/lib/summary";

const quick: QuickSummary = JSON.parse(readFileSync(join(__dirname, "..", "fixtures", "quick-summary.json"), "utf8"));
const html = renderToStaticMarkup(<ReportView summary={quick} roast={generateTemplateRoast(quick)} isOwner={true} />)
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;/g, "'")
  .replace(/\s+/g, " ")
  .toLowerCase();

test("quick report shows the quick spreads", () => {
  for (const title of ["the numbers", "top channels", "subscriptions you abandoned", "playlists exposed", "that was the warm-up."]) {
    expect(html).toContain(title);
  }
  expect(html).toContain("212");
  expect(html).toContain("smosh");
  expect(html).toContain("sad hours");
});

test("quick report has none of the takeout-only spreads", () => {
  for (const title of ["the clock", "your eras", "longest binge", "what you searched", "most rewatched"]) {
    expect(html).not.toContain(title);
  }
});

test("the upsell links to the full roast", () => {
  const raw = renderToStaticMarkup(<ReportView summary={quick} roast={generateTemplateRoast(quick)} isOwner={false} />);
  expect(raw).toMatch(/href="\/roast"[^>]*>[^<]*do the full roast/);
});
