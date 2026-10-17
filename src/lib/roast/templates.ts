// Template roast (PRD F13): used when every AI provider fails. Less funny than the AI, never empty.
// Every line quotes a real piece of evidence from the Summary so it passes the same validator as AI output.
import type { Summary } from "@/lib/summary";
import type { RoastOutput } from "./schema";

type Line = { text: string; evidence: string };
/** k picks which data item to use (0 = first), so a slot can be used twice without repeating itself. */
type Template = (s: Summary, k: number) => Line | null | undefined | "" | false;
type ThinTemplate = (a: string) => Line;
type Headline = (s: Summary) => string | null;
type Personality = { when: (s: Summary) => boolean; label: string; description: (s: Summary) => string };

// ---------- helpers ----------

function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

const short = (s: string, n = 40) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

/** "2024-03-05T04:51:00+05:30" → "4:51am" (the Summary already holds local time). */
function clock(localTime: string): string {
  const h = Number(localTime.slice(11, 13));
  const m = localTime.slice(14, 16);
  return `${h % 12 === 0 ? 12 : h % 12}:${m}${h < 12 ? "am" : "pm"}`;
}

function quarterName(period: string): string {
  const [year, q] = period.split("-Q");
  return [`the start of ${year}`, `spring ${year}`, `summer ${year}`, `the end of ${year}`][Number(q) - 1] ?? year;
}

const num = (n: number) => String(n);
const line = (text: string, evidence: string): Line => ({ text, evidence });
const top = (s: Summary, i: number) => s.topChannels[i];
/** "1 year", "6 years": rounded, never zero. */
export function yearsPhrase(spanDays: number): string {
  const n = Math.max(1, Math.round(spanDays / 365));
  return n === 1 ? "1 year" : `${n} years`;
}

/** Strings that can anchor a joke when data is thin: channels and titles, most prominent first. */
function anchors(s: Summary): string[] {
  const all = [
    ...s.topChannels.map((c) => c.name),
    ...s.topRewatched.map((r) => r.title),
    ...s.samples.oneOffs.map((o) => o.title),
    ...s.eras.flatMap((e) => [...e.sampleTitles, ...e.topChannels]),
    ...(s.longestBinge?.sampleTitles ?? []),
  ];
  return [...new Set(all)].filter((a) => a.trim().length >= 2);
}

// ---------- templates ----------

const HEADLINES: Headline[] = [
  (s) => (top(s, 0) ? `${s.totals.videos} videos and the main character is still ${short(top(s, 0).name)}. that's a hostage situation.` : null),
  () => "you didn't watch youtube. youtube watched you, and it's concerned.",
  (s) => (s.afterMidnightPct >= 15 ? `${s.afterMidnightPct}% of your watching happens after midnight and none of it was worth the lost sleep.` : null),
  (s) => (top(s, 0) ? `a whole personality, sold to you one video at a time by ${short(top(s, 0).name)}.` : null),
  (s) => `${s.totals.videos} videos of evidence and not one of them helps your case.`,
  () => "you have the watch history of someone avoiding something big.",
  () => "the algorithm knows you better than your friends do, and it pities you.",
  (s) => (s.totals.spanDays >= 730 ? `${yearsPhrase(s.totals.spanDays)} of history and you peaked in the first week.` : null),
];

const THIN_HEADLINES: Headline[] = [
  (s) => `${s.totals.videos} videos in ${yearsPhrase(s.totals.spanDays)}. you're not mysterious, you're just boring.`,
  () => "your history is so empty the algorithm filed a missing persons report.",
  () => "you either turned history off or you have nothing to hide. both are worse.",
];

const TOP_CHANNEL: Template[] = [
  (s) => top(s, 0) && line(`you watched ${top(s, 0).name} ${top(s, 0).count} times. ${top(s, 0).name} doesn't know you exist.`, top(s, 0).name),
  (s) => top(s, 0) && line(`${top(s, 0).count} videos of ${top(s, 0).name}. at this point you owe them rent.`, top(s, 0).name),
  (s) => top(s, 0) && line(`${top(s, 0).name} is your most watched channel. that's the most honest thing anyone will ever say about you.`, top(s, 0).name),
  (s) => top(s, 0) && line(`if ${top(s, 0).name} uploaded ten minutes of a wall you'd watch it twice.`, top(s, 0).name),
  (s) => top(s, 0) && line(`${top(s, 0).name} at number one. your parents would be so confused.`, top(s, 0).name),
  (s) => top(s, 1) && line(`second place goes to ${top(s, 1).name}, which somehow makes it worse.`, top(s, 1).name),
  (s) => top(s, 2) && line(`${top(s, 2).name} made your top three. explain that to a therapist.`, top(s, 2).name),
];

