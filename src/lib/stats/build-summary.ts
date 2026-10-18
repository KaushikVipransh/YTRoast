import type { Named, TakeoutSummary, TitleRef } from "@/lib/summary";
import type { SearchEntry, WatchEntry } from "@/lib/takeout/types";
import { localDateKey, localIso, quarterKey } from "./time";

const MAX_TEXT = 120;
// Byte cap per string keeps the whole Summary under ~30 KB even for CJK/emoji-heavy histories.
const MAX_TEXT_BYTES = 160;
const TOP = 10;
const MAX_ERAS = 12;
const PER_ERA = 3;
const BINGE_TITLES = 5;
const LATEST_NIGHT = 5;
const THIN_DATA_BELOW = 50;
const DAY_MS = 86_400_000;

const utf8Bytes = (cp: number) => (cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4);

/** Truncates to ≤120 UTF-16 units and ≤160 UTF-8 bytes, ending in "…", never splitting a code point. */
function clip(s: string): string {
  let units = 0;
  let bytes = 0;
  for (const ch of s) {
    units += ch.length;
    bytes += utf8Bytes(ch.codePointAt(0)!);
  }
  if (units <= MAX_TEXT && bytes <= MAX_TEXT_BYTES) return s;

  let out = "";
  units = 1; // room for "…"
  bytes = 3;
  for (const ch of s) {
    const b = utf8Bytes(ch.codePointAt(0)!);
    if (units + ch.length > MAX_TEXT || bytes + b > MAX_TEXT_BYTES) break;
    out += ch;
    units += ch.length;
    bytes += b;
  }
  return out + "…";
}

function ref(w: WatchEntry): TitleRef {
  return { title: clip(w.title), channel: w.channel === null ? null : clip(w.channel), videoId: w.videoId };
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Count desc, then key asc, so output never depends on input order. */
function ranked(map: Map<string, number>, limit: number, minCount = 1): Named[] {
  return [...map]
    .filter(([, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1] || compare(a[0], b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name: clip(name), count }));
}

const secondsOfDay = (d: Date) => d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
const isAfterMidnight = (d: Date) => d.getHours() < 5;

export function buildTakeoutSummary(watches: WatchEntry[], searches: SearchEntry[]): TakeoutSummary {
  const sorted = [...watches].sort((a, b) => a.time.getTime() - b.time.getTime());

  const channels = new Map<string, number>();
  const videos = new Map<string, { count: number; latest: WatchEntry }>();
  const perDay = new Map<string, WatchEntry[]>();
  const perQuarter = new Map<string, { count: number; channels: Map<string, number>; titles: Map<string, number> }>();
  const lateNightDates = new Set<string>();
  const hours = Array<number>(24).fill(0);
  const weekdays = Array<number>(7).fill(0);
  const nightWatches: WatchEntry[] = [];

  for (const w of sorted) {
    const hour = w.time.getHours();
    hours[hour]++;
    weekdays[w.time.getDay()]++;
    if (w.channel !== null) bump(channels, w.channel);

    const videoKey = w.videoId ?? `title:${w.title}`;
    const video = videos.get(videoKey);
    if (video) {
      video.count++;
      video.latest = w;
    } else {
      videos.set(videoKey, { count: 1, latest: w });
    }

    const day = localDateKey(w.time);
    const dayList = perDay.get(day);
    if (dayList) dayList.push(w);
    else perDay.set(day, [w]);

    const qKey = quarterKey(w.time);
    let quarter = perQuarter.get(qKey);
    if (!quarter) {
      quarter = { count: 0, channels: new Map(), titles: new Map() };
      perQuarter.set(qKey, quarter);
    }
    quarter.count++;
    if (w.channel !== null) bump(quarter.channels, w.channel);
    bump(quarter.titles, w.title);

    if (hour >= 2 && hour < 5) lateNightDates.add(day);
    if (isAfterMidnight(w.time)) nightWatches.push(w);
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  return {
    version: 1,
    source: "takeout",
    totals: {
      videos: sorted.length,
      channels: channels.size,
      firstWatch: first ? localIso(first.time) : null,
      lastWatch: last ? localIso(last.time) : null,
      spanDays: first && last ? Math.floor((last.time.getTime() - first.time.getTime()) / DAY_MS) : 0,
    },
    topChannels: ranked(channels, TOP),
    topRewatched: [...videos.values()]
      .filter((v) => v.count >= 2)
      .sort(
        (a, b) =>
          b.count - a.count ||
          compare(a.latest.title, b.latest.title) ||
          compare(a.latest.videoId ?? "", b.latest.videoId ?? ""),
      )
      .slice(0, TOP)
      .map((v) => ({ ...ref(v.latest), count: v.count })),
    hours,
    weekdays,
    afterMidnightPct: sorted.length ? Math.round((100 * nightWatches.length) / sorted.length) : 0,
    lateNights: lateNightDates.size,
    longestBinge: longestBinge(perDay),
    eras: [...perQuarter]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-MAX_ERAS)
      .map(([period, q]) => ({
        period,
        count: q.count,
        topChannels: ranked(q.channels, PER_ERA).map((c) => c.name),
        sampleTitles: ranked(q.titles, PER_ERA).map((t) => t.name),
      })),
    searches: summarizeSearches(searches),
    samples: {
      latestNight: nightWatches
        .sort((a, b) => secondsOfDay(b.time) - secondsOfDay(a.time) || b.time.getTime() - a.time.getTime())
        .slice(0, LATEST_NIGHT)
        .map((w) => ({ ...ref(w), time: localIso(w.time) })),
      oneOffs: oneOffs(sorted, channels),
    },
    thinData: sorted.length < THIN_DATA_BELOW,
  };
}

function longestBinge(perDay: Map<string, WatchEntry[]>): TakeoutSummary["longestBinge"] {
  let best: [string, WatchEntry[]] | null = null;
  // perDay was filled in time order, so the first max found is the earliest date.
  for (const entry of perDay) if (!best || entry[1].length > best[1].length) best = entry;
  if (!best) return null;
  const titles = [...new Set(best[1].map((w) => w.title))].slice(0, BINGE_TITLES).map(clip);
  return { date: best[0], count: best[1].length, sampleTitles: titles };
}

function summarizeSearches(searches: SearchEntry[]): TakeoutSummary["searches"] {
  if (searches.length === 0) return null;
  const counts = new Map<string, number>();
  for (const s of searches) bump(counts, s.query);
  return {
    total: searches.length,
    topRepeated: ranked(counts, TOP, 2),
    lateNight: searches
      .filter((s) => isAfterMidnight(s.time))
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, TOP)
      .map((s) => ({ query: clip(s.query), time: localIso(s.time) })),
  };
}

/** Channels watched exactly once, sampled evenly across history: the odd outliers. */
function oneOffs(sorted: WatchEntry[], channels: Map<string, number>): TitleRef[] {
  const once = sorted.filter((w) => w.channel !== null && channels.get(w.channel) === 1);
  const step = Math.max(1, Math.ceil(once.length / TOP));
  const picked: TitleRef[] = [];
  for (let i = 0; i < once.length && picked.length < TOP; i += step) picked.push(ref(once[i]));
  return picked;
}
