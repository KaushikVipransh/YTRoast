import type { ReactNode } from "react";
import type { RoastOutput } from "@/lib/roast/schema";
import type { Summary } from "@/lib/summary";

// Plain report sections; Phase 4 turns each into a zine spread. A section renders only when it has data.

function Section({ title, caption, children }: { title: string; caption: string | null; children: ReactNode }) {
  return (
    <section className="border-t-2 border-ink pt-6">
      <h2 className="text-xl font-black uppercase">{title}</h2>
      {caption && <p className="mt-1 text-ink-soft">{caption}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;
const n = (x: number) => x.toLocaleString("en-US");

export function ReportView({ summary: s, roast }: { summary: Summary; roast: RoastOutput }) {
  const c = roast.captions;
  const maxHour = Math.max(1, ...s.hours);
  const eraNames = new Map(roast.eras.map((e) => [e.period, e.name]));

  return (
    <div className="space-y-10">
      <p className="font-mono text-sm uppercase">▼ your full file</p>

      <Section title="the numbers" caption={c.numbers}>
        <dl className="grid grid-cols-3 gap-3 text-center">
          {[
            ["videos", s.totals.videos],
            ["channels", s.totals.channels],
            ["late nights", s.lateNights],
          ].map(([label, value]) => (
            <div key={label} className="border-2 border-ink bg-white p-2">
              <dd className="text-2xl font-black">{n(value as number)}</dd>
              <dt className="text-xs font-bold uppercase">{label}</dt>
            </div>
          ))}
        </dl>
      </Section>

      {s.topChannels.length > 0 && (
        <Section title="top channels" caption={c.topChannels}>
          <ol className="space-y-1">
            {s.topChannels.slice(0, 5).map((ch, i) => (
              <li key={ch.name} className="flex justify-between gap-4">
                <span>
                  {i + 1}. {ch.name}
                </span>
                <span className="font-mono">{n(ch.count)}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {s.topRewatched.length > 0 && (
        <Section title="most rewatched" caption={c.rewatched}>
          <ul className="space-y-1">
            {s.topRewatched.slice(0, 5).map((v) => (
              <li key={v.videoId ?? v.title} className="flex justify-between gap-4">
                <span>{v.title}</span>
                <span className="shrink-0 font-mono">{v.count}×</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {s.totals.videos > 0 && (
        <Section title="the clock" caption={c.clock}>
          <p className="font-mono text-sm">{s.afterMidnightPct}% after midnight</p>
          <div className="mt-2 flex h-24 items-end gap-0.5" role="img" aria-label="videos watched by hour of day">
            {s.hours.map((count, h) => (
              <div
                key={h}
                title={`${hourLabel(h)}: ${count}`}
                className={h < 5 ? "flex-1 bg-marker" : "flex-1 bg-tangerine"}
                style={{ height: `${Math.max(2, (count / maxHour) * 100)}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between font-mono text-xs">
            <span>12am</span>
            <span>12pm</span>
            <span>11pm</span>
          </div>
        </Section>
      )}

      {s.eras.length > 0 && (
        <Section title="your eras" caption={null}>
          <ol className="space-y-3">
            {s.eras.map((era) => (
              <li key={era.period} className="border-2 border-ink bg-white p-3">
                <p className="font-mono text-xs">{era.period}</p>
                <p className="font-bold">{eraNames.get(era.period) ?? era.topChannels[0] ?? era.period}</p>
                {era.sampleTitles[0] && <p className="text-sm text-ink-soft">{era.sampleTitles[0]}</p>}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {s.longestBinge && (
        <Section title="longest binge" caption={c.binge}>
          <p className="text-2xl font-black">
            {s.longestBinge.count} videos <span className="font-mono text-sm font-normal">on {s.longestBinge.date}</span>
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {s.longestBinge.sampleTitles.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Section>
      )}

      {s.searches && s.searches.topRepeated.length + s.searches.lateNight.length > 0 && (
        <Section title="what you searched" caption={c.searches}>
          <ul className="space-y-1">
            {s.searches.topRepeated.slice(0, 5).map((q) => (
              <li key={q.name}>
                “{q.name}” <span className="font-mono text-sm">×{q.count}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {c.contradictions && (
        <Section title="contradictions" caption={null}>
          <p>{c.contradictions}</p>
        </Section>
      )}
    </div>
  );
}
