import type { ReactNode } from "react";
import { EvidenceCard, MarkerCircle, StatBlock } from "@/components/zine/bits";
import { LinkButton } from "@/components/zine/Button";
import { Tape } from "@/components/zine/decor";
import { Stamp } from "@/components/zine/Stamp";
import { Sticker } from "@/components/zine/Sticker";
import type { RoastOutput } from "@/lib/roast/schema";
import type { TakeoutSummary as Summary } from "@/lib/summary";
import { clockBars } from "@/lib/zine/clock";
import { thumbUrl, watchUrl } from "@/lib/zine/thumbs";
import { seededTilt } from "@/lib/zine/tilt";

type Captions = RoastOutput["captions"];
const n = (x: number) => x.toLocaleString("en-US");

/** Shared spread heading: big display title + the AI's caption (the joke next to the insight). */
export function SpreadHead({ title, caption }: { title: ReactNode; caption?: string | null }) {
  return (
    <header className="space-y-3">
      <h2 className="display display-l">{title}</h2>
      {caption && <p className="max-w-xl text-lg font-semibold">{caption}</p>}
    </header>
  );
}

export function NumbersSpread({ s, c }: { s: Summary; c: Captions }) {
  return (
    <>
      <SpreadHead title={<>the <span className="alt">numbers</span></>} caption={c.numbers} />
      <div className="grid gap-10 sm:grid-cols-3">
        <StatBlock value={n(s.totals.videos)} label="videos watched" />
        <StatBlock value={n(s.totals.channels)} label="channels" />
        <StatBlock value={n(s.lateNights)} label="late nights" aside={s.lateNights > 0 ? "awake past 2am, every one" : undefined} />
      </div>
    </>
  );
}

