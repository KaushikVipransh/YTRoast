// Turn a real Takeout export into a Summary for the voice spike.
// Usage: pnpm summarize <path-to-takeout.zip|watch-history.json|watch-history.html> [label]
// Output: spike/summaries/real-<label>.json (gitignored: it's personal data).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { buildTakeoutSummary } from "../src/lib/stats/build-summary";
import { extractTakeoutFiles, parseTakeout, TakeoutError } from "../src/lib/takeout";

function main() {
  const [path, label] = process.argv.slice(2);
  if (!path) {
    console.error("usage: pnpm summarize <takeout.zip|watch-history.json|watch-history.html> [label]");
    process.exit(1);
  }

  const start = performance.now();
  try {
    const files = extractTakeoutFiles(basename(path), new Uint8Array(readFileSync(path)));
    const { watches, searches, skipped } = parseTakeout(files);
    const summary = buildTakeoutSummary(watches, searches);
    const json = JSON.stringify(summary, null, 2);

    mkdirSync("spike/summaries", { recursive: true });
    const name = (label ?? basename(path, extname(path))).replace(/[^\w-]+/g, "-");
    const out = join("spike/summaries", `real-${name}.json`);
    writeFileSync(out, json);

    console.log(`videos: ${summary.totals.videos} · channels: ${summary.totals.channels} · searches: ${searches.length} · skipped: ${skipped}`);
    console.log(`took ${Math.round(performance.now() - start)} ms · summary ${(JSON.stringify(summary).length / 1024).toFixed(1)} KB`);
    console.log(`wrote ${out}`);
  } catch (err) {
    if (err instanceof TakeoutError) {
      console.error(`${err.code}: found ${JSON.stringify(err.found)}`);
      process.exit(1);
    }
    throw err;
  }
}

main();
