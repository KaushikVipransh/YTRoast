export type WatchEntry = { title: string; videoId: string | null; channel: string | null; time: Date };

export type SearchEntry = { query: string; time: Date };

export type ExtractedFile = { format: "json" | "html"; text: string };

export type ExtractedFiles = { watch: ExtractedFile; search: ExtractedFile | null };

export type ParseResult<T> = { entries: T[]; skipped: number };

/**
 * no-watch-history: the upload has no watch-history file · unreadable-zip: corrupt zip
 * unreadable-history: the history file is not valid Takeout JSON · no-entries: parsed, but zero watches
 */
export type TakeoutErrorCode = "no-watch-history" | "unreadable-zip" | "unreadable-history" | "no-entries";

export class TakeoutError extends Error {
  readonly code: TakeoutErrorCode;
  /** What we found instead (file names), so the UI can say "that's ___, not your history". */
  readonly found: string[];

  constructor(code: TakeoutErrorCode, found: string[], message?: string) {
    super(message ?? code);
    this.name = "TakeoutError";
    this.code = code;
    this.found = found;
  }
}
