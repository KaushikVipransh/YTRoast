import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

const fixture = (name: string) => strToU8(readFileSync(join(__dirname, "..", "tests", "fixtures", name), "utf8"));
const takeoutZip = Buffer.from(zipSync({ "Takeout/YouTube and YouTube Music/history/watch-history.json": fixture("watch-history.json") }));

test("keyboard: the drop zone is reachable and shows a visible focus ring", async ({ page }) => {
  await page.goto("/roast");
  const input = page.locator("input[type=file]");
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    if (await input.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(input).toBeFocused();
  const outline = await page.locator("label:has(input[type=file])").evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe("none");
});

test("keyboard: delete dialog takes focus, Escape closes it; votes have names", async ({ page }) => {
  await page.goto("/roast");
  await page.locator("input[type=file]").setInputFiles({ name: "takeout.zip", mimeType: "application/zip", buffer: takeoutZip });
  await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{12}$/, { timeout: 90_000 });

  await expect(page.getByRole("button", { name: "yes, it hit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "no, it missed" })).toBeVisible();

  const del = page.getByRole("button", { name: "delete" });
  await del.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  // The safe choice gets focus, never the destructive one (review I2): one stray Enter must not burn the roast.
  await expect(page.getByRole("button", { name: "keep" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible(); // nothing was burned
});
