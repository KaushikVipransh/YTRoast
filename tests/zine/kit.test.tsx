import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Band } from "@/components/zine/Band";
import { Button } from "@/components/zine/Button";
import { GraphPatch, Sparkle, Tape } from "@/components/zine/decor";
import { CrtTv, CrumpledPaper, EvidenceBag, VhsTape } from "@/components/zine/illustrations";
import { RansomStrip } from "@/components/zine/RansomStrip";
import { Stamp } from "@/components/zine/Stamp";
import { Sticker } from "@/components/zine/Sticker";
import { VhsLoader } from "@/components/zine/VhsLoader";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

test.each([
  ["Sticker", <Sticker key="s" seed="a">BRO.</Sticker>],
  ["Stamp", <Stamp key="st" text="OFFICIALLY ROASTED · NO REFUNDS · " center="🔥" />],
  ["Sparkle", <Sparkle key="sp" size={24} color="sky" seed="x" />],
  ["Tape", <Tape key="t" seed="x" />],
  ["GraphPatch", <GraphPatch key="g" />],
  ["VhsTape", <VhsTape key="v" />],
  ["CrtTv", <CrtTv key="c" />],
  ["CrumpledPaper", <CrumpledPaper key="cp" />],
  ["EvidenceBag", <EvidenceBag key="e" />],
])("%s is decoration (aria-hidden)", (_, el) => {
  expect(html(el)).toMatch(/^<[a-z]+[^>]*aria-hidden="true"/);
});

test("Sticker tilt is stable for a seed", () => {
  expect(html(<Sticker seed="same">X</Sticker>)).toBe(html(<Sticker seed="same">X</Sticker>));
});

test("Button is a real button with a 56px minimum height", () => {
  const out = html(<Button variant="primary">roast me</Button>);
  expect(out).toMatch(/^<button/);
  expect(out).toContain("min-h-14");
});

test("VhsLoader announces its status", () => {
  const out = html(<VhsLoader status="found the 3am stuff…" detail="48,213 videos" />);
  expect(out).toContain('role="status"');
  expect(out).toContain("found the 3am stuff…");
});

test("RansomStrip tilts alternate", () => {
  const rot = (i: number) => html(<RansomStrip index={i}>line</RansomStrip>).match(/rotate\((-?[\d.]+)deg\)/)?.[1];
  expect(Number(rot(0))).toBeGreaterThan(0);
  expect(Number(rot(1))).toBeLessThan(0);
});

test("Band renders its children inside a toned section", () => {
  expect(html(<Band tone="butter">hi</Band>)).toContain("bg-butter");
});
