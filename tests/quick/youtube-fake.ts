// A fake YouTube Data API: generates realistic response shapes so the fetch layer can be tested offline.
export type FakeOptions = {
  likes?: number; // total liked videos available
  subs?: number;
  playlists?: number;
  itemsPerPlaylist?: number;
  status?: number; // force every request to fail with this status
  hang?: boolean; // never answer (until aborted)
  reason?: string; // error reason for failures
};

export function fakeYouTube(opts: FakeOptions = {}) {
  const calls: { url: URL; auth: string | null }[] = [];
  const { likes = 3, subs = 2, playlists = 1, itemsPerPlaylist = 3 } = opts;

  const page = <T,>(total: number, url: URL, make: (i: number) => T) => {
    const start = Number(url.searchParams.get("pageToken") ?? 0);
    const size = Number(url.searchParams.get("maxResults") ?? 5);
    const items = Array.from({ length: Math.max(0, Math.min(size, total - start)) }, (_, k) => make(start + k));
    return { items, pageInfo: { totalResults: total }, ...(start + size < total ? { nextPageToken: String(start + size) } : {}) };
  };

  const fetchFn = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    calls.push({ url, auth: new Headers(init?.headers).get("authorization") });
    if (opts.hang) {
      return new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    }
    if (opts.status) {
      return Response.json({ error: { code: opts.status, errors: [{ reason: opts.reason ?? "forbidden" }] } }, { status: opts.status });
    }
    const path = url.pathname.split("/").pop();
    if (path === "videos") {
      return Response.json(page(likes, url, (i) => ({ id: `vid${String(i).padStart(8, "0")}`, snippet: { title: `Liked video ${i}`, channelTitle: `Channel ${i % 7}` } })));
    }
    if (path === "subscriptions") {
      return Response.json(
        page(subs, url, (i) => ({ snippet: { title: i % 2 ? `Channel ${i % 7}` : `Sub only ${i}`, publishedAt: new Date(Date.UTC(2012 + (i % 12), i % 12, 1)).toISOString() } })),
      );
    }
    if (path === "playlists") {
      return Response.json(page(playlists, url, (i) => ({ id: `pl${i}`, snippet: { title: `playlist ${i}` }, contentDetails: { itemCount: itemsPerPlaylist } })));
    }
    if (path === "playlistItems") {
      const pl = url.searchParams.get("playlistId");
      return Response.json(page(itemsPerPlaylist, url, (i) => ({ snippet: { title: `${pl} song ${i}` } })));
    }
    return new Response("not found", { status: 404 });
  };
  return { fetchFn, calls };
}
