import { unzipSync } from "fflate";
import { TakeoutError, type ExtractedFile, type ExtractedFiles } from "./types";

// Matches Takeout's history files anywhere in the zip, including browser re-download names like "watch-history (1).json".
const HISTORY_FILE = /(?:^|\/)(watch|search)-history(?: \(\d+\))?\.(json|html)$/i;
const MAX_FOUND = 20;

type Kind = "watch" | "search";

export function extractTakeoutFiles(name: string, bytes: Uint8Array): ExtractedFiles {
  const files: Record<Kind, Partial<Record<ExtractedFile["format"], string>>> = { watch: {}, search: {} };

  if (/\.zip$/i.test(name)) {
    const found: string[] = [];
    let unzipped: Record<string, Uint8Array>;
    try {
      unzipped = unzipSync(bytes, {
        filter: (file) => {
          if (found.length < MAX_FOUND) found.push(file.name);
          return HISTORY_FILE.test(file.name);
        },
      });
    } catch (err) {
      throw new TakeoutError("unreadable-zip", [name], err instanceof Error ? err.message : undefined);
    }
    const decoder = new TextDecoder();
    for (const [path, data] of Object.entries(unzipped)) {
      const match = HISTORY_FILE.exec(path)!;
      files[match[1].toLowerCase() as Kind][match[2].toLowerCase() as ExtractedFile["format"]] = decoder.decode(data);
    }
    if (!hasAny(files.watch)) throw new TakeoutError("no-watch-history", found);
  } else {
    const match = HISTORY_FILE.exec(name);
    if (!match || match[1].toLowerCase() !== "watch") throw new TakeoutError("no-watch-history", [name]);
    files.watch[match[2].toLowerCase() as ExtractedFile["format"]] = new TextDecoder().decode(bytes);
  }

  return { watch: pick(files.watch)!, search: pick(files.search) };
}

function hasAny(f: Partial<Record<ExtractedFile["format"], string>>): boolean {
  return f.json !== undefined || f.html !== undefined;
}

// JSON is faster and less ambiguous to parse, so it wins when both are present.
function pick(f: Partial<Record<ExtractedFile["format"], string>>): ExtractedFile | null {
  if (f.json !== undefined) return { format: "json", text: f.json };
  if (f.html !== undefined) return { format: "html", text: f.html };
  return null;
}
