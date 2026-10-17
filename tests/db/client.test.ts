import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { getDb } from "@/lib/db/client";

afterEach(() => {
  vi.unstubAllEnvs();
  delete (globalThis as { __cwDb?: unknown }).__cwDb;
});

// Review fix M7: a failed connection or migration must not be cached for the lifetime of the server instance.
test("a failed getDb() is retried on the next call", async () => {
  vi.stubEnv("DATABASE_URL", "pglite://memory");
  const realCwd = process.cwd();
  process.chdir(mkdtempSync(join(tmpdir(), "cw-nomigrations-"))); // no drizzle/ folder here → migrate fails
  try {
    await expect(getDb()).rejects.toThrow();
  } finally {
    process.chdir(realCwd);
  }
  await expect(getDb()).resolves.toBeDefined();
}, 30_000); // boots PGlite twice (~2.5 s each under parallel load); the 5 s default flaked

// Phase 5 (review M8): an in-memory database in production would silently lose every roast.
test("pglite is refused in production", () => {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("DATABASE_URL", "pglite://memory");
  expect(() => getDb()).toThrow("pglite is not allowed in production");
});
