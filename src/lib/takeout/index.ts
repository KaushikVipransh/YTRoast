import { parseSearchHtml, parseWatchHtml } from "./parse-html";
import { parseSearchJson, parseWatchJson } from "./parse-json";
import type { ExtractedFiles, SearchEntry, WatchEntry } from "./types";

export { extractTakeoutFiles } from "./extract";
export * from "./types";

export function parseTakeout(files: ExtractedFiles): { watches: WatchEntry[]; searches: SearchEntry[]; skipped: number } {
  const watch = files.watch.format === "json" ? parseWatchJson(files.watch.text) : parseWatchHtml(files.watch.text);
  const search = !files.search
    ? { entries: [], skipped: 0 }
    : files.search.format === "json"
      ? parseSearchJson(files.search.text)
      : parseSearchHtml(files.search.text);
  return { watches: watch.entries, searches: search.entries, skipped: watch.skipped + search.skipped };
}
