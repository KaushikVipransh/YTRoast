import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { RoastView } from "@/components/roast/RoastView";
import { templateNotice } from "@/lib/copy";
import { generateTemplateRoast } from "@/lib/roast/templates";
import type { Summary } from "@/lib/summary";

const summary: Summary = JSON.parse(readFileSync(join(__dirname, "..", "..", "spike", "personas", "gym-bro.json"), "utf8"));
const roast = generateTemplateRoast(summary);
const html = (isOwner: boolean) =>
  renderToStaticMarkup(<RoastView roast={roast} generator="template" isOwner={isOwner} caseId="A7F3K2" />).replace(/&#x27;/g, "'");

test("owner of a template roast sees the capacity notice", () => {
  expect(html(true)).toContain(templateNotice());
});

test("a shared viewer of a template roast sees only the stamp (phase 5 review M12)", () => {
  const out = html(false);
  expect(out).toContain("template roast");
  expect(out).not.toContain("come back later");
});

test("every roast line's evidence is circled in marker", () => {
  const out = html(true);
  const circled = [...out.matchAll(/data-evidence="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  expect(circled).toHaveLength(roast.lines.length);
  roast.lines.forEach((l, i) => expect(circled[i]).toBe(l.evidence));
});

test("roast lines are real text, marked for the reduced-motion e2e", () => {
  expect(html(true).match(/data-roast-line/g)).toHaveLength(roast.lines.length);
});