const rw = (s: Summary, k: number) => s.topRewatched[k];
const REWATCH: Template[] = [
  (s, k) => rw(s, k) && line(`you rewatched ${rw(s, k).title} ${rw(s, k).count} times. it ends the same way every time.`, rw(s, k).title),
  (s, k) => rw(s, k) && line(`${rw(s, k).title}, ${rw(s, k).count} times. that's not a favourite, that's a coping mechanism.`, rw(s, k).title),
  (s, k) => rw(s, k) && line(`nobody needs to see ${rw(s, k).title} ${rw(s, k).count} times. nobody.`, rw(s, k).title),
  (s, k) => rw(s, k) && line(`you know ${rw(s, k).title} better than you know your own family.`, rw(s, k).title),
  (s, k) => rw(s, k) && line(`${rw(s, k).title} on repeat like it's going to say something different this time.`, rw(s, k).title),
  (s) => rw(s, 1) && line(`${rw(s, 1).title} is in your rewatch pile too. the pile is a cry for help.`, rw(s, 1).title),
];

const night = (s: Summary, k: number) => s.samples.latestNight[k];
const LATE_NIGHT: Template[] = [
  (s, k) => night(s, k) && line(`you were watching ${night(s, k).title} at ${clock(night(s, k).time)}. sleep is free, you know.`, night(s, k).title),
  (s, k) => night(s, k) && line(`${night(s, k).title} at ${clock(night(s, k).time)} is not a bedtime story, it's a symptom.`, night(s, k).title),
  (s) => (s.lateNights >= 10 ? line(`${s.lateNights} nights awake past 2am. the owls are worried about you.`, num(s.lateNights)) : null),
  (s) => (s.afterMidnightPct >= 10 ? line(`${s.afterMidnightPct}% of your watching happens after midnight. vampires keep better hours.`, num(s.afterMidnightPct)) : null),
  (s) => night(s, 1) && line(`${night(s, 1).title} at ${clock(night(s, 1).time)}. whatever you were looking for, it wasn't in there.`, night(s, 1).title),
  (s, k) => night(s, k) && line(`nothing good has ever been watched at ${clock(night(s, k).time)}, and ${night(s, k).title} proves it.`, night(s, k).title),
];

const BINGE: Template[] = [
  (s) => (s.longestBinge && s.longestBinge.count >= 10 ? line(`${s.longestBinge.count} videos in one day. you didn't binge, you dissolved.`, num(s.longestBinge.count)) : null),
  (s) => (s.longestBinge && s.longestBinge.count >= 10 ? line(`${s.longestBinge.count} videos in a single day. go outside, it's still there.`, num(s.longestBinge.count)) : null),
  (s) => s.longestBinge?.sampleTitles[0] && line(`${s.longestBinge.sampleTitles[0]} kicked off a ${s.longestBinge.count}-video day. that video has a lot to answer for.`, s.longestBinge.sampleTitles[0]),
  (s) => (s.longestBinge && s.longestBinge.count >= 10 ? line(`the day you watched ${s.longestBinge.count} videos is the day your couch filed a complaint.`, num(s.longestBinge.count)) : null),
  (s) => (s.longestBinge && s.longestBinge.count >= 10 ? line(`${s.longestBinge.count} videos, one day, zero regrets. that's the problem.`, num(s.longestBinge.count)) : null),
];

const rep = (s: Summary, k: number) => s.searches?.topRepeated[k];
const lateQ = (s: Summary, k: number) => s.searches?.lateNight[k];
const SEARCH: Template[] = [
  (s, k) => rep(s, k) && line(`you searched "${rep(s, k)!.name}" ${rep(s, k)!.count} times. the answer didn't change.`, rep(s, k)!.name),
  (s, k) => rep(s, k) && line(`"${rep(s, k)!.name}" ${rep(s, k)!.count} times. typing it again won't make it true.`, rep(s, k)!.name),
  (s, k) => lateQ(s, k) && line(`you searched "${lateQ(s, k)!.query}" at ${clock(lateQ(s, k)!.time)}. the whole street heard that.`, lateQ(s, k)!.query),
  (s, k) => lateQ(s, k) && line(`"${lateQ(s, k)!.query}" at ${clock(lateQ(s, k)!.time)} is the most honest thing in this entire file.`, lateQ(s, k)!.query),
  (s) => rep(s, 0) && line(`${s.searches!.total} searches and "${rep(s, 0)!.name}" is the one you keep coming back to.`, rep(s, 0)!.name),
  (s) => rep(s, 1) && line(`"${rep(s, 1)!.name}" is in your search history. we all saw it now.`, rep(s, 1)!.name),
];

