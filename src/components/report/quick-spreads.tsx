import { EvidenceCard, StatBlock } from "@/components/zine/bits";
import { LinkButton } from "@/components/zine/Button";
import { Sticker } from "@/components/zine/Sticker";
import type { RoastOutput } from "@/lib/roast/schema";
import type { QuickSummary } from "@/lib/summary";
import { SpreadHead } from "./spreads";

type Captions = RoastOutput["captions"];
const n = (x: number) => x.toLocaleString("en-US");

export function QuickNumbersSpread({ s, c }: { s: QuickSummary; c: Captions }) {
  return (
    <>
      <SpreadHead title={<>the <span className="alt">numbers</span></>} caption={c.numbers} />
      <div className="grid gap-10 sm:grid-cols-3">
        <StatBlock value={n(s.totals.likes)} label="liked videos" />
        <StatBlock value={n(s.totals.subscriptions)} label="subscriptions" />
        <StatBlock value={n(s.totals.playlists)} label="playlists" />
      </div>
    </>
  );
}

export function QuickTopChannelsSpread({ s, c }: { s: QuickSummary; c: Captions }) {
  return (
    <>
      <SpreadHead title={<>top <span className="alt">channels</span></>} caption={c.topChannels} />
      <ol className="grid gap-6 sm:grid-cols-2">
        {s.topChannels.slice(0, 5).map((ch, i) => (
          <li key={ch.name} className={`relative ${i === 0 ? "sm:col-span-2" : ""}`}>
            <EvidenceCard label={`exhibit ${String.fromCharCode(65 + i)} · #${i + 1}`} seed={ch.name} fill={i === 0 ? "butter" : "paper"}>
              <p className={`font-semibold ${i === 0 ? "text-2xl" : "text-lg"}`}>{ch.name}</p>
              <p className="font-mono text-sm">{n(ch.count)} liked videos</p>
            </EvidenceCard>
            {i === 0 && (
              <span className="absolute -right-2 -top-5">
                <Sticker seed="crown-quick" fill="tangerine">
                  👑 #1
                </Sticker>
              </span>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}

export function AbandonedSpread({ s }: { s: QuickSummary }) {
  return (
    <>
      <SpreadHead title={<>subscriptions you <span className="hot">abandoned</span></>} caption="subscribed, then never liked a single video. they're still waiting." />
      <ul className="flex flex-wrap gap-3">
        {s.subscriptions.abandoned.map((name, i) => (
          <li key={i} className="rounded border-[3px] border-ink bg-paper px-3 py-1 font-semibold shadow-press line-through decoration-marker decoration-[3px]">
            {name}
          </li>
        ))}
      </ul>
      {s.subscriptions.oldest[0] && (
        <p className="font-marker text-lg">
          longest-running: {s.subscriptions.oldest[0].name}, since {s.subscriptions.oldest[0].since.slice(0, 4)}.
        </p>
      )}
    </>
  );
}

export function PlaylistsSpread({ s }: { s: QuickSummary }) {
  return (
    <>
      <SpreadHead title={<>playlists <span className="alt">exposed</span></>} caption="you named these yourself." />
      <ul className="grid gap-6 sm:grid-cols-2">
        {s.playlists.map((p, i) => (
          <li key={i}>
            <EvidenceCard label={`${n(p.count)} videos`} seed={p.title}>
              <p className="label text-xl">&ldquo;{p.title}&rdquo;</p>
              {p.sampleTitles.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {p.sampleTitles.map((t, k) => (
                    <li key={k}>{t}</li>
                  ))}
                </ul>
              )}
            </EvidenceCard>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Design 5.6: quick reports end with the upsell to the real thing (PRD US-5). */
export function WarmUpSpread() {
  return (
    <div className="flex flex-col items-start gap-6">
      <p className="display display-l">
        that was the <span className="hot">warm-up.</span>
      </p>
      <p className="text-xl font-semibold">likes and subscriptions are what you show the world. your watch history is what you actually do.</p>
      <LinkButton variant="primary" href="/roast">
        want the real damage? do the full roast →
      </LinkButton>
    </div>
  );
}
