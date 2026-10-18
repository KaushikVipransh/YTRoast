// The Summary is the only thing that ever leaves the browser. It is built by the
// stats engine, sent to the AI, stored with the roast and used to render the report.

export type Named = { name: string; count: number };

export type TitleRef = { title: string; channel: string | null; videoId: string | null };

/** Built from a Google Takeout watch history (the full roast). */
export type TakeoutSummary = {
  version: 1;
  source: "takeout";
  totals: {
    videos: number;
    channels: number;
    firstWatch: string | null;
    lastWatch: string | null;
    spanDays: number;
  };
  /** ≤10, count desc, name asc */
  topChannels: Named[];
  /** ≤10, count ≥ 2 */
  topRewatched: (TitleRef & { count: number })[];
  /** length 24, local hour */
  hours: number[];
  /** length 7, 0 = Sunday */
  weekdays: number[];
  /** integer 0–100, share of watches in local hours 0–4 */
  afterMidnightPct: number;
  /** distinct local dates with a watch at 02:00–04:59 */
  lateNights: number;
  /** date is YYYY-MM-DD, ≤5 titles */
  longestBinge: { date: string; count: number; sampleTitles: string[] } | null;
  /** period like "2024-Q1", ascending, last 12, ≤3 channels and titles each */
  eras: { period: string; count: number; topChannels: string[]; sampleTitles: string[] }[];
  /** ≤10 each */
  searches: { total: number; topRepeated: Named[]; lateNight: { query: string; time: string }[] } | null;
  /** latestNight ≤5, oneOffs ≤10 */
  samples: { latestNight: (TitleRef & { time: string })[]; oneOffs: TitleRef[] };
  /** totals.videos < 50 */
  thinData: boolean;
};

/** Built in the browser from the YouTube API: likes, subscriptions and playlists (the quick roast, PRD F1). */
export type QuickSummary = {
  version: 1;
  source: "quick";
  totals: { likes: number; subscriptions: number; playlists: number };
  /** ≤10, channels of liked videos, count desc, name asc */
  topChannels: Named[];
  /** ≤15, spread evenly through the likes */
  likedSamples: TitleRef[];
  /** oldest ≤5 (since = YYYY-MM-DD); abandoned ≤10 = subscribed channels with zero likes */
  subscriptions: { oldest: { name: string; since: string }[]; abandoned: string[] };
  /** ≤10 playlists, ≤3 sample titles each */
  playlists: { title: string; count: number; sampleTitles: string[] }[];
  /** likes + subscriptions < 20 */
  thinData: boolean;
};

export type Summary = TakeoutSummary | QuickSummary;
