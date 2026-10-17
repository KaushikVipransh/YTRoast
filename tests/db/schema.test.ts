import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { roasts } from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import { generateTemplateRoast } from "@/lib/roast/templates";
import type { Summary } from "@/lib/summary";
import { testDb } from "./helpers";

const summary: Summary = JSON.parse(readFileSync(join(__dirname, "..", "..", "spike", "personas", "thin-data.json"), "utf8"));
const roast = generateTemplateRoast(summary);
const base = { ownerHash: "h", source: "takeout" as const, summary, roast, generator: "template" as const };

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

test("insert and select round-trips JSONB, defaults visibility and createdAt", async () => {
  await db.insert(roasts).values({ id: "r1", ...base });
  const [row] = await db.select().from(roasts).where(eq(roasts.id, "r1"));
  expect(row.summary).toEqual(summary);
  expect(row.roast).toEqual(roast);
  expect(row.visibility).toBe("private");
  expect(row.createdAt).toBeInstanceOf(Date);
  expect(row.deletedAt).toBeNull();
});

test.each<[string, Record<string, unknown>]>([
  ["visibility 'secret'", { visibility: "secret" }],
  ["generator 'openai'", { generator: "openai" }],
  ["source 'tiktok'", { source: "tiktok" }],
  ["feedback 2", { feedback: 2 }],
  ["deleted but content kept", { deletedAt: new Date() }],
  ["live but content missing", { summary: null }],
])("rejects %s", async (_, patch) => {
  await expect(db.insert(roasts).values({ id: `bad-${Math.random()}`, ...base, ...patch } as typeof roasts.$inferInsert)).rejects.toThrow();
});

test("a tombstone (deleted, no content) is allowed", async () => {
  await db.insert(roasts).values({ id: "t1", ...base, summary: null, roast: null, deletedAt: new Date() });
  const [row] = await db.select().from(roasts).where(eq(roasts.id, "t1"));
  expect(row.summary).toBeNull();
});
