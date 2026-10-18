import { expect, test } from "vitest";
import { YouTubeError, fetchYouTubeData } from "@/lib/quick/youtube";
import { fakeYouTube } from "./youtube-fake";

test("fetches likes, subscriptions and playlists with the bearer token (never in the URL)", async () => {
  const { fetchFn, calls } = fakeYouTube({ likes: 3, subs: 2, playlists: 1, itemsPerPlaylist: 2 });
  const data = await fetchYouTubeData("secret-token", fetchFn);
  expect(data.likes).toEqual([
    { title: "Liked video 0", videoId: "vid00000000", channel: "Channel 0" },
    { title: "Liked video 1", videoId: "vid00000001", channel: "Channel 1" },
    { title: "Liked video 2", videoId: "vid00000002", channel: "Channel 2" },
  ]);
  expect(data.subscriptions).toHaveLength(2);
  expect(data.playlists).toEqual([{ title: "playlist 0", count: 2, items: ["pl0 song 0", "pl0 song 1"] }]);
  for (const call of calls) {
    expect(call.auth).toBe("Bearer secret-token");
    expect(call.url.toString()).not.toContain("secret-token");
    expect(call.url.searchParams.get("maxResults")).toBe("50");
  }
});

test("caps: 10 pages of likes and subs, 10 playlists of ≤50 items, however much exists", async () => {
  const { fetchFn, calls } = fakeYouTube({ likes: 3000, subs: 5000, playlists: 40, itemsPerPlaylist: 400 });
  const data = await fetchYouTubeData("t", fetchFn);
  expect(data.likes).toHaveLength(500);
  expect(data.subscriptions).toHaveLength(500);
  expect(data.playlists).toHaveLength(10);
  expect(data.playlists.every((p) => p.items.length === 50 && p.count === 400)).toBe(true);
  const count = (path: string) => calls.filter((c) => c.url.pathname.endsWith(path)).length;
  expect(count("/videos")).toBe(10);
  expect(count("/subscriptions")).toBe(10);
  expect(count("/playlistItems")).toBe(10);
});

test("401/403 → forbidden", async () => {
  await expect(fetchYouTubeData("t", fakeYouTube({ status: 401 }).fetchFn)).rejects.toMatchObject({ code: "forbidden" });
  await expect(fetchYouTubeData("t", fakeYouTube({ status: 403 }).fetchFn)).rejects.toBeInstanceOf(YouTubeError);
});

test.each(["youtubeSignupRequired", "channelNotFound"])("%s → no-channel", async (reason) => {
  await expect(fetchYouTubeData("t", fakeYouTube({ status: 403, reason }).fetchFn)).rejects.toMatchObject({ code: "no-channel" });
});

test("network failure → network", async () => {
  const failing = async () => {
    throw new TypeError("Failed to fetch");
  };
  await expect(fetchYouTubeData("t", failing)).rejects.toMatchObject({ code: "network" });
});
