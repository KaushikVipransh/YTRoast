import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import type { Db } from "@/lib/db/client";
import { roasts } from "@/lib/db/schema";
import { generateTemplateRoast } from "@/lib/roast/templates";
import { createRoast, deleteRoast, getRoastView, setFeedback, setVisibility } from "@/lib/roasts/service";
import type { Summary } from "@/lib/summary";
import { testDb } from "../db/helpers";

const summary: Summary = JSON.parse(readFileSync(join(__dirname, "..", "..", "spike", "personas", "gym-bro.json"), "utf8"));
const roast = generateTemplateRoast(summary);

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

const make = () => createRoast(db, { summary, roast, generator: "template" });

test("create: 12-char id, token never stored", async () => {
  const { id, ownerToken } = await make();
  expect(id).toMatch(/^[A-Za-z0-9_-]{12}$/);
  const [row] = await db.select().from(roasts).where(eq(roasts.id, id));
  expect(row.ownerHash).not.toBe(ownerToken);
  expect(JSON.stringify(row)).not.toContain(ownerToken);
});

test("private by default: owner sees it, strangers and wrong tokens see missing", async () => {
  const { id, ownerToken } = await make();
  expect(await getRoastView(db, id, ownerToken)).toMatchObject({ kind: "roast", isOwner: true, visibility: "private", generator: "template" });
  expect(await getRoastView(db, id, null)).toEqual({ kind: "missing" });
  expect(await getRoastView(db, id, "wrong-token")).toEqual({ kind: "missing" });
  expect(await getRoastView(db, "doesnotexist", null)).toEqual({ kind: "missing" });
});

test("public roast is visible to strangers, not as owner", async () => {
  const { id, ownerToken } = await make();
  expect(await setVisibility(db, id, ownerToken, "public")).toBe("ok");
  const view = await getRoastView(db, id, null);
  expect(view).toMatchObject({ kind: "roast", isOwner: false, visibility: "public" });
  if (view.kind === "roast") expect(view.roast).toEqual(roast);
  expect(await setVisibility(db, id, ownerToken, "private")).toBe("ok");
  expect(await getRoastView(db, id, null)).toEqual({ kind: "missing" });
});

test("wrong token cannot change anything", async () => {
  const { id, ownerToken } = await make();
  expect(await setVisibility(db, id, "nope", "public")).toBe("forbidden");
  expect(await setVisibility(db, id, null, "public")).toBe("forbidden");
  expect(await deleteRoast(db, id, "nope")).toBe("forbidden");
  expect(await setFeedback(db, id, "nope", 1)).toBe("forbidden");
  expect(await getRoastView(db, id, ownerToken)).toMatchObject({ kind: "roast", visibility: "private", feedback: null });
});

test("unknown id → missing for owner actions", async () => {
  expect(await setVisibility(db, "doesnotexist", "t", "public")).toBe("missing");
});

test("delete wipes content and leaves a tombstone everyone sees as deleted", async () => {
  const { id, ownerToken } = await make();
  await setVisibility(db, id, ownerToken, "public");
  expect(await deleteRoast(db, id, ownerToken)).toBe("ok");
  const [row] = await db.select().from(roasts).where(eq(roasts.id, id));
  expect(row.summary).toBeNull();
  expect(row.roast).toBeNull();
  expect(row.deletedAt).toBeInstanceOf(Date);
  expect(await getRoastView(db, id, null)).toEqual({ kind: "deleted" });
  expect(await getRoastView(db, id, ownerToken)).toEqual({ kind: "deleted" });
  expect(await deleteRoast(db, id, ownerToken)).toBe("missing");
  expect(await setVisibility(db, id, ownerToken, "private")).toBe("missing");
  expect(await setFeedback(db, id, ownerToken, 1)).toBe("missing");
});

test("feedback is stored and shown to the owner", async () => {
  const { id, ownerToken } = await make();
  expect(await setFeedback(db, id, ownerToken, -1)).toBe("ok");
  expect(await getRoastView(db, id, ownerToken)).toMatchObject({ feedback: -1 });
});

// Review fix M1: a deleted private roast must look missing to strangers, like any private roast.
test("deleted private roast: owner sees burned, strangers see missing", async () => {
  const { id, ownerToken } = await make();
  await deleteRoast(db, id, ownerToken);
  expect(await getRoastView(db, id, ownerToken)).toEqual({ kind: "deleted" });
  expect(await getRoastView(db, id, null)).toEqual({ kind: "missing" });
});

// Phase 3 review fix 1: the source column must say which path made the roast (it outlives a delete).
test("a quick roast is stored with source 'quick'", async () => {
  const quick = JSON.parse(readFileSync(join(__dirname, "..", "fixtures", "quick-summary.json"), "utf8"));
  const { id } = await createRoast(db, { summary: quick, roast: generateTemplateRoast(quick), generator: "template" });
  const [row] = await db.select().from(roasts).where(eq(roasts.id, id));
  expect(row.source).toBe("quick");
});
