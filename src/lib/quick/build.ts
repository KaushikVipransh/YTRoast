import { clip } from "@/lib/stats/clip";
import type { Named, QuickSummary, TitleRef } from "@/lib/summary";
import type { YouTubeData } from "./youtube";

const TOP = 10;
const SAMPLES = 15;
const OLDEST = 5;
const ABANDONED = 10;
const PLAYLIST_TITLES = 3;
const THIN_BELOW = 20;

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const day = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : null);

/** The quick-roast summary: what you like, who you follow, what you hoard in playlists. Pure and deterministic. */
export function buildQuickSummary(data: YouTubeData): QuickSummary {
  const channelCounts = new Map<string, number>();
  for (const like of data.likes) if (like.channel) channelCounts.set(like.channel, (channelCounts.get(like.channel) ?? 0) + 1);

  const topChannels: Named[] = [...channelCounts]
    .sort((a, b) => b[1] - a[1] || compare(a[0], b[0]))
    .slice(0, TOP)
    .map(([name, count]) => ({ name: clip(name), count }));

  const step = Math.max(1, Math.ceil(data.likes.length / SAMPLES));
  const likedSamples: TitleRef[] = [];
  for (let i = 0; i < data.likes.length && likedSamples.length < SAMPLES; i += step) {
    const like = data.likes[i];
    likedSamples.push({ title: clip(like.title), channel: like.channel ? clip(like.channel) : null, videoId: like.videoId });
  }

  const dated = data.subscriptions
    .map((s) => ({ name: s.name, since: day(s.since) }))
    .filter((s): s is { name: string; since: string } => s.since !== null && s.name.length > 0);
  const oldest = [...dated]
    .sort((a, b) => compare(a.since, b.since) || compare(a.name, b.name))
    .slice(0, OLDEST)
    .map((s) => ({ name: clip(s.name), since: s.since }));
  // Channels you subscribed to but never liked a single video from.
  const abandoned = dated
    .filter((s) => !channelCounts.has(s.name))
    .sort((a, b) => compare(a.since, b.since) || compare(a.name, b.name))
    .slice(0, ABANDONED)
    .map((s) => clip(s.name));

  return {
    version: 1,
    source: "quick",
    totals: { likes: data.likes.length, subscriptions: data.subscriptions.length, playlists: data.playlists.length },
    topChannels,
    likedSamples,
    subscriptions: { oldest, abandoned },
    playlists: data.playlists.slice(0, TOP).map((p) => ({
      title: clip(p.title),
      count: p.count,
      sampleTitles: p.items.slice(0, PLAYLIST_TITLES).map(clip),
    })),
    thinData: data.likes.length + data.subscriptions.length < THIN_BELOW,
  };
}