const odd = (s: Summary, k: number) => s.samples.oneOffs[k];
const ONE_OFF: Template[] = [
  (s, k) => odd(s, k) && line(`you watched ${odd(s, k).title} exactly once and we have so many questions.`, odd(s, k).title),
  (s, k) => odd(s, k) && line(`${odd(s, k).title}. once. never spoken of again.`, odd(s, k).title),
  (s, k) => odd(s, k) && line(`somewhere between everything else you watched ${odd(s, k).title}, and it explains a lot.`, odd(s, k).title),
  (s, k) => odd(s, k)?.channel && line(`${odd(s, k).title} from ${odd(s, k).channel}. one time. we're not letting it go.`, odd(s, k).title),
  (s, k) => odd(s, k) && line(`the algorithm still hasn't recovered from you clicking ${odd(s, k).title}.`, odd(s, k).title),
];

const bigEra = (s: Summary) => [...s.eras].sort((a, b) => b.count - a.count)[0];
const ERA: Template[] = [
  (s) => bigEra(s)?.topChannels[0] && line(`${quarterName(bigEra(s).period)} was your ${bigEra(s).topChannels[0]} era and nobody is allowed to bring it up.`, bigEra(s).topChannels[0]),
  (s) => bigEra(s)?.sampleTitles[0] && line(`in ${quarterName(bigEra(s).period)} you watched ${bigEra(s).sampleTitles[0]}. character development went backwards.`, bigEra(s).sampleTitles[0]),
  (s) => bigEra(s)?.topChannels[0] && line(`${bigEra(s).topChannels[0]} took over ${quarterName(bigEra(s).period)}. you were never the same.`, bigEra(s).topChannels[0]),
  (s) => bigEra(s)?.topChannels[0] && line(`the ${bigEra(s).topChannels[0]} era lasted a whole quarter and somehow felt longer.`, bigEra(s).topChannels[0]),
];

const THIN: ThinTemplate[] = [
  (a) => line(`the only thing you watched enough to count was ${a}.`, a),
  (a) => line(`${a} is basically your whole history. that's not a personality.`, a),
  (a) => line(`we came for the evidence and found ${a}. that's it. that's the file.`, a),
  (a) => line(`your history is so empty that ${a} is the headline act.`, a),
  (a) => line(`even the algorithm gave up on you after ${a}.`, a),
  (a) => line(`${a}, and then silence. what are you hiding?`, a),
  (a) => line(`a whole youtube account and the highlight is ${a}.`, a),
];

const share = (s: Summary) => (top(s, 0) && s.totals.videos ? top(s, 0).count / s.totals.videos : 0);
const PERSONALITIES: Personality[] = [
  {
    when: (s) => s.thinData,
    label: "THE LURKER",
    description: (s) => `${s.totals.videos} videos and no trace of a personality. you either live a full life offline or you've mastered the art of leaving no evidence. we don't trust either.`,
  },
  {
    when: (s) => s.afterMidnightPct >= 25,
    label: "THE 3AM PHILOSOPHER",
    description: (s) => `${s.afterMidnightPct}% of your watching happens when sane people are asleep. you call it thinking. your body calls it a slow-motion emergency.`,
  },
  {
    when: (s) => (s.topRewatched[0]?.count ?? 0) >= 10,
    label: "THE PROFESSIONAL REWATCHER",
    description: (s) => `you've seen ${s.topRewatched[0].title} ${s.topRewatched[0].count} times. new things scare you, so you live inside the same few videos like a comfort blanket with ads.`,
  },
  {
    when: (s) => (s.longestBinge?.count ?? 0) >= 50,
    label: "THE BINGE GOBLIN",
    description: (s) => `your record is ${s.longestBinge!.count} videos in a single day. you don't watch youtube, you go under it like anaesthetic.`,
  },
  {
    when: (s) => (s.searches?.total ?? 0) >= 500,
    label: "THE SEARCH BAR CONFESSOR",
    description: (s) => `${s.searches!.total} searches. you tell the youtube search bar things you've never said out loud, and it remembers every one.`,
  },
  {
    when: (s) => share(s) >= 0.2,
    label: "THE ONE-CHANNEL WONDER",
    description: (s) => `${top(s, 0).name} is ${Math.round(share(s) * 100)}% of everything you watch. that's not fandom, that's a parasocial mortgage.`,
  },
  {
    when: (s) => s.totals.videos >= 10_000,
    label: "THE ALGORITHM'S FAVOURITE",
    description: (s) => `${s.totals.videos} videos. youtube's quarterly earnings call mentions you by name. you are the product and you're thriving.`,
  },
  {
    when: () => true,
    label: "THE TOURIST",
    description: () => "you wander through youtube like it's a museum you got lost in. no taste, no pattern, just vibes and poor decisions.",
  },
];

