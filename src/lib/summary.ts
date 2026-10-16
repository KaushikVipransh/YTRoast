// The Summary is the only thing that ever leaves the browser. It is built by the
// stats engine, sent to the AI, stored with the roast and used to render the report.

export type Named = { name: string; count: number };

export type TitleRef = { title: string; channel: string | null; videoId: string | null };

export type Summary = {
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
