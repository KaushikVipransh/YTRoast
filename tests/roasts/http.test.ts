import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, expect, test } from "vitest";
import type { Db } from "@/lib/db/client";
import { generateTemplateRoast } from "@/lib/roast/templates";
import { clientIp, handleClaim, handleCreate, handleDelete, handleFeedback, handleUpdate, makeVisitorLimit, type Deps } from "@/lib/roasts/http";
import { memoryStore } from "@/lib/limits/limiter";
import { getRoastView } from "@/lib/roasts/service";
import type { Summary } from "@/lib/summary";
import { testDb } from "../db/helpers";

const summaryJson = readFileSync(join(__dirname, "..", "..", "spike", "personas", "gym-bro.json"), "utf8");
const summary: Summary = JSON.parse(summaryJson);

let db: Db;
let generated: Summary[];
let limited: string[];
let allow: boolean;
let deps: Deps;

beforeAll(async () => {
  db = await testDb();
});
beforeEach(() => {
  generated = [];
  limited = [];
  allow = true;
  deps = {
    db,
    limit: async (ip) => (limited.push(ip), allow),
    generate: async (s) => {
      generated.push(s);
      return { roast: generateTemplateRoast(s), generator: "template", ovenFull: false };
    },
  };
});

const post = (body: string) => new Request("http://test/api/roast", { method: "POST", body });
const withCookie = (cookie: string | null, init: RequestInit = {}, url = "http://test/api/roast/x") =>
  new Request(url, { ...init, headers: cookie ? { cookie } : {} });

/** Creates a roast through the API; returns its id and the owner's cookie pair. */
async function created() {
  const res = await handleCreate(post(summaryJson), deps);
  const { id } = (await res.json()) as { id: string };
  const cookie = res.headers.get("set-cookie")!.split(";")[0];
  return { id, cookie, token: cookie.split("=")[1] };
}

// ---------- create ----------

test("create: 201 {id} and an httpOnly owner cookie; token not in the body", async () => {
  const res = await handleCreate(post(summaryJson), deps);
  expect(res.status).toBe(201);
  const text = await res.text();
  const { id } = JSON.parse(text);
  const setCookie = res.headers.get("set-cookie")!;
  expect(setCookie).toMatch(new RegExp(`^cw_o_${id}=[A-Za-z0-9_-]{43}; `));
  expect(setCookie).toContain("HttpOnly");
  expect(text).not.toContain(setCookie.split(";")[0].split("=")[1]);
  expect(generated).toHaveLength(1);
});

test("create: malformed JSON → 400 bad-json", async () => {
  const res = await handleCreate(post("{nope"), deps);
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: "bad-json" });
  expect(generated).toHaveLength(0);
});

test("create: invalid summary → 400 bad-summary, AI never called", async () => {
  const res = await handleCreate(post(JSON.stringify({ ...summary, hours: [1, 2, 3] })), deps);
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: "bad-summary" });
  expect(generated).toHaveLength(0);
});

test("create: body over 64,000 bytes → 413, AI never called", async () => {
  const res = await handleCreate(post(JSON.stringify({ ...summary, padding: "x".repeat(70_000) })), deps);
  expect(res.status).toBe(413);
  expect(generated).toHaveLength(0);
});

// ---------- update / delete ----------

test("update: no cookie or wrong cookie → 404", async () => {
  const { id } = await created();
  const body = JSON.stringify({ visibility: "public" });
  expect((await handleUpdate(withCookie(null, { method: "PATCH", body }), id, deps)).status).toBe(404);
  expect((await handleUpdate(withCookie(`cw_o_${id}=wrong`, { method: "PATCH", body }), id, deps)).status).toBe(404);
});

test("update: owner can share; strangers then see it", async () => {
  const { id, cookie } = await created();
  const res = await handleUpdate(withCookie(cookie, { method: "PATCH", body: JSON.stringify({ visibility: "public" }) }), id, deps);
  expect(res.status).toBe(200);
  expect(await getRoastView(db, id, null)).toMatchObject({ kind: "roast", visibility: "public" });
});

test("update: invalid visibility → 400", async () => {
  const { id, cookie } = await created();
  const res = await handleUpdate(withCookie(cookie, { method: "PATCH", body: JSON.stringify({ visibility: "secret" }) }), id, deps);
  expect(res.status).toBe(400);
});

