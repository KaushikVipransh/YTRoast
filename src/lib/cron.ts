import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";

/** Vercel Cron sends "Authorization: Bearer $CRON_SECRET". No secret configured → nothing is allowed. */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Free Supabase projects pause after 7 days without activity; a daily query keeps the database awake. */
export async function handleKeepalive(req: Request, deps: { db: Db }): Promise<Response> {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  await deps.db.execute(sql`select 1`);
  return Response.json({ ok: true });
}
