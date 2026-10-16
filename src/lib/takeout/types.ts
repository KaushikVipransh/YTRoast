export type WatchEntry = { title: string; videoId: string | null; channel: string | null; time: Date };

export type SearchEntry = { query: string; time: Date };

export type ExtractedFile = { format: "json" | "html"; text: string };

export type ExtractedFiles = { watch: ExtractedFile; search: ExtractedFile | null };

export type ParseResult<T> = { entries: T[]; skipped: number };

export type TakeoutErrorCode = "no-watch-history" | "unreadable-zip";

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
