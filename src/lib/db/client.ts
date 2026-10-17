import { join } from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = join(process.cwd(), "drizzle");

/** In-memory Postgres with migrations applied: tests, e2e, and local dev without Supabase. */
export async function createPgliteDb(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as Db;
}

async function createPostgresDb(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  // Supabase's transaction pooler does not support prepared statements; one connection per serverless instance.
  return drizzle(postgres(url, { prepare: false, max: 1 }), { schema }) as unknown as Db;
}

// Cached on globalThis so dev hot reloads (and the in-memory PGlite data) survive module re-evaluation.
const cache = globalThis as unknown as { __cwDb?: Promise<Db> };

/** DATABASE_URL "pglite://memory" → in-memory PGlite; anything else → postgres-js. */
export function getDb(): Promise<Db> {
  if (!cache.__cwDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    cache.__cwDb = url.startsWith("pglite:") ? createPgliteDb() : createPostgresDb(url);
  }
  return cache.__cwDb;
}