/** Every hand-written template, so the "~60 templates" target from the tech stack doc is checkable. */
export const TEMPLATE_COUNT =
  HEADLINES.length + THIN_HEADLINES.length + TOP_CHANNEL.length + REWATCH.length + LATE_NIGHT.length + BINGE.length +
  SEARCH.length + ONE_OFF.length + ERA.length + THIN.length + PERSONALITIES.length;

// ---------- assembly ----------

const SLOT_ORDER: Template[][] = [TOP_CHANNEL, REWATCH, LATE_NIGHT, BINGE, SEARCH, ONE_OFF, ERA];
const RICH_SLOTS: Template[][] = [TOP_CHANNEL, REWATCH, SEARCH, LATE_NIGHT, ONE_OFF];
const TARGET_LINES = 8;
const MIN_LINES = 6;

function choose<T>(items: (T | null | undefined | "" | 0 | false)[], seed: number): T | null {
  const valid = items.filter(Boolean) as T[];
  return valid.length ? valid[seed % valid.length] : null;
}

function captions(s: Summary): RoastOutput["captions"] {
  const t0 = top(s, 0);
  const r0 = s.topRewatched[0];
  const peak = s.hours.indexOf(Math.max(...s.hours));
  const lateSample = s.samples.latestNight.find((n) => /sleep|morning|5am|productiv|discipline|routine|wake/i.test(n.title));
  return {
    numbers: `${s.totals.videos} videos across ${s.totals.channels} channels. that's a lot of hours you're not getting back.`,
    topChannels: t0 ? `${t0.name} leads with ${t0.count}. the rest are just witnesses.` : null,
    rewatched: r0 ? `${r0.title} wins with ${r0.count} plays. repetition is not a personality.` : null,
    clock: s.totals.videos ? `${s.afterMidnightPct}% after midnight. your busiest hour is ${clock(`0000-00-00T${String(peak).padStart(2, "0")}:00`)}.` : null,
    binge: s.longestBinge ? `${s.longestBinge.count} videos on your worst day. a personal record nobody asked for.` : null,
    searches: s.searches?.topRepeated[0] ? `"${s.searches.topRepeated[0].name}" is your most repeated search. noted.` : null,
    contradictions: lateSample ? `watching ${lateSample.title} at ${clock(lateSample.time)} is the whole contradiction in one line.` : null,
  };
}

function eraName(era: Summary["eras"][number]): string {
  const subject = era.topChannels[0] ?? era.sampleTitles[0];
  return subject ? `the ${short(subject)} era` : "the quiet era";
}

export function generateTemplateRoast(summary: Summary): RoastOutput {
  const seed = fnv1a(JSON.stringify(summary));
  const lines: Line[] = [];
  const seen = new Set<string>();
  const add = (l: Line | null) => {
    if (!l || l.evidence.trim().length < 2 || seen.has(l.text) || lines.length >= TARGET_LINES) return;
    seen.add(l.text);
    lines.push(l);
  };

  SLOT_ORDER.forEach((slot, i) => add(choose(slot.map((t) => t(summary, 0)), seed + i)));
  RICH_SLOTS.forEach((slot, i) => add(choose(slot.map((t) => t(summary, 1)), seed + i + 7)));

  const pool = anchors(summary);
  for (let k = 0; lines.length < MIN_LINES && pool.length && k < THIN.length * pool.length; k++) {
    add(THIN[(seed + k) % THIN.length](pool[k % pool.length]));
  }

  const headlines = summary.thinData ? THIN_HEADLINES : HEADLINES;
  const headline = choose(headlines.map((h) => h(summary)), seed) ?? "the evidence speaks for itself.";
  const personality = PERSONALITIES.find((p) => p.when(summary))!;

  return {
    headline,
    lines,
    personality: { label: personality.label, description: personality.description(summary) },
    eras: summary.eras.map((era) => ({ period: era.period, name: eraName(era) })),
    captions: captions(summary),
  };
}
