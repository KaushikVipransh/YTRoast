// Route logic as plain (Request, deps) → Response functions, so tests can run them against PGlite
// with a fake generator. The files under src/app only wire in the real DB and generation chain.
import { Ratelimit } from "@upstash/ratelimit";
import type { Db } from "@/lib/db/client";
import { utcDay } from "@/lib/limits/budget";
import { failOpen, type Store } from "@/lib/limits/limiter";
import type { Generator } from "@/lib/roast/generate";
import type { RoastOutput } from "@/lib/roast/schema";
import type { Summary } from "@/lib/summary";
import { parseSummary } from "@/lib/summary-schema";
import { ownerCookie, readOwnerToken } from "./ownership";
import { createRoast, deleteRoast, isRoastOwner, setFeedback, setVisibility, type OwnerResult } from "./service";

export type Deps = {
  db: Db;
  generate: (s: Summary) => Promise<{ roast: RoastOutput; generator: Generator; ovenFull: boolean }>;
  /** true = this visitor may create another roast now */
  limit: (ip: string) => Promise<boolean>;
};

/** On Vercel, x-real-ip is set by the platform; x-forwarded-for can carry client-supplied entries. */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/** Roasts per visitor per day (PRD F21). Sliding window on Upstash, a per-UTC-day counter otherwise. Fails open. */
export function makeVisitorLimit(store: Store, perDay: number): (ip: string) => Promise<boolean> {
  const ratelimit = store.redis
    ? new Ratelimit({ redis: store.redis, limiter: Ratelimit.slidingWindow(perDay, "1 d"), prefix: "cw:rl" })
    : null;
  return (ip) =>
    failOpen(
      ratelimit
        ? ratelimit.limit(ip).then((r) => r.success)
        : store.incr(`cw:rl:${ip}:${utcDay(new Date())}`, 172_800).then((n) => n <= perDay),
      true,
      "visitor limit",
    );
}

const MAX_BODY_BYTES = 64_000;

const json = (body: unknown, status = 200, headers: HeadersInit = {}) => Response.json(body, { status, headers });
const notFound = () => json({ error: "not-found" }, 404);

/** Reads a small JSON body; returns a Response when the body is too big or not JSON. */
async function readJson(req: Request): Promise<{ value: unknown } | Response> {
  // Reject an honest oversized upload before buffering it; the byte check below still guards a lying header.
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json({ error: "too-large" }, 413);
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return json({ error: "too-large" }, 413);
  try {
    return { value: JSON.parse(text) };
  } catch {
    return json({ error: "bad-json" }, 400);
  }
}

// Strangers get the same 404 whether the roast is private, someone else's, or doesn't exist.
const respond = (result: OwnerResult) => (result === "ok" ? json({ ok: true }) : notFound());

const token = (req: Request, id: string) => readOwnerToken(req.headers.get("cookie"), id);

export async function handleCreate(req: Request, deps: Deps): Promise<Response> {
  const body = await readJson(req);
  if (body instanceof Response) return body;
  const summary = parseSummary(body.value);
  if (!summary) return json({ error: "bad-summary" }, 400);

  // Checked after validation so junk requests don't use up a real visitor's slots.
  if (!(await deps.limit(clientIp(req)))) return json({ error: "rate-limited" }, 429);

  const { roast, generator, ovenFull } = await deps.generate(summary);
  const { id, ownerToken } = await createRoast(deps.db, { summary, roast, generator });
  return json({ id, ovenFull }, 201, { "set-cookie": ownerCookie(id, ownerToken) });
}

export async function handleUpdate(req: Request, id: string, deps: Pick<Deps, "db">): Promise<Response> {
  const body = await readJson(req);
  if (body instanceof Response) return body;
  const visibility = (body.value as { visibility?: unknown } | null)?.visibility;
  if (visibility !== "public" && visibility !== "private") return json({ error: "bad-visibility" }, 400);
  return respond(await setVisibility(deps.db, id, token(req, id), visibility));
}

export async function handleDelete(req: Request, id: string, deps: Pick<Deps, "db">): Promise<Response> {
  return respond(await deleteRoast(deps.db, id, token(req, id)));
}

export async function handleFeedback(req: Request, id: string, deps: Pick<Deps, "db">): Promise<Response> {
  const body = await readJson(req);
  if (body instanceof Response) return body;
  const value = (body.value as { value?: unknown } | null)?.value;
  if (value !== 1 && value !== -1) return json({ error: "bad-feedback" }, 400);
  return respond(await setFeedback(deps.db, id, token(req, id), value));
}

/** The secret link `/r/<id>/claim?key=<token>` restores ownership on a new browser. */
export async function handleClaim(req: Request, id: string, deps: Pick<Deps, "db">): Promise<Response> {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const headers = new Headers({ location: new URL(`/r/${id}`, url).toString() });
  if (key && (await isRoastOwner(deps.db, id, key))) headers.set("set-cookie", ownerCookie(id, key));
  return new Response(null, { status: 307, headers });
}
