// Browser-side YouTube Data API client for the quick roast (PRD F1). Runs with the user's own short-lived
// token, so their likes and subscriptions never pass through our server. Page caps keep it fast and cheap.

const API = "https://www.googleapis.com/youtube/v3";
const PAGE = 50;
const MAX_PAGES = 10; // 500 likes, 500 subscriptions
const MAX_PLAYLISTS = 10;

export type YouTubeData = {
  likes: { title: string; videoId: string; channel: string | null }[];
  subscriptions: { name: string; since: string }[];
  playlists: { title: string; count: number; items: string[] }[];
};

export type YouTubeErrorCode = "no-channel" | "forbidden" | "network";

export class YouTubeError extends Error {
  readonly code: YouTubeErrorCode;
  constructor(code: YouTubeErrorCode, message?: string) {
    super(message ?? code);
    this.name = "YouTubeError";
    this.code = code;
  }
}

type Page<T> = { items?: T[]; nextPageToken?: string };

async function get<T>(fetchFn: typeof fetch, token: string, path: string, params: Record<string, string>): Promise<Page<T>> {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries({ ...params, maxResults: String(PAGE) })) url.searchParams.set(k, v);
  let res: Response;
  try {
    // The token goes in the header only: URLs end up in logs and history.
    res = await fetchFn(url, { headers: { authorization: `Bearer ${token}` } });
  } catch (err) {
    throw new YouTubeError("network", err instanceof Error ? err.message : undefined);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { errors?: { reason?: string }[] } } | null;
    const reason = body?.error?.errors?.[0]?.reason ?? "";
    if (/youtubeSignupRequired|channelNotFound/.test(reason)) throw new YouTubeError("no-channel", reason);
    throw new YouTubeError(res.status === 401 || res.status === 403 ? "forbidden" : "network", `${res.status} ${reason}`);
  }
  return (await res.json()) as Page<T>;
}

/** Follows nextPageToken up to `maxPages` pages. */
async function all<T>(fetchFn: typeof fetch, token: string, path: string, params: Record<string, string>, maxPages: number): Promise<T[]> {
  const out: T[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const page = await get<T>(fetchFn, token, path, pageToken ? { ...params, pageToken } : params);
    out.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

type Video = { id: string; snippet?: { title?: string; channelTitle?: string } };
type Subscription = { snippet?: { title?: string; publishedAt?: string } };
type Playlist = { id: string; snippet?: { title?: string }; contentDetails?: { itemCount?: number } };
type PlaylistItem = { snippet?: { title?: string } };

export async function fetchYouTubeData(token: string, fetchFn: typeof fetch = fetch): Promise<YouTubeData> {
  const [videos, subs, playlists] = await Promise.all([
    all<Video>(fetchFn, token, "videos", { myRating: "like", part: "snippet" }, MAX_PAGES),
    all<Subscription>(fetchFn, token, "subscriptions", { mine: "true", part: "snippet" }, MAX_PAGES),
    all<Playlist>(fetchFn, token, "playlists", { mine: "true", part: "snippet,contentDetails" }, 1),
  ]);

  const kept = playlists.slice(0, MAX_PLAYLISTS);
  const items = await Promise.all(
    kept.map((p) => all<PlaylistItem>(fetchFn, token, "playlistItems", { playlistId: p.id, part: "snippet" }, 1)),
  );

  return {
    likes: videos.map((v) => ({ title: v.snippet?.title ?? "", videoId: v.id, channel: v.snippet?.channelTitle?.trim() || null })),
    subscriptions: subs.map((s) => ({ name: s.snippet?.title ?? "", since: s.snippet?.publishedAt ?? "" })),
    playlists: kept.map((p, i) => ({
      title: p.snippet?.title ?? "",
      count: p.contentDetails?.itemCount ?? items[i].length,
      items: items[i].map((it) => it.snippet?.title ?? "").filter(Boolean),
    })),
  };
}
