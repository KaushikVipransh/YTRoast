import { expect, test, type Page } from "@playwright/test";
import { fakeYouTube } from "../tests/quick/youtube-fake";

// A stand-in for Google Identity Services: the token client answers with whatever window.__gisResponse holds
// (an access token by default) and records revocations, so the whole quick flow runs without real Google.
const FAKE_GIS = `
window.google = { accounts: { oauth2: {
  initTokenClient(cfg) {
    return { requestAccessToken() { setTimeout(() => cfg.callback(window.__gisResponse || { access_token: "fake-token" }), 20); } };
  },
  revoke(token, done) { window.__revoked = token; if (done) done(); },
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

test("quick roast: sign in → roasted from likes and subs → warm-up upsell; token revoked", async ({ page }) => {
  await fakeGoogle(page);
  await page.goto("/roast/quick");
  await page.getByRole("button", { name: /sign in with google/i }).click();
  await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{12}$/, { timeout: 90_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("that was the", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /do the full roast/ })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __revoked?: string }).__revoked)).toBe("fake-token");
});

test("quick roast: denied access → 'you blinked' with a way to try again", async ({ page }) => {
  await fakeGoogle(page);
  await page.addInitScript(() => {
    (window as unknown as { __gisResponse: object }).__gisResponse = { error: "access_denied" };
  });
  await page.goto("/roast/quick");
  await page.getByRole("button", { name: /sign in with google/i }).click();
  await expect(page.getByText("you blinked. we need read-only YouTube access to roast you.")).toBeVisible();
  await expect(page.getByRole("button", { name: /try again/i })).toBeVisible();
});
