import { and, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "@/lib/db/client";
import { roasts, type RoastRow } from "@/lib/db/schema";
import type { Generator } from "@/lib/roast/generate";
import type { RoastOutput } from "@/lib/roast/schema";
import type { Summary } from "@/lib/summary";
import { hashToken, newOwnerToken, tokenMatches } from "./ownership";

export type RoastView =
  | { kind: "missing" }
  | { kind: "deleted" }
  | {
      kind: "roast";
      id: string;
      isOwner: boolean;
      visibility: "private" | "public";
      summary: Summary;
      roast: RoastOutput;
      generator: Generator;
      feedback: -1 | 1 | null;
      createdAt: string;
    };

export type OwnerResult = "ok" | "forbidden" | "missing";

const ID_LENGTH = 12;

async function findRow(db: Db, id: string): Promise<RoastRow | undefined> {
  const [row] = await db.select().from(roasts).where(eq(roasts.id, id)).limit(1);
  return row;
}

const isOwner = (row: RoastRow, token: string | null) => token !== null && tokenMatches(token, row.ownerHash);

export async function createRoast(
  db: Db,
  input: { summary: Summary; roast: RoastOutput; generator: Generator },
): Promise<{ id: string; ownerToken: string }> {
  const id = nanoid(ID_LENGTH);
  const ownerToken = newOwnerToken();
  await db.insert(roasts).values({ id, ownerHash: hashToken(ownerToken), source: "takeout", ...input });
  return { id, ownerToken };
}

/** A private roast and an unknown id look the same to anyone but the owner. */
export async function getRoastView(db: Db, id: string, ownerToken: string | null): Promise<RoastView> {
  const row = await findRow(db, id);
  if (!row) return { kind: "missing" };
  const owner = isOwner(row, ownerToken);
  // Checked before "deleted": a burned private roast must not reveal to strangers that it ever existed.
  if (row.visibility === "private" && !owner) return { kind: "missing" };
  if (row.deletedAt) return { kind: "deleted" };
  return {
    kind: "roast",
    id: row.id,
    isOwner: owner,
    visibility: row.visibility,
    summary: row.summary!,
    roast: row.roast!,
    generator: row.generator,
    feedback: row.feedback === 1 || row.feedback === -1 ? row.feedback : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Checks ownership of a live (not deleted) roast before running an update. */
async function asOwner(db: Db, id: string, token: string | null, update: () => Promise<unknown>): Promise<OwnerResult> {
  const row = await findRow(db, id);
  if (!row || row.deletedAt) return "missing";
  if (!isOwner(row, token)) return "forbidden";
  await update();
  return "ok";
}

const live = (id: string) => and(eq(roasts.id, id), isNull(roasts.deletedAt));

export function setVisibility(db: Db, id: string, ownerToken: string | null, visibility: "private" | "public"): Promise<OwnerResult> {
  return asOwner(db, id, ownerToken, () => db.update(roasts).set({ visibility }).where(live(id)));
}

/** Burns the content immediately; the row stays so the link can say "deleted". */
export function deleteRoast(db: Db, id: string, ownerToken: string | null): Promise<OwnerResult> {
  return asOwner(db, id, ownerToken, () =>
    db.update(roasts).set({ summary: null, roast: null, deletedAt: new Date() }).where(live(id)),
  );
}

export function setFeedback(db: Db, id: string, ownerToken: string | null, value: -1 | 1): Promise<OwnerResult> {
  return asOwner(db, id, ownerToken, () => db.update(roasts).set({ feedback: value }).where(live(id)));
}

/** True when the token owns this live roast (used by the secret "claim" link). */
export async function isRoastOwner(db: Db, id: string, ownerToken: string): Promise<boolean> {
  const row = await findRow(db, id);
  return !!row && !row.deletedAt && isOwner(row, ownerToken);
}
