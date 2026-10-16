import { z } from "zod";

export const RoastOutputSchema = z.object({
  headline: z.string().max(140).describe("the verdict: one brutal sentence about this person"),
  lines: z
    .array(
      z.object({
        text: z.string().describe("one roast line, most under 25 words"),
        evidence: z
          .string()
          .describe("the exact title, channel, count or time from the data that this line quotes, copied verbatim"),
      }),
    )
    .min(6)
    .max(10),
  personality: z.object({
    label: z.string().max(40).describe('a personality label like "THE 3AM PHILOSOPHER"'),
    description: z.string().describe("2-3 sentences"),
  }),
  eras: z.array(z.object({ period: z.string(), name: z.string() })),
  captions: z.object({
    numbers: z.string().optional(),
    topChannels: z.string().optional(),
    rewatched: z.string().optional(),
    clock: z.string().optional(),
    binge: z.string().optional(),
    searches: z.string().optional(),
    contradictions: z.string().optional(),
  }),
});

export type RoastOutput = z.infer<typeof RoastOutputSchema>;
