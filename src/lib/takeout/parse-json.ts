import type { ParseResult, SearchEntry, WatchEntry } from "./types";

type RawEntry = {
  title?: string;
  titleUrl?: string;
  subtitles?: { name?: string }[];
  time?: string;
  details?: { name?: string }[];
};

function isAd(e: RawEntry): boolean {
  return e.details?.some((d) => d.name === "From Google Ads") ?? false;
}

function parseTime(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function urlParam(url: string, key: string): string | null {
  try {
    return new URL(url).searchParams.get(key);
  } catch {
    return null;
  }
}

function readArray(text: string): RawEntry[] {
  const data: unknown = JSON.parse(text);
  return Array.isArray(data) ? (data as RawEntry[]) : [];
}

export function parseWatchJson(text: string): ParseResult<WatchEntry> {
  const entries: WatchEntry[] = [];
  let skipped = 0;
  for (const e of readArray(text)) {
    const time = parseTime(e.time);
    // No titleUrl means the video was removed or made private.
    if (isAd(e) || !e.titleUrl || !e.title || !time) {
      skipped++;
      continue;
    }
    entries.push({
      title: e.title.replace(/^Watched /, ""),
      videoId: urlParam(e.titleUrl, "v"),
      channel: e.subtitles?.[0]?.name || null,
      time,
    });
  }
  return { entries, skipped };
}

export function parseSearchJson(text: string): ParseResult<SearchEntry> {
  const entries: SearchEntry[] = [];
  let skipped = 0;
  for (const e of readArray(text)) {
    const time = parseTime(e.time);
    const query = (e.titleUrl && urlParam(e.titleUrl, "search_query")) || e.title?.replace(/^Searched for /, "");
    if (isAd(e) || !query || !time) {
      skipped++;
      continue;
    }
    entries.push({ query, time });
  }
  return { entries, skipped };
}
