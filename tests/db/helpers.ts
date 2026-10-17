import { createPgliteDb, type Db } from "@/lib/db/client";

/** A fresh in-memory Postgres with migrations applied. One per test file. */
export function testDb(): Promise<Db> {
  return createPgliteDb();
}
