// YouTube thumbnails for evidence cutouts (design Part 3). Ids come from user data, so only the strict id
// shape is ever put into a URL. Thumbnails always link back to the video (design Part 8, YouTube branding).
const VIDEO_ID = /^[A-Za-z0-9_-]{6,20}$/;

export function thumbUrl(videoId: string | null): string | null {
  return videoId && VIDEO_ID.test(videoId) ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : null;
}

export function watchUrl(videoId: string | null): string | null {
  return videoId && VIDEO_ID.test(videoId) ? `https://www.youtube.com/watch?v=${videoId}` : null;
}