export function TopChannelsSpread({ s, c }: { s: Summary; c: Captions }) {
  return (
    <>
      <SpreadHead title={<>top <span className="alt">channels</span></>} caption={c.topChannels} />
      <ol className="grid gap-6 sm:grid-cols-2">
        {s.topChannels.slice(0, 5).map((ch, i) => (
          <li key={ch.name} className={`relative ${i === 0 ? "sm:col-span-2" : ""}`}>
            <EvidenceCard label={`exhibit ${String.fromCharCode(65 + i)} · #${i + 1}`} seed={ch.name} fill={i === 0 ? "butter" : "paper"}>
              <p className={`font-semibold ${i === 0 ? "text-2xl" : "text-lg"}`}>{ch.name}</p>
              <p className="font-mono text-sm">{n(ch.count)} videos</p>
            </EvidenceCard>
            {i === 0 && (
              <span className="absolute -right-2 -top-5">
                <Sticker seed="crown" fill="tangerine">
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

export function RewatchedSpread({ s, c }: { s: Summary; c: Captions }) {
  return (
    <>
      <SpreadHead title={<>most <span className="hot">rewatched</span></>} caption={c.rewatched} />
      <ul className="grid gap-8 sm:grid-cols-2">
        {s.topRewatched.slice(0, 4).map((v) => {
          const thumb = thumbUrl(v.videoId);
          const href = watchUrl(v.videoId);
          return (
            <li key={v.videoId ?? v.title} className="relative" style={{ transform: `rotate(${seededTilt(v.title, 2)}deg)` }}>
              <div className="rounded border-[3px] border-ink bg-paper p-2 shadow-hard">
                {thumb && href ? (
                  <a href={href} target="_blank" rel="noreferrer" className="halftone block aspect-video overflow-hidden border-2 border-ink" aria-label={`watch ${v.title} on youtube`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- plain img: no remote image config, lazy, from YouTube's CDN */}
                    <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </a>
                ) : (
                  <div aria-hidden="true" className="graph-paper aspect-video border-2 border-ink" />
                )}
                <p className="mt-2 font-semibold leading-snug">{v.title}</p>
                <p className="mt-1 text-lg">
                  <MarkerCircle evidence={`${v.count}×`}>{v.count}×</MarkerCircle>
                </p>
              </div>
              <Tape seed={`${v.title}-l`} className="-left-3 -top-2" />
              <Tape seed={`${v.title}-r`} className="-right-3 -top-2" />
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function ClockSpread({ s, c }: { s: Summary; c: Captions }) {
  const bars = clockBars(s.hours, { inner: 44, outer: 100 });
  return (
    <>
      <SpreadHead title={<>the <span className="alt">clock</span></>} caption={c.clock} />
      <div className="grid items-center gap-8 sm:grid-cols-2">
        <svg viewBox="-118 -118 236 236" className="mx-auto w-full max-w-sm" role="img" aria-label={`videos by hour of day; ${s.afterMidnightPct}% after midnight`}>
          <defs>
            <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--marker)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink)" strokeWidth="2" />
            </pattern>
          </defs>
          <circle r="112" fill="var(--paper)" stroke="var(--ink)" strokeWidth="3" />
          {bars.map((b) => (
            <path key={b.hour} d={b.path} fill={b.late ? "url(#hatch)" : "var(--tangerine)"} stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" />
          ))}
          <circle r="40" fill="var(--butter)" stroke="var(--ink)" strokeWidth="3" />
          {[
            ["12am", 0, -104],
            ["6am", 104, 0],
            ["12pm", 0, 110],
            ["6pm", -104, 0],
          ].map(([label, x, y]) => (
            <text key={label} x={x} y={y} textAnchor="middle" dominantBaseline="middle" style={{ font: "700 9px var(--nf-mono)" }} fill="var(--ink)">
              {label}
            </text>
          ))}
          <text textAnchor="middle" dominantBaseline="middle" y="-4" style={{ font: "22px var(--nf-display)" }} fill="var(--ink)">
            {s.afterMidnightPct}%
          </text>
          <text textAnchor="middle" y="16" style={{ font: "800 8px var(--nf-ui)", letterSpacing: "0.08em" }} fill="var(--ink)">
            AFTER MIDNIGHT
          </text>
        </svg>
        <StatBlock value={`${s.afterMidnightPct}%`} label="of your watching happens after midnight" aside="the hatched bit is 12am–5am" />
      </div>
    </>
  );
}

export function ErasSpread({ s, r }: { s: Summary; r: RoastOutput }) {
  const names = new Map(r.eras.map((e) => [e.period, e.name]));
  return (
    <>
      <SpreadHead title={<>your <span className="alt">eras</span></>} />
      <ol className="space-y-6">
        {s.eras.map((era, i) => (
          <li
            key={era.period}
            className={`border-y-[3px] border-ink px-5 py-4 shadow-[4px_4px_0_var(--ink)] ${i % 2 ? "bg-paper" : "bg-butter"}`}
            style={{ transform: `rotate(${i % 2 ? -1 : 1}deg)` }}
          >
            <p className="font-mono text-sm">{era.period} · {n(era.count)} videos</p>
            <p className="label mt-1 text-2xl">{names.get(era.period) ?? era.topChannels[0] ?? era.period}</p>
            {era.sampleTitles[0] && <p className="mt-1 text-ink-soft">top pick: {era.sampleTitles[0]}</p>}
          </li>
        ))}
      </ol>
    </>
  );
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function BingeSpread({ s, c }: { s: Summary; c: Captions }) {
  const binge = s.longestBinge!;
  const weekday = WEEKDAYS[new Date(`${binge.date}T12:00:00Z`).getUTCDay()];
  return (
    <>
      <SpreadHead title={<>longest <span className="hot">binge</span></>} caption={c.binge} />
      <p className="display display-l">
        {binge.count} videos. <span className="alt">on a {weekday}.</span>
      </p>
      <ul className="flex gap-3 overflow-x-auto rounded border-[3px] border-ink bg-ink p-3" aria-label={`some of what you watched on ${binge.date}`}>
        {binge.sampleTitles.map((t) => (
          <li key={t} className="min-w-44 max-w-44 shrink-0 rounded-sm border-2 border-paper bg-paper p-3 text-sm font-semibold leading-snug">
            {t}
          </li>
        ))}
      </ul>
    </>
  );
}

const RANSOM_FONTS = ["font-display uppercase", "font-mono", "font-marker", "label text-[1.05em]", "font-body font-semibold"];
const RANSOM_FILLS = ["bg-paper", "bg-butter", "bg-sky", "bg-tangerine", "bg-leaf"];

/** Search queries as cut-out ransom-note letters: each word in its own paper scrap. */
function Ransom({ text }: { text: string }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {text.split(/\s+/).map((word, i) => {
        const pick = Math.abs(Math.round(seededTilt(`${text}-${i}`, 20)));
        return (
          <span
            key={i}
            className={`inline-block border-2 border-ink px-1.5 py-0.5 text-ink ${RANSOM_FONTS[pick % 5]} ${RANSOM_FILLS[(pick + 2) % 5]}`}
            style={{ transform: `rotate(${seededTilt(`${text}-r${i}`, 3)}deg)` }}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
}

export function SearchesSpread({ s, c }: { s: Summary; c: Captions }) {
  const searches = s.searches!;
  return (
    <>
      <SpreadHead title={<>what you <span className="alt">searched</span></>} caption={c.searches} />
      <ul className="space-y-5">
        {searches.topRepeated.slice(0, 5).map((q) => (
          <li key={q.name} className="flex flex-wrap items-center gap-3 text-lg">
            <Ransom text={q.name} />
            <span className="font-mono text-sm">×{q.count}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function ContradictionsSpread({ c }: { c: Captions }) {
  return (
    <>
      <SpreadHead title={<>contra<span className="hot">dictions</span></>} />
      <div className="grid overflow-hidden rounded border-[3px] border-ink shadow-hard sm:grid-cols-2">
        <div className="bg-paper p-5">
          <p className="label">what you watch</p>
        </div>
        <div className="bg-butter p-5 [clip-path:polygon(4%_0,100%_0,100%_100%,0_100%,3%_60%,0_30%)]">
          <p className="label">who you think you are</p>
        </div>
        <p className="border-t-[3px] border-ink bg-paper p-5 text-lg font-semibold sm:col-span-2">{c.contradictions}</p>
      </div>
    </>
  );
}

export function OutroSpread({ isOwner }: { isOwner: boolean }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <Stamp text="OFFICIALLY ROASTED · NO REFUNDS · " center="🔥" size={140} />
      {isOwner ? (
        <p className="text-xl font-semibold">that&apos;s the whole file. share it if you dare.</p>
      ) : (
        <>
          <p className="text-xl font-semibold">roast a friend: send them this link. or get yours.</p>
          <LinkButton variant="primary" href="/roast">
            roast me
          </LinkButton>
        </>
      )}
    </div>
  );
}
