import { z } from "zod";
import type { Summary } from "./summary";

// The server's trust boundary: anything POSTed as a Summary is parsed with this before it reaches the AI or the DB.
// Limits are a little looser than what the stats engine produces, never tighter.

const text = z
  .string()
  .max(200)
  .refine((s) => s.isWellFormed(), "malformed unicode");
const count = z.number().int().min(0).max(10_000_000);
const localTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const named = z.strictObject({ name: text, count });
const titleRef = z.strictObject({ title: text, channel: text.nullable(), videoId: text.nullable() });

export const SummarySchema: z.ZodType<Summary> = z.strictObject({
  version: z.literal(1),
  source: z.literal("takeout"),
  totals: z.strictObject({
    // A roast needs at least one watch to be about (real uploads with none are rejected in the browser).
    videos: count.min(1),
    channels: count,
    firstWatch: localTime.nullable(),
    lastWatch: localTime.nullable(),
    spanDays: count,
  }),
  topChannels: z.array(named).max(10),
  topRewatched: z.array(titleRef.extend({ count })).max(10),
  hours: z.array(count).length(24),
  weekdays: z.array(count).length(7),
  afterMidnightPct: z.number().int().min(0).max(100),
  lateNights: count,
  longestBinge: z.strictObject({ date, count, sampleTitles: z.array(text).max(5) }).nullable(),
  eras: z
    .array(
      z.strictObject({
        period: z.string().regex(/^\d{4}-Q[1-4]$/),
        count,
        topChannels: z.array(text).max(3),
        sampleTitles: z.array(text).max(3),
      }),
    )
    .max(12),
  searches: z
    .strictObject({
      total: count,
      topRepeated: z.array(named).max(10),
      lateNight: z.array(z.strictObject({ query: text, time: localTime })).max(10),
    })
    .nullable(),
  samples: z.strictObject({
    latestNight: z.array(titleRef.extend({ time: localTime })).max(5),
    oneOffs: z.array(titleRef).max(10),
  }),
  thinData: z.boolean(),
});

export function parseSummary(input: unknown): Summary | null {
  const result = SummarySchema.safeParse(input);
  return result.success ? result.data : null;
}
