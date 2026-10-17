import type { ReactNode } from "react";
import {
  BingeSpread,
  ClockSpread,
  ContradictionsSpread,
  ErasSpread,
  NumbersSpread,
  OutroSpread,
  RewatchedSpread,
  SearchesSpread,
  TopChannelsSpread,
} from "@/components/report/spreads";
import { Band } from "@/components/zine/Band";
import type { RoastOutput } from "@/lib/roast/schema";
import type { Summary } from "@/lib/summary";

const TONES = ["paper", "butter", "sky", "tangerine"] as const;

/** "Your file" (design 5.6): one big idea per spread, each on its own torn colour band; empty spreads are skipped. */
export function ReportView({ summary: s, roast, isOwner }: { summary: Summary; roast: RoastOutput; isOwner: boolean }) {
  const c = roast.captions;
  const spreads: [string, ReactNode][] = [
    ["numbers", <NumbersSpread key="n" s={s} c={c} />],
    ...(s.topChannels.length ? [["channels", <TopChannelsSpread key="t" s={s} c={c} />] as [string, ReactNode]] : []),
    ...(s.topRewatched.length ? [["rewatched", <RewatchedSpread key="r" s={s} c={c} />] as [string, ReactNode]] : []),
    ["clock", <ClockSpread key="c" s={s} c={c} />],
    ...(s.eras.length ? [["eras", <ErasSpread key="e" s={s} r={roast} />] as [string, ReactNode]] : []),
    ...(s.longestBinge ? [["binge", <BingeSpread key="b" s={s} c={c} />] as [string, ReactNode]] : []),
    ...(s.searches?.topRepeated.length ? [["searches", <SearchesSpread key="s" s={s} c={c} />] as [string, ReactNode]] : []),
    ...(c.contradictions ? [["contradictions", <ContradictionsSpread key="x" c={c} />] as [string, ReactNode]] : []),
    ["outro", <OutroSpread key="o" isOwner={isOwner} />],
  ];
  return (
    <div className="mt-16">
      {spreads.map(([key, spread], i) => (
        <Band key={key} tone={TONES[i % 4]} edge={(i % 4) as 0 | 1 | 2 | 3}>
          <div className="mx-auto max-w-3xl space-y-8 px-4 py-14">{spread}</div>
        </Band>
      ))}
    </div>
  );
}
