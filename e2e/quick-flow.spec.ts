import { expect, test, type Page } from "@playwright/test";
import { fakeYouTube } from "../tests/quick/youtube-fake";

// A stand-in for Google Identity Services. The token client answers with window.__gisResponse (an access token
// by default), or calls error_callback with window.__gisError (e.g. a blocked popup); revocations are timestamped.
const FAKE_GIS = `
window.google = { accounts: { oauth2: {
  initTokenClient(cfg) {
    return { requestAccessToken() {
      setTimeout(() => window.__gisError ? cfg.error_callback(window.__gisError) : cfg.callback(window.__gisResponse || { access_token: "fake-token" }), 20);
    } };
  },
  revoke(token, done) { window.__revoked = token; window.__revokedAt = Date.now(); if (done) done(); },
} } };`;

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization", "access-control-allow-methods": "GET" };

async function fakeGoogle(page: Page) {
  await page.route("https://accounts.google.com/gsi/client", (route) => route.fulfill({ contentType: "text/javascript", body: FAKE_GIS }));
  const { fetchFn } = fakeYouTube({ likes: 40, subs: 25, playlists: 2, itemsPerPlaylist: 4 });
  await page.route("https://www.googleapis.com/youtube/v3/**", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const res = await fetchFn(route.request().url(), { headers: route.request().headers() });
    return route.fulfill({ status: res.status, headers: { ...CORS, "content-type": "application/json" }, body: await res.text() });
  });
}

type FakeWindow = { __revoked?: string; __revokedAt?: number; __gisResponse?: object; __gisError?: object };

test("quick roast: sign in → roasted from likes and subs → warm-up upsell; token revoked before the roast request", async ({ page }) => {
  await fakeGoogle(page);
  let postAt = 0;
  page.on("request", (req) => {
    if (req.url().endsWith("/api/roast") && req.method() === "POST") postAt = Date.now();
  });
  await page.goto("/roast/quick");
  await page.getByRole("button", { name: /sign in with google/i }).click();
  await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{12}$/, { timeout: 90_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("that was the", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /do the full roast/ })).toBeVisible();
  // The heavy totals come through as real numbers, not the fetch caps (fake API: 40 likes, 25 subs).
  await expect(page.getByText("40", { exact: true }).first()).toBeVisible();

  // Revoked as soon as the likes were read: before the (slow) roast request, not after it.
  const fake = await page.evaluate(() => {
    const w = window as unknown as FakeWindow;
    return { __revoked: w.__revoked, __revokedAt: w.__revokedAt };
  });
  expect(fake.__revoked).toBe("fake-token");
  expect(fake.__revokedAt).toBeLessThanOrEqual(postAt);
});

test("quick roast: denied access → 'you blinked', focus lands on try again", async ({ page }) => {
  await fakeGoogle(page);
  await page.addInitScript(() => {
    (window as unknown as FakeWindow).__gisResponse = { error: "access_denied" };
  });
  await page.goto("/roast/quick");
  await page.getByRole("button", { name: /sign in with google/i }).click();
  await expect(page.getByText("you blinked. we need read-only YouTube access to roast you.")).toBeVisible();
  await expect(page.getByRole("button", { name: /try again/i })).toBeFocused();
});

test("quick roast: a blocked popup says so (not 'you blinked')", async ({ page }) => {
  await fakeGoogle(page);
  await page.addInitScript(() => {
    (window as unknown as FakeWindow).__gisError = { type: "popup_failed_to_open" };
  });
  await page.goto("/roast/quick");
  await page.getByRole("button", { name: /sign in with google/i }).click();
  await expect(page.getByText("your browser blocked google's sign-in popup. allow popups for this site and tap again.")).toBeVisible();
});
