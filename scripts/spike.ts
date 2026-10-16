// Voice spike: run every summary through every provider and write a report to judge by hand.
// Usage: pnpm spike [dir…]   (default: spike/personas + spike/summaries if present)
// SPIKE_TARGETS="gemini:gemini-3.8-flash,groq:qwen/qwen3.8-27b" overrides which models run.
import { existsSync, mkdirSync, readdirSync, readFileSync, appendFileSync } from "node:fs";
import { basename, join } from "node:path";
import { DEFAULT_MODELS, generateRoastWith, type ProviderName } from "../src/lib/roast/providers";
import { validateRoast } from "../src/lib/roast/validate";
import type { Summary } from "../src/lib/summary";

type Target = { provider: ProviderName; model: string };

function targets(): Target[] {
  const raw = process.env.SPIKE_TARGETS;
  if (!raw) {
    return [
      { provider: "gemini", model: process.env.GEMINI_MODEL ?? DEFAULT_MODELS.gemini },
      { provider: "groq", model: process.env.GROQ_MODEL ?? DEFAULT_MODELS.groq },
    ];
  }
  return raw.split(",").map((t) => {
    const [provider, ...rest] = t.trim().split(":");
    return { provider: provider as ProviderName, model: rest.join(":") };
  });
}

function summaryFiles(dirs: string[]): string[] {
  return dirs
    .filter((d) => existsSync(d))
    .flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".json")).map((f) => join(d, f)));
}

async function main() {
  const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ["spike/personas", "spike/summaries"];
  const files = summaryFiles(dirs);
  mkdirSync("spike/out", { recursive: true });
  const out = join("spike/out", `${new Date().toISOString().replace(/[:.]/g, "-")}.md`);
  const write = (s: string) => appendFileSync(out, s + "\n");
  write(`# Voice spike ${new Date().toISOString()}\n`);

  const stats = new Map<string, { ok: number; total: number; ms: number[]; problems: number }>();
  for (const file of files) {
    const summary = JSON.parse(readFileSync(file, "utf8")) as Summary;
    for (const t of targets()) {
      const key = `${t.provider}:${t.model}`;
      const s = stats.get(key) ?? { ok: 0, total: 0, ms: [], problems: 0 };
      stats.set(key, s);
      s.total++;
      write(`## ${basename(file, ".json")} · ${key}\n`);
      const start = performance.now();
      try {
        const roast = await generateRoastWith(t.provider, summary, t.model);
        const ms = Math.round(performance.now() - start);
        const { problems } = validateRoast(roast, summary);
        s.ok++;
        s.ms.push(ms);
        s.problems += problems.length;
        write(`*${ms} ms · ${problems.length} validation problems*\n`);
        if (problems.length) write(problems.map((p) => `- ⚠️ ${p}`).join("\n") + "\n");
        write(`**${roast.headline}**\n`);
        write(roast.lines.map((l, i) => `${i + 1}. ${l.text}  _(evidence: ${l.evidence})_`).join("\n") + "\n");
        write(`**${roast.personality.label}**: ${roast.personality.description}\n`);
        write(`Eras: ${roast.eras.map((e) => `${e.period} "${e.name}"`).join(" · ")}\n`);
        write(Object.entries(roast.captions).map(([k, v]) => `- ${k}: ${v}`).join("\n") + "\n");
      } catch (err) {
        write(`REFUSED/ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
      }
      console.log(`${basename(file)} · ${key} done`);
    }
  }

  console.log(`\nreport: ${out}\n`);
  console.table(
    [...stats].map(([target, s]) => ({
      target,
      success: `${s.ok}/${s.total}`,
      meanMs: s.ms.length ? Math.round(s.ms.reduce((a, b) => a + b, 0) / s.ms.length) : null,
      problems: s.problems,
    })),
  );
}

main();
