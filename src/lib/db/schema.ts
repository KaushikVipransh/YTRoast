import { sql } from "drizzle-orm";
import { check, jsonb, pgTable, smallint, text, timestamp } from "drizzle-orm/pg-core";
import type { Generator } from "@/lib/roast/generate";
import type { RoastOutput } from "@/lib/roast/schema";
import type { Summary } from "@/lib/summary";

export const roasts = pgTable(
  "roasts",
  {
    id: text("id").primaryKey(),
    /** sha256 hex of the owner's secret token; the token itself is never stored */
    ownerHash: text("owner_hash").notNull(),
    source: text("source", { enum: ["takeout", "quick"] }).notNull(),
    visibility: text("visibility", { enum: ["private", "public"] }).notNull().default("private"),
    /** null once deleted */
    summary: jsonb("summary").$type<Summary>(),
    /** null once deleted */
    roast: jsonb("roast").$type<RoastOutput>(),
    generator: text("generator", { enum: ["gemini", "gemini-lite", "groq", "template"] }).$type<Generator>().notNull(),
    feedback: smallint("feedback"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check("roasts_source_check", sql`${t.source} in ('takeout', 'quick')`),
    check("roasts_visibility_check", sql`${t.visibility} in ('private', 'public')`),
    check("roasts_generator_check", sql`${t.generator} in ('gemini', 'gemini-lite', 'groq', 'template')`),
    check("roasts_feedback_check", sql`${t.feedback} in (-1, 1)`),
    // A tombstone has no content; a live roast has all of it.
    check(
      "roasts_deleted_content_check",
      sql`(${t.deletedAt} is null) = (${t.summary} is not null and ${t.roast} is not null)`,
    ),
  ],
);

export type RoastRow = typeof roasts.$inferSelect;
