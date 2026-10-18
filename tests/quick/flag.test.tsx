import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import QuickRoastPage from "@/app/roast/quick/page";
import { quickPathEnabled } from "@/lib/quick/config";

// Static render has no mounted app router: stub useRouter only, keep the real notFound().
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

test("flag off → the quick page is a 404", () => {
  vi.stubEnv("NEXT_PUBLIC_QUICK_PATH_ENABLED", "");
  expect(quickPathEnabled()).toBe(false);
  expect(() => QuickRoastPage()).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
});

test("flag on but no client id → a clear disabled message, no sign-in button", () => {
  vi.stubEnv("NEXT_PUBLIC_QUICK_PATH_ENABLED", "1");
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
  const html = renderToStaticMarkup(QuickRoastPage()).replace(/&#x27;/g, "'");
  expect(html).toContain("quick roast isn't set up yet. use the full roast.");
  expect(html).not.toContain("Sign in with Google");
});

test("flag on with a client id → the sign-in button", () => {
  vi.stubEnv("NEXT_PUBLIC_QUICK_PATH_ENABLED", "1");
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "abc.apps.googleusercontent.com");
  expect(renderToStaticMarkup(QuickRoastPage())).toContain("Sign in with Google");
});
