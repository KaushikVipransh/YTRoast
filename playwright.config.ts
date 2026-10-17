import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// One real-browser run of the whole Takeout flow. AI is replaced by the template generator and the DB by in-memory PGlite,
// so the test is free, offline (except the browser) and deterministic.
export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "mobile-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } }],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { DATABASE_URL: "pglite://memory", ROAST_GENERATOR: "template", NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}` },
  },
});
