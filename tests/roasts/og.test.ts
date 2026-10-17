import { afterEach, expect, test, vi } from "vitest";
import { generateTemplateRoast } from "@/lib/roast/templates";
import { ogHeadline } from "@/lib/roasts/og";
import type { RoastView } from "@/lib/roasts/service";
import { siteUrl } from "@/lib/site";
import { buildTakeoutSummary } from "@/lib/stats/build-summary";

afterEach(() => {
  vi.unstubAllEnvs();
});

const summary = buildTakeoutSummary([{ title: "Lofi Beats", channel: "Lofi Girl", videoId: "a", time: new Date("2024-01-01T12:00:00Z") }], []);
const roast = generateTemplateRoast(summary);
const view = (visibility: "private" | "public", isOwner: boolean): RoastView => ({
  kind: "roast", id: "abc", isOwner, visibility, summary, roast, generator: "template", feedback: null, createdAt: "2024-01-01T00:00:00.000Z",
});

test("preview headline only for public roasts", () => {
  expect(ogHeadline({ kind: "missing" })).toBeNull();
  expect(ogHeadline({ kind: "deleted" })).toBeNull();
  expect(ogHeadline(view("private", true))).toBeNull();
  expect(ogHeadline(view("public", false))).toBe(roast.headline);
});

test("siteUrl: explicit env wins, then Vercel production URL, then localhost", () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://caught.example/");
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "ytroast.vercel.app");
  expect(siteUrl()).toBe("https://caught.example");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  expect(siteUrl()).toBe("https://ytroast.vercel.app");
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
  expect(siteUrl()).toBe("http://localhost:3000");
});