test("delete: owner burns it; no cookie → 404", async () => {
  const { id, cookie, token } = await created();
  expect((await handleDelete(withCookie(null, { method: "DELETE" }), id, deps)).status).toBe(404);
  expect((await handleDelete(withCookie(cookie, { method: "DELETE" }), id, deps)).status).toBe(200);
  expect(await getRoastView(db, id, token)).toEqual({ kind: "deleted" });
  // It was never shared, so strangers still can't tell it existed.
  expect(await getRoastView(db, id, null)).toEqual({ kind: "missing" });
});

// ---------- feedback ----------

test("feedback: owner can vote; invalid value → 400", async () => {
  const { id, cookie, token } = await created();
  expect((await handleFeedback(withCookie(cookie, { method: "POST", body: JSON.stringify({ value: 1 }) }), id, deps)).status).toBe(200);
  expect(await getRoastView(db, id, token)).toMatchObject({ feedback: 1 });
  expect((await handleFeedback(withCookie(cookie, { method: "POST", body: JSON.stringify({ value: 5 }) }), id, deps)).status).toBe(400);
});

// ---------- claim ----------

test("claim: correct key sets the owner cookie and redirects", async () => {
  const { id, token } = await created();
  const res = await handleClaim(new Request(`http://test/r/${id}/claim?key=${token}`), id, deps);
  expect(res.status).toBe(307);
  expect(new URL(res.headers.get("location")!).pathname).toBe(`/r/${id}`);
  expect(res.headers.get("set-cookie")).toContain(`cw_o_${id}=${token}`);
});

test("claim: wrong key or unknown id → redirect without cookie", async () => {
  const { id } = await created();
  const wrong = await handleClaim(new Request(`http://test/r/${id}/claim?key=nope`), id, deps);
  expect(wrong.status).toBe(307);
  expect(wrong.headers.get("set-cookie")).toBeNull();
  const unknown = await handleClaim(new Request(`http://test/r/doesnotexist/claim?key=nope`), "doesnotexist", deps);
  expect(unknown.status).toBe(307);
  expect(unknown.headers.get("set-cookie")).toBeNull();
});

// ---------- Phase 5: per-visitor limit ----------

test("create: over the daily limit → 429, AI never called, nothing written", async () => {
  allow = false;
  const res = await handleCreate(new Request("http://test/api/roast", { method: "POST", body: summaryJson, headers: { "x-real-ip": "1.2.3.4" } }), deps);
  expect(res.status).toBe(429);
  expect(await res.json()).toEqual({ error: "rate-limited" });
  expect(generated).toHaveLength(0);
  expect(limited).toEqual(["1.2.3.4"]);
});

test("create: an invalid summary does not use up a slot", async () => {
  await handleCreate(post(JSON.stringify({ nope: true })), deps);
  expect(limited).toEqual([]);
});

test("create: content-length over 64,000 → 413 before reading the body", async () => {
  const req = new Request("http://test/api/roast", { method: "POST", body: "{}", headers: { "content-length": "999999" } });
  const res = await handleCreate(req, deps);
  expect(res.status).toBe(413);
  expect(req.bodyUsed).toBe(false);
});

test("create: 201 body says whether the oven was full", async () => {
  const res = await handleCreate(post(summaryJson), deps);
  expect(await res.json()).toMatchObject({ ovenFull: false });
});

test("clientIp: platform header wins over a spoofable forwarded chain", () => {
  const h = (headers: Record<string, string>) => new Request("http://test", { headers });
  expect(clientIp(h({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "6.6.6.6, 9.9.9.9" }))).toBe("9.9.9.9");
  expect(clientIp(h({ "x-forwarded-for": "6.6.6.6, 1.1.1.1" }))).toBe("6.6.6.6");
  expect(clientIp(h({}))).toBe("unknown");
});

test("makeVisitorLimit: 3 per day with the memory store", async () => {
  const limit = makeVisitorLimit(memoryStore(), 3);
  expect([await limit("a"), await limit("a"), await limit("a"), await limit("a")]).toEqual([true, true, true, false]);
  expect(await limit("b")).toBe(true);
});
