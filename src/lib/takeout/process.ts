import { buildTakeoutSummary } from "@/lib/stats/build-summary";
import type { TakeoutSummary } from "@/lib/summary";
import { parseTakeout } from "./index";
import { extractTakeoutFiles } from "./extract";
import { TakeoutError, type TakeoutErrorCode } from "./types";

export type ProcessResult =
  | { ok: true; summary: TakeoutSummary; counts: { videos: number; channels: number; searches: number } }
  | { ok: false; code: TakeoutErrorCode | "unknown"; found: string[] };

/**
 * The whole browser-side pipeline: file → Summary. Runs inside the Web Worker.
 * Never throws: errors come back as plain data because class instances don't survive postMessage.
 */
export function processTakeout(name: string, bytes: Uint8Array): ProcessResult {
  try {
    const { watches, searches } = parseTakeout(extractTakeoutFiles(name, bytes));
    const summary = buildTakeoutSummary(watches, searches);
    return {
      ok: true,
      summary,
      counts: { videos: summary.totals.videos, channels: summary.totals.channels, searches: searches.length },
    };
  } catch (err) {
    if (err instanceof TakeoutError) return { ok: false, code: err.code, found: err.found };
    console.error("[takeout] unexpected error", err);
    return { ok: false, code: "unknown", found: [] };
  }
}
