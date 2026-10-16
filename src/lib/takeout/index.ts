import { parseSearchHtml, parseWatchHtml } from "./parse-html";
import { parseSearchJson, parseWatchJson } from "./parse-json";
import { TakeoutError, type ExtractedFile, type ExtractedFiles, type ParseResult, type SearchEntry, type WatchEntry } from "./types";

export { extractTakeoutFiles } from "./extract";
export * from "./types";

function parseSearch(file: ExtractedFile | null): ParseResult<SearchEntry> {
  if (!file) return { entries: [], skipped: 0 };
  try {
    return file.format === "json" ? parseSearchJson(file.text) : parseSearchHtml(file.text);
  } catch (err) {
    // Searches are a bonus; a broken search file must not sink a good watch history.
    if (err instanceof TakeoutError) return { entries: [], skipped: 0 };
    throw err;
  }
}

/** Throws TakeoutError "unreadable-history" for a corrupt watch file and "no-entries" when no watches survive. */
export function parseTakeout(files: ExtractedFiles): { watches: WatchEntry[]; searches: SearchEntry[]; skipped: number } {
  const watch = files.watch.format === "json" ? parseWatchJson(files.watch.text) : parseWatchHtml(files.watch.text);
  if (watch.entries.length === 0) throw new TakeoutError("no-entries", [], `0 watches (${watch.skipped} skipped)`);
  const search = parseSearch(files.search);
  return { watches: watch.entries, searches: search.entries, skipped: watch.skipped + search.skipped };
}
