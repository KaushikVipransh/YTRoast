import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

const fixture = (name: string) => strToU8(readFileSync(join(__dirname, "..", "tests", "fixtures", name), "utf8"));

const takeoutZip = Buffer.from(
  zipSync({
    "Takeout/YouTube and YouTube Music/history/watch-history.json": fixture("watch-history.json"),
    "Takeout/YouTube and YouTube Music/history/search-history.json": fixture("search-history.json"),
  }),
);

test("upload → private roast → share → secret link → burn", async ({ page, browser }) => {
  // Upload: the worker turns the zip into a summary and the API writes a (template) roast.
  await page.goto("/roast");
  await page.locator("input[type=file]").setInputFiles({ name: "takeout-20261017.zip", mimeType: "application/zip", buffer: takeoutZip });
  await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{12}$/, { timeout: 90_000 });
  const url = page.url();

  const headline = page.getByRole("heading", { level: 1 });
  await expect(headline).toBeVisible();
  const headlineText = (await headline.textContent())!.trim();
  await expect(page.getByText("only you can see this")).toBeVisible();
  await expect(page.getByText("template roast", { exact: true })).toBeVisible();

  // A stranger can't see a private roast; it looks exactly like a missing one.
  const strangerContext = await browser.newContext();
  const stranger = await strangerContext.newPage();
  await stranger.goto(url);
  await expect(stranger.getByText("nothing here. or someone's hiding something.")).toBeVisible();
  await expect(stranger.getByText(headlineText)).toHaveCount(0);

  // Owner shares → the stranger sees the roast and the call to action.
  await page.getByRole("button", { name: "share", exact: true }).click();
  await expect(page.getByRole("button", { name: "make private" })).toBeVisible();
  await stranger.reload();
  await expect(stranger.getByRole("heading", { level: 1 })).toHaveText(headlineText);
  await expect(stranger.getByText("roast me next")).toBeVisible();
  await expect(stranger.getByRole("complementary", { name: "owner controls" })).toHaveCount(0);

  // The secret link gives ownership back on a fresh browser.
  const secretLink = (await page.getByTestId("secret-link").textContent())!.trim();
  expect(secretLink).toMatch(/\/claim#key=[A-Za-z0-9_-]{43}$/); // key in the fragment: never sent to the server
  const rescuedContext = await browser.newContext();
  const rescued = await rescuedContext.newPage();
  await rescued.goto(secretLink);
  await expect(rescued).toHaveURL(url);
  await expect(rescued.getByRole("complementary", { name: "owner controls" })).toBeVisible();

  // Links saved before the key moved into the fragment (?key=) still restore ownership.
  const legacyContext = await browser.newContext();
  const legacy = await legacyContext.newPage();
  await legacy.goto(secretLink.replace("#key=", "?key="));
  await expect(legacy).toHaveURL(url);
  await expect(legacy.getByRole("complementary", { name: "owner controls" })).toBeVisible();
  await legacyContext.close();

  // Burn it: everyone now sees the tombstone.
  await page.getByRole("button", { name: "delete" }).click();
  await page.getByRole("button", { name: "burn it" }).click();
  await expect(page.getByText("this file was burned.")).toBeVisible();
  await stranger.reload();
  await expect(stranger.getByText("this file was burned.")).toBeVisible();

  await strangerContext.close();
  await rescuedContext.close();
});

test("wrong file → specific error, no roast", async ({ page }) => {
  await page.goto("/roast");
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "package.json", mimeType: "application/json", buffer: Buffer.from('{"name":"x"}') });
  await expect(page.getByText("that's not your watch history, that's package.json.")).toBeVisible();
  await expect(page).toHaveURL(/\/roast$/);
});

test("reduced motion shows everything at once and nothing spins", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/roast");
  await page.locator("input[type=file]").setInputFiles({ name: "takeout.zip", mimeType: "application/zip", buffer: takeoutZip });
  await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{12}$/, { timeout: 90_000 });

  // Every roast line is fully opaque immediately, including the ones below the fold.
  const lines = page.locator("[data-roast-line]");
  await expect(lines.first()).toBeVisible();
  const opacities = await lines.evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity));
  expect(opacities.length).toBeGreaterThanOrEqual(6);
  expect(new Set(opacities)).toEqual(new Set(["1"]));

  // The "scroll for your full file" hint doesn't bounce (review I3).
  const hint = await page.getByText("scroll for your full file").evaluate((el) => el.getAnimations().length);
  expect(hint).toBe(0);

  // The stamp doesn't rotate.
  const running = await page.locator("[data-stamp]").first().evaluate((el) => el.getAnimations().length);
  expect(running).toBe(0);
  await context.close();
});

test("with motion allowed the stamp does spin (guards the reduced-motion test from passing vacuously)", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "no-preference" });
  const page = await context.newPage();
  await page.goto("/");
  const running = await page.locator("[data-stamp]").first().evaluate((el) => el.getAnimations().length);
  expect(running).toBeGreaterThan(0);
  await context.close();
});
