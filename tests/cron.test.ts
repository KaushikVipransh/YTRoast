import { afterEach, beforeAll, expect, test, vi } from "vitest";
import type { Db } from "@/lib/db/client";
import { handleKeepalive } from "@/lib/cron";
import { testDb } from "./db/helpers";

// One in-memory Postgres for the file: booting PGlite per test exceeded the 5 s test timeout under load.
let db: Db;
beforeAll(async () => {
  db = await testDb();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const req = (auth?: string) => new Request("http://test/api/cron/keepalive", { headers: auth ? { authorization: auth } : {} });

test("keepalive: wrong or missing secret → 401", async () => {
  vi.stubEnv("CRON_SECRET", "s3cret");
  expect((await handleKeepalive(req(), { db })).status).toBe(401);
  expect((await handleKeepalive(req("Bearer nope"), { db })).status).toBe(401);
});

test("keepalive: correct secret → 200 after touching the database", async () => {
  vi.stubEnv("CRON_SECRET", "s3cret");
  const res = await handleKeepalive(req("Bearer s3cret"), { db });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});

test("keepalive: no CRON_SECRET configured → 401 (fail closed)", async () => {
  vi.stubEnv("CRON_SECRET", "");
  expect((await handleKeepalive(req("Bearer "), { db })).status).toBe(401);
});
