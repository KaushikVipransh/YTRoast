import { TakeoutError, type ParseResult, type SearchEntry, type WatchEntry } from "./types";

type RawEntry = {
  title?: string;
  titleUrl?: string;
  subtitles?: { name?: string }[];
  time?: string;
  details?: { name?: string }[];
};

function isAd(e: RawEntry): boolean {
  return Array.isArray(e.details) && e.details.some((d) => d?.name === "From Google Ads");
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

/** Throws unreadable-history for corrupt JSON or a non-array; drops entries that are not objects. */
function readArray(text: string): RawEntry[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new TakeoutError("unreadable-history", []);
  }
  if (!Array.isArray(data)) throw new TakeoutError("unreadable-history", []);
  return data.map((e) => (e && typeof e === "object" ? (e as RawEntry) : {}));
}

// Videos that later went private show up titled with their own URL; treat them as removed.
export const isUrlTitle = (title: string) => /^(Watched )?https?:\/\//.test(title);

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

export function parseWatchJson(text: string): ParseResult<WatchEntry> {
  const entries: WatchEntry[] = [];
  let skipped = 0;
  for (const e of readArray(text)) {
    const time = parseTime(str(e.time));
    const title = str(e.title);
    const titleUrl = str(e.titleUrl);
    // No titleUrl means the video was removed or made private.
    if (isAd(e) || !titleUrl || !title || isUrlTitle(title) || !time) {
      skipped++;
      continue;
    }
    entries.push({
      title: title.replace(/^Watched /, ""),
      videoId: urlParam(titleUrl, "v"),
      channel: str(e.subtitles?.[0]?.name)?.trim() || null,
      time,
    });
  }
  return { entries, skipped };
}

export function parseSearchJson(text: string): ParseResult<SearchEntry> {
  const entries: SearchEntry[] = [];
  let skipped = 0;
  for (const e of readArray(text)) {
    const time = parseTime(str(e.time));
    const titleUrl = str(e.titleUrl);
    const query = (titleUrl && urlParam(titleUrl, "search_query")) || str(e.title)?.replace(/^Searched for /, "");
    if (isAd(e) || !query || !time) {
      skipped++;
      continue;
    }
    entries.push({ query, time });
  }
  return { entries, skipped };
}
