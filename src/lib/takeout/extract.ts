import { unzipSync } from "fflate";
import { TakeoutError, type ExtractedFile, type ExtractedFiles } from "./types";

// Matches Takeout's history files anywhere in the zip, including browser re-download names like "watch-history (1).json".
const HISTORY_FILE = /(?:^|\/)(watch|search)-history( \(\d+\))?\.(json|html)$/i;
const TAR_ARCHIVE = /\.(tgz|tar\.gz)$/i;
const MAX_FOUND = 20;

type Kind = "watch" | "search";
type Format = ExtractedFile["format"];
type Candidate = { suffixed: boolean; data: Uint8Array };

export function extractTakeoutFiles(name: string, bytes: Uint8Array): ExtractedFiles {
  if (TAR_ARCHIVE.test(name)) throw new TakeoutError("unsupported-archive", [name]);

  const files: Record<Kind, Partial<Record<Format, Candidate>>> = { watch: {}, search: {} };

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
    for (const [path, data] of Object.entries(unzipped)) {
      const match = HISTORY_FILE.exec(path)!;
      const slot = files[match[1].toLowerCase() as Kind];
      const format = match[3].toLowerCase() as Format;
      const candidate = { suffixed: match[2] !== undefined, data };
      if (!slot[format] || better(candidate, slot[format]!)) slot[format] = candidate;
    }
    if (!files.watch.json && !files.watch.html) throw new TakeoutError("no-watch-history", found);
  } else {
    const match = HISTORY_FILE.exec(name);
    if (!match || match[1].toLowerCase() !== "watch") throw new TakeoutError("no-watch-history", [name]);
    files.watch[match[3].toLowerCase() as Format] = { suffixed: false, data: bytes };
  }

  return { watch: pick(files.watch)!, search: pick(files.search) };
}

/** The original name beats a re-download copy; between copies, the bigger file is the more complete export. */
function better(a: Candidate, b: Candidate): boolean {
  if (a.suffixed !== b.suffixed) return !a.suffixed;
  return a.data.length > b.data.length;
}

// JSON is faster and less ambiguous to parse, so it wins when both are present.
function pick(f: Partial<Record<Format, Candidate>>): ExtractedFile | null {
  const decode = (c: Candidate) => new TextDecoder().decode(c.data);
  if (f.json) return { format: "json", text: decode(f.json) };
  if (f.html) return { format: "html", text: decode(f.html) };
  return null;
}
