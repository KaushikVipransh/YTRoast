// Template roast for quick summaries (likes, subscriptions, playlists): the fallback when every AI fails.
// Same rules as the Takeout templates: every line quotes real evidence, so it passes validateRoast.
import type { QuickSummary } from "@/lib/summary";
import type { RoastOutput } from "./schema";
import { choose, fnv1a, line, lineCollector, type Line } from "./template-kit";

type Template = (s: QuickSummary, k: number) => Line | null | undefined | false | "";

const top = (s: QuickSummary, i: number) => s.topChannels[i];
const like = (s: QuickSummary, k: number) => s.likedSamples[k];
const pl = (s: QuickSummary, k: number) => s.playlists[k];
const gone = (s: QuickSummary, k: number) => s.subscriptions.abandoned[k];
const old = (s: QuickSummary, k: number) => s.subscriptions.oldest[k];
const n = (x: number) => String(x);

const TOP_CHANNEL: Template[] = [
  (s) => top(s, 0) && line(`you liked ${top(s, 0).count} videos from ${top(s, 0).name}. they will never like you back.`, top(s, 0).name),
  (s) => top(s, 0) && line(`${top(s, 0).name} owns your like button and you didn't even get a discount.`, top(s, 0).name),
  (s) => top(s, 1) && line(`${top(s, 1).name} in second place says more about you than you'd like.`, top(s, 1).name),
];

const LIKES: Template[] = [
  (s, k) => like(s, k) && line(`you actively pressed like on ${like(s, k).title}. on purpose. with your finger.`, like(s, k).title),
  (s, k) => like(s, k) && line(`${like(s, k).title} got your like. your friends' birthdays didn't.`, like(s, k).title),
  (s, k) => like(s, k) && line(`somewhere in your likes sits ${like(s, k).title}, and we will be discussing it.`, like(s, k).title),
];

const ABANDONED: Template[] = [
  (s, k) => gone(s, k) && line(`you're subscribed to ${gone(s, k)} and haven't liked a single video. that's a hostage, not a fan.`, gone(s, k)),
  (s, k) => gone(s, k) && line(`${gone(s, k)} is still in your subscriptions, like a gym membership you forgot to cancel.`, gone(s, k)),
];

const OLDEST: Template[] = [
  (s) => old(s, 0) && line(`you followed ${old(s, 0).name} back in ${old(s, 0).since.slice(0, 4)}. that relationship outlasted all of yours.`, old(s, 0).name),
  (s) => old(s, 0) && line(`${old(s, 0).name} has been in your subs since ${old(s, 0).since.slice(0, 4)}. nostalgia is not a personality.`, old(s, 0).name),
];

const PLAYLISTS: Template[] = [
  (s, k) => pl(s, k) && line(`you named a playlist "${pl(s, k).title}" and thought nobody would ever see it.`, pl(s, k).title),
  (s, k) => pl(s, k) && line(`"${pl(s, k).title}". ${pl(s, k).count} videos. we have notes.`, pl(s, k).title),
  (s, k) => pl(s, k)?.sampleTitles[0] && line(`${pl(s, k).sampleTitles[0]} in a playlist on purpose. bold.`, pl(s, k).sampleTitles[0]),
];

// Numbers are real evidence too, which is what keeps an empty account roastable.
const COUNTS: Template[] = [
  (s) => line(`${s.totals.likes} liked videos. the algorithm has seen houseplants with more opinions.`, n(s.totals.likes)),
  (s) => line(`${s.totals.subscriptions} subscriptions. you're not a viewer, you're a census statistic.`, n(s.totals.subscriptions)),
  (s) => line(`${s.totals.playlists} playlists. organised chaos is still chaos.`, n(s.totals.playlists)),
  (s) => s.totals.likes < 20 && line(`${s.totals.likes} likes in all those years. who hurt you.`, n(s.totals.likes)),
  (s) => s.totals.subscriptions < 10 && line(`${s.totals.subscriptions} subscriptions. even youtube doesn't know what you're into.`, n(s.totals.subscriptions)),
  (s) => s.totals.playlists === 0 && line(`${s.totals.playlists} playlists. you just let youtube decide your entire life.`, n(s.totals.playlists)),
];

const HEADLINES: ((s: QuickSummary) => string | null | false)[] = [
  (s) => !!top(s, 0) && `a personality assembled entirely from ${top(s, 0).name} likes.`,
  () => "your like button has been working overtime to hide something.",
  (s) => s.thinData && "you barely like anything on youtube, and honestly that's the most revealing thing here.",
  (s) => s.subscriptions.abandoned.length >= 3 && "a graveyard of subscriptions you never visit.",
  () => "this was the warm-up, and it's already bad.",
];

const PERSONALITIES: { when: (s: QuickSummary) => boolean; label: string; description: (s: QuickSummary) => string }[] = [
  { when: (s) => s.thinData, label: "THE SILENT LURKER", description: (s) => `${s.totals.likes} likes, ${s.totals.subscriptions} subscriptions. you watch everything and commit to nothing.` },
  { when: (s) => s.subscriptions.abandoned.length >= 5, label: "THE GHOST SUBSCRIBER", description: () => "you subscribe like you collect gym memberships: often, enthusiastically, never again." },
  { when: (s) => s.totals.playlists >= 5, label: "THE PLAYLIST HOARDER", description: (s) => `${s.totals.playlists} playlists. you're not curating, you're avoiding deciding what to watch.` },
  { when: (s) => !!top(s, 0) && top(s, 0).count / Math.max(1, s.totals.likes) >= 0.3, label: "THE ONE-CHANNEL FAN", description: (s) => `${Math.round((100 * top(s, 0).count) / Math.max(1, s.totals.likes))}% of your likes go to one channel. blink twice if you need help.` },
  { when: () => true, label: "THE CASUAL", description: () => "nothing here is wild on its own. together, it's a cry for help with good lighting." },
];

const SLOTS: Template[][] = [TOP_CHANNEL, LIKES, ABANDONED, OLDEST, PLAYLISTS, LIKES, COUNTS];
const TARGET = 8;
const MIN = 6;

export function generateQuickTemplateRoast(summary: QuickSummary): RoastOutput {
  const seed = fnv1a(JSON.stringify(summary));
  const { lines, add } = lineCollector(TARGET);

  SLOTS.forEach((slot, i) => add(choose(slot.map((t) => t(summary, i === 5 ? 1 : 0)), seed + i) as Line | null));
  for (let k = 0; lines.length < MIN && k < COUNTS.length; k++) add(COUNTS[(seed + k) % COUNTS.length](summary, 0) || null);
  for (let k = 0; lines.length < MIN && k < COUNTS.length; k++) add(COUNTS[k](summary, 0) || null);

  const headline = (choose(HEADLINES.map((h) => h(summary)), seed) as string | null) ?? "this was the warm-up, and it's already bad.";
  const personality = PERSONALITIES.find((p) => p.when(summary))!;
  const t0 = top(summary, 0);

  return {
    headline,
    lines,
    personality: { label: personality.label, description: personality.description(summary) },
    eras: [],
    captions: {
      numbers: `${summary.totals.likes} likes, ${summary.totals.subscriptions} subscriptions, ${summary.totals.playlists} playlists.`,
      topChannels: t0 ? `${t0.name} leads your likes with ${t0.count}.` : null,
      rewatched: null,
      clock: null,
      binge: null,
      searches: null,
      contradictions: null,
    },
  };
}
