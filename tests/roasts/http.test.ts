import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, expect, test } from "vitest";
import type { Db } from "@/lib/db/client";
import { generateTemplateRoast } from "@/lib/roast/templates";
import { handleClaim, handleCreate, handleDelete, handleFeedback, handleUpdate, type Deps } from "@/lib/roasts/http";
import { getRoastView } from "@/lib/roasts/service";
import type { Summary } from "@/lib/summary";
import { testDb } from "../db/helpers";

const summaryJson = readFileSync(join(__dirname, "..", "..", "spike", "personas", "gym-bro.json"), "utf8");
const summary: Summary = JSON.parse(summaryJson);

let db: Db;
let generated: Summary[];
let deps: Deps;

beforeAll(async () => {
  db = await testDb();
});
beforeEach(() => {
  generated = [];
  deps = {
    db,
    generate: async (s) => {
      generated.push(s);
      return { roast: generateTemplateRoast(s), generator: "template" };
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
  const { id, cookie } = await created();
  expect((await handleDelete(withCookie(null, { method: "DELETE" }), id, deps)).status).toBe(404);
  expect((await handleDelete(withCookie(cookie, { method: "DELETE" }), id, deps)).status).toBe(200);
  expect(await getRoastView(db, id, null)).toEqual({ kind: "deleted" });
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
