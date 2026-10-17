import { join } from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// Resolved per call (not at import) so it follows the working directory the server actually runs in.
const migrationsFolder = () => join(process.cwd(), "drizzle");

/** In-memory Postgres with migrations applied: tests, e2e, and local dev without Supabase. */
export async function createPgliteDb(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: migrationsFolder() });
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
    // An in-memory database on Vercel would keep roasts per instance and lose them on every cold start.
    if (url.startsWith("pglite:") && process.env.VERCEL_ENV === "production") throw new Error("pglite is not allowed in production");
    cache.__cwDb = (url.startsWith("pglite:") ? createPgliteDb() : createPostgresDb(url)).catch((err: unknown) => {
      // Don't cache a failure: the next request gets a fresh attempt instead of a bricked instance.
      cache.__cwDb = undefined;
      throw err;
    });
  }
  return cache.__cwDb;
}
