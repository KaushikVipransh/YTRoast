# Caught Watching — Phase 1: Voice Spike, Takeout Parser, Stats Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove free Gemini/Groq can write brutal, human roasts, then build the tested browser-side pipeline (Takeout file → entries → `Summary`) that every later phase feeds into the AI.

**Architecture:** Next.js 16 app scaffolded now but with no UI yet. Pure TypeScript libraries under `src/lib/` (takeout parsing, stats, roast schema/prompt/validation) are unit-tested with Vitest. Two Node scripts (`scripts/spike.ts`, `scripts/summarize.ts`) exercise the libraries against real AI providers and real Takeout exports.

**Tech Stack:** Next.js 16 · TypeScript · pnpm · Vitest · Zod 4 · Vercel AI SDK (`ai` + `@ai-sdk/google` + `@ai-sdk/groq`) · fflate · htmlparser2 · tsx

**Spec:** `docs/superpowers/specs/2026-10-17-prd.md`, `docs/superpowers/specs/2026-10-17-tech-stack.md` (design doc not needed for this phase)

**Phase map (later plans, one per phase, written after this one ships):**
2. Roast API + Supabase DB + `/r/[id]` share page + OG image (Gemini→Groq→template chain, Web Worker + upload UI)
3. Quick path (GIS + YouTube API) behind `NEXT_PUBLIC_QUICK_PATH_ENABLED`
4. Design system, report spreads, motion
5. Rate limits, oven-full, privacy/terms, analytics, Sentry

## Global Constraints

- $0/month: free tiers only. No paid API, no paid package.
- Raw watch history never leaves the browser; only a `Summary` (target ≤ 30 KB JSON) is ever sent to a server or AI.
- The AI never does maths. All numbers come from the stats engine.
- No topic restrictions in prompts. Gemini safety settings at `BLOCK_NONE` for all four adjustable categories.
- Voice: r/RoastMe. Every line cites one specific piece of evidence. Most lines ≤ 25 words. No em dashes in roast lines.
- Banned phrases (case-insensitive): `ah,` · `let's dive in` · `it seems like` · `not only` · `a testament to` · `journey` · `delve` · `tapestry` · `whether you're` · `but hey` · `at least`, plus the em dash `—`.
- English-only Takeout exports are supported in v1.
- Do not hard-code free-tier quotas. Model IDs come from env vars `GEMINI_MODEL` and `GROQ_MODEL`.
- Secrets live in `.env.local` (already present with `GEMINI_API_KEY`, `GROQ_API_KEY`; gitignored). Never print them.
- Personal data produced by scripts (`spike/out/`, `spike/summaries/real-*`) is gitignored.

## Review Focus

1. **Heavy user, 100k+ entries.** Stats must stay linear (Maps, single passes). Expect < 2 s and a Summary < 30 KB. Test is in Task 5.
2. **HTML-only Takeout (Google's default format).** The HTML parser is as complete as JSON, including the narrow no-break space before AM/PM. Tests are in Task 4.
3. **Entries without a channel** (YouTube Music, deleted channels). These must never show up as a channel named `"null"` or `""`. Tests are in Tasks 3 and 5.
4. **Messy titles** (HTML entities, emoji, 300-char titles). Titles must be decoded and truncated to 120 chars. Tests are in Tasks 4 and 5.
5. **Wrong file dropped** (a zip without watch history, or `my-photo.jpg`). The error must be typed and name what was found. Test is in Task 3.

---

## File Structure

```
src/lib/summary.ts             Summary type (contract between stats, AI, DB, UI)
src/lib/roast/schema.ts        Zod RoastOutput schema + type
src/lib/roast/validate.ts      banned-phrase + evidence validator
src/lib/roast/prompt.ts        system prompt + buildRoastPrompt(summary)
src/lib/roast/providers.ts     generateRoastWith(provider, summary)
src/lib/takeout/types.ts       WatchEntry, SearchEntry, ExtractedFiles, TakeoutError
src/lib/takeout/extract.ts     extractTakeoutFiles(name, bytes)
src/lib/takeout/parse-json.ts  parseWatchJson, parseSearchJson
src/lib/takeout/parse-html.ts  parseWatchHtml, parseSearchHtml, parseTakeoutDate
src/lib/takeout/index.ts       parseTakeout(files)
src/lib/stats/build-summary.ts buildTakeoutSummary(watches, searches)
src/lib/stats/time.ts          localDateKey, quarterKey helpers
tests/**                       mirrors src/lib
spike/personas/*.json          5 hand-written persona Summaries (committed)
scripts/spike.ts               runs summaries × providers → spike/out/<timestamp>.md
scripts/summarize.ts           Takeout file → spike/summaries/real-<name>.json
```

---

### Task 1: Scaffold, Summary contract, roast schema + validator

**Files:**
- Create: Next.js app at repo root, `vitest.config.ts`, `src/lib/summary.ts`, `src/lib/roast/schema.ts`, `src/lib/roast/validate.ts`
- Test: `tests/roast/validate.test.ts`

**Interfaces:**
- Produces:
```ts
// src/lib/summary.ts
export type Named = { name: string; count: number };
export type TitleRef = { title: string; channel: string | null; videoId: string | null };
export type Summary = {
  version: 1;
  source: "takeout";
  totals: { videos: number; channels: number; firstWatch: string | null; lastWatch: string | null; spanDays: number };
  topChannels: Named[];                                  // ≤10, count desc, name asc
  topRewatched: (TitleRef & { count: number })[];        // ≤10, count ≥ 2
  hours: number[];                                       // length 24, local hour
  weekdays: number[];                                    // length 7, 0 = Sunday
  afterMidnightPct: number;                              // integer 0–100, hours 0–4
  lateNights: number;                                    // distinct local dates with a watch at 02:00–04:59
  longestBinge: { date: string; count: number; sampleTitles: string[] } | null; // date YYYY-MM-DD, ≤5 titles
  eras: { period: string; count: number; topChannels: string[]; sampleTitles: string[] }[]; // "2024-Q1", ascending, last 12, ≤3 each
  searches: { total: number; topRepeated: Named[]; lateNight: { query: string; time: string }[] } | null; // ≤10 each
  samples: { latestNight: (TitleRef & { time: string })[]; oneOffs: TitleRef[] }; // ≤5, ≤10
  thinData: boolean;                                     // totals.videos < 50
};
// src/lib/roast/schema.ts
export const RoastOutputSchema; export type RoastOutput = z.infer<typeof RoastOutputSchema>;
// { headline: string(≤140); lines: {text: string; evidence: string}[] (6–10);
//   personality: {label: string(≤40); description: string}; eras: {period: string; name: string}[];
//   captions: { numbers?, topChannels?, rewatched?, clock?, binge?, searches?, contradictions?: string } }
// src/lib/roast/validate.ts
export const BANNED_PHRASES: readonly string[];
export function findBannedPhrases(text: string): string[];
export function validateRoast(out: RoastOutput, summary: Summary): { ok: boolean; problems: string[] };
```

- [ ] **Step 1: Scaffold.** Run `git init`, then `pnpm create next-app@16 . --ts --tailwind --app --src-dir --eslint --import-alias "@/*" --use-pnpm --yes`. (If it refuses the non-empty dir, scaffold into a temp dir and move the files in, keeping `docs/`, `.env.local`, `.gitignore` entries.) Add `.gitignore` lines `spike/out/` and `spike/summaries/real-*`. Install `pnpm add zod ai @ai-sdk/google @ai-sdk/groq fflate htmlparser2 domutils entities` and `pnpm add -D vitest tsx`. Add scripts `"test": "vitest run"`, `"spike": "tsx --env-file=.env.local scripts/spike.ts"`, `"summarize": "tsx scripts/summarize.ts"`. Create `vitest.config.ts` with `test: { include: ["tests/**/*.test.ts"], env: { TZ: "UTC" } }` and an `@` alias to `src`.

- [ ] **Step 2: Write the Summary type and the Zod schema** exactly as in Interfaces. `lines` uses `.min(6).max(10)`.

- [ ] **Step 3: Write failing tests** in `tests/roast/validate.test.ts`:
```ts
test("finds banned phrases case-insensitively", () => {
  expect(findBannedPhrases("Ah, a JOURNEY of self — discovery")).toEqual(["ah,", "journey", "—"]);
});
test("clean line passes", () => {
  expect(findBannedPhrases("31 rewatches of the same minecraft ending. it's not getting better.")).toEqual([]);
});
test("flags line whose evidence is missing from its text", () => {
  const r = validateRoast(roastWith([{ text: "you watch too much", evidence: "MrBeast" }]), summaryWithChannel("MrBeast"));
  expect(r.ok).toBe(false);
  expect(r.problems).toContain('line 1: evidence "MrBeast" not in text');
});
test("flags evidence not found anywhere in summary", () => {
  const r = validateRoast(roastWith([{ text: "all that PewDiePie", evidence: "PewDiePie" }]), summaryWithChannel("MrBeast"));
  expect(r.problems).toContain('line 1: evidence "PewDiePie" not in data');
});
test("flags banned phrase in headline", () => {
  const r = validateRoast({ ...roastWith(sixGoodLines), headline: "Let's dive in" }, summaryWithChannel("MrBeast"));
  expect(r.problems).toContain('headline: banned "let\'s dive in"');
});
```
`roastWith(lines)` and `summaryWithChannel(name)` are local test helpers that build a minimal valid `RoastOutput` / `Summary`. `sixGoodLines` is 6 lines all citing `"MrBeast"`.

- [ ] **Step 4: Run** `pnpm test`. Expected: FAIL, since `findBannedPhrases` is not defined.

- [ ] **Step 5: Implement `validate.ts`.** `findBannedPhrases` returns the matches in `BANNED_PHRASES` order. `validateRoast` checks the headline, every line's text, the personality label and description, and the captions. Evidence checks are case-insensitive: `text.includes(evidence)` and `JSON.stringify(summary).includes(evidence)`. Problem strings use the formats asserted above.

- [ ] **Step 6: Run** `pnpm test && pnpm build`. Expected: all PASS, and the build succeeds.

- [ ] **Step 7: Commit** with `git add -A && git commit -m "chore: scaffold app; add Summary contract and roast validator"`

---

### Task 2: Prompt, providers, voice spike ⚠️ human gate

**Files:**
- Create: `src/lib/roast/prompt.ts`, `src/lib/roast/providers.ts`, `scripts/spike.ts`, `spike/personas/{gym-bro,3am-philosopher,minecraft-adult,self-help-addict,thin-data}.json`
- Test: `tests/roast/prompt.test.ts`

**Interfaces:**
- Consumes: `Summary`, `RoastOutputSchema`, `validateRoast` (Task 1)
- Produces:
```ts
export const SYSTEM_PROMPT: string;
export function buildRoastPrompt(summary: Summary): string;
export type ProviderName = "gemini" | "groq";
export function generateRoastWith(provider: ProviderName, summary: Summary): Promise<RoastOutput>; // throws on refusal/schema failure
```

- [ ] **Step 1: Write failing tests**:
```ts
test("prompt embeds summary JSON and thin-data hint", () => {
  const p = buildRoastPrompt(thinSummary);
  expect(p).toContain(JSON.stringify(thinSummary));
  expect(p).toContain("THIN DATA");
});
test("system prompt carries the banned list", () => {
  for (const b of BANNED_PHRASES) expect(SYSTEM_PROMPT.toLowerCase()).toContain(b);
});
```

- [ ] **Step 2: Run** `pnpm test`. Expected: FAIL.

- [ ] **Step 3: Implement `prompt.ts`.** `SYSTEM_PROMPT` must contain these points, written in the voice itself rather than in AI-instruction style:
  - who you are: the friend with no filter who just read their entire YouTube history
  - r/RoastMe style: short and brutal, one specific detail per line, no warm-up, no apology, no closing compliment, lowercase internet voice, swearing fine
  - nothing is off-limits (health, breakups, sexuality, politics, searches)
  - every line must quote a real title, channel, count or time from the data. Its `evidence` field is that exact substring.
  - never invent numbers
  - captions are sharp but still informative
  - the full banned list from Global Constraints
  - the example line from PRD §7

  `buildRoastPrompt` adds a `THIN DATA:` paragraph when `summary.thinData` is set (the joke is the emptiness itself, PRD US-4), followed by the summary JSON.

- [ ] **Step 4: Implement `providers.ts`.** Use the installed `ai` major's structured-output API (check `node_modules/ai` docs for `generateObject` vs `generateText` + `Output.object`) with `RoastOutputSchema`. Gemini uses `google(process.env.GEMINI_MODEL ?? "gemini-2.5-flash")` with `providerOptions.google.safetySettings` set to `BLOCK_NONE` for `HARM_CATEGORY_HARASSMENT`, `HARM_CATEGORY_HATE_SPEECH`, `HARM_CATEGORY_SEXUALLY_EXPLICIT` and `HARM_CATEGORY_DANGEROUS_CONTENT`. Groq uses `groq(process.env.GROQ_MODEL ?? "openai/gpt-oss-120b")`. Before the spike, list each provider's available models (Gemini `GET /v1beta/models`, Groq `GET /openai/v1/models`) and set both env vars in `.env.local` to the newest free flash-class / largest free open model.

- [ ] **Step 5: Write 5 persona Summaries** in `spike/personas/`. Each must be a valid `Summary` with realistic real-world channel names and titles:
  - gym-bro: fitness channels, then rewatched cut-diet videos at 3am
  - 3am-philosopher: Huberman/Jordan Peterson/lofi, 41% after midnight
  - minecraft-adult: age-28 span, Dream/Technoblade era, rewatched the same ending 31×
  - self-help-addict: productivity/5am-routine videos watched at 4am, plus breakup searches
  - thin-data: 23 videos total, `thinData: true`

- [ ] **Step 6: Write `scripts/spike.ts`.** Usage is `pnpm spike [dir…]` (default `spike/personas`, plus `spike/summaries` if it exists). For every summary × provider it times the call, catches errors as `REFUSED/ERROR: <message>`, runs `validateRoast`, and appends to `spike/out/<ISO-timestamp>.md` a section with: persona, provider, ms, validation problems, the headline, numbered lines and personality. At the end it prints a table of success count, mean ms and problem count per provider.

- [ ] **Step 7: Run** `pnpm test`, then `pnpm spike`. Expected: tests PASS. The spike writes a report with 10 sections, and each provider either returns 5 roasts or shows its error.

- [ ] **Step 8: Human gate.** Show the owner the report path and the per-provider table. The owner picks the primary provider (the one that is brutal and least AI-sounding) and may ask for prompt edits. Iterate Step 3 → Step 7 until they approve. Record the decision (provider order, model IDs, a short verdict and 2 sample lines per provider) in `docs/superpowers/specs/2026-10-17-spike-decision.md`.

- [ ] **Step 9: Commit** with `git add -A && git commit -m "feat: roast prompt, providers, voice spike + decision"`

---

### Task 3: Takeout types, file extraction, JSON parser

**Files:**
- Create: `src/lib/takeout/types.ts`, `src/lib/takeout/extract.ts`, `src/lib/takeout/parse-json.ts`
- Test: `tests/takeout/extract.test.ts`, `tests/takeout/parse-json.test.ts`, `tests/fixtures/watch-history.json`, `tests/fixtures/search-history.json`

**Interfaces:**
- Produces:
```ts
export type WatchEntry = { title: string; videoId: string | null; channel: string | null; time: Date };
export type SearchEntry = { query: string; time: Date };
export type ExtractedFile = { format: "json" | "html"; text: string };
export type ExtractedFiles = { watch: ExtractedFile; search: ExtractedFile | null };
export class TakeoutError extends Error { code: "no-watch-history" | "unreadable-zip"; found: string[] }
export function extractTakeoutFiles(name: string, bytes: Uint8Array): ExtractedFiles; // throws TakeoutError
export function parseWatchJson(text: string): { entries: WatchEntry[]; skipped: number };
export function parseSearchJson(text: string): { entries: SearchEntry[]; skipped: number };
```

- [ ] **Step 1: Write fixtures** in the real Takeout JSON shape (`header`, `title`, `titleUrl`, `subtitles: [{name, url}]`, `time`, `products`, optional `details: [{name: "From Google Ads"}]`). `watch-history.json` has 6 entries:
  1. normal, at `2024-03-05T03:30:00.000Z`
  2. same video rewatched
  3. an ad (`details` From Google Ads)
  4. removed video (`"title": "Watched a video that has been removed"`, no `titleUrl`)
  5. YouTube Music entry with no `subtitles`
  6. title `Watched Tom & Jerry 😂` (JSON exports are not HTML-escaped)

  `search-history.json` has 2 entries with `titleUrl` `https://www.youtube.com/results?search_query=how+to+fix+my+life` and one with an ad detail.

- [ ] **Step 2: Write failing tests**:
```ts
test("json: drops ads and removed videos, strips 'Watched '", () => {
  const { entries, skipped } = parseWatchJson(fixture("watch-history.json"));
  expect(entries).toHaveLength(4);
  expect(skipped).toBe(2);
  expect(entries[0]).toEqual({ title: "Never Gonna Give You Up", videoId: "dQw4w9WgXcQ", channel: "Rick Astley", time: new Date("2024-03-05T03:30:00.000Z") });
});
test("json: missing subtitles → channel null", () => { expect(musicEntry.channel).toBeNull(); });
test("json: ampersand and emoji kept verbatim", () => { expect(titles).toContain("Tom & Jerry 😂"); });
test("search json: query from URL, ads dropped", () => {
  expect(parseSearchJson(fixture("search-history.json")).entries.map(e => e.query)).toEqual(["how to fix my life"]);
});
test("extract: zip with nested takeout paths", () => {
  const zip = zipSync({ "Takeout/YouTube and YouTube Music/history/watch-history.json": strToU8("[]"),
                        "Takeout/YouTube and YouTube Music/history/search-history.html": strToU8("<html/>"),
                        "Takeout/archive_browser.html": strToU8("x") });
  const f = extractTakeoutFiles("takeout-2026.zip", zip);
  expect(f.watch.format).toBe("json"); expect(f.search?.format).toBe("html");
});
test("extract: bare watch-history.html", () => { expect(extractTakeoutFiles("watch-history.html", strToU8("<html/>")).watch.format).toBe("html"); });
test("extract: zip without history → TakeoutError listing files", () => {
  const zip = zipSync({ "Takeout/Drive/notes.txt": strToU8("x") });
  expect(() => extractTakeoutFiles("t.zip", zip)).toThrowError(expect.objectContaining({ code: "no-watch-history", found: ["Takeout/Drive/notes.txt"] }));
});
test("extract: non-zip random file → found is the filename", () => {
  expect(() => extractTakeoutFiles("me.jpg", new Uint8Array([1,2]))).toThrowError(expect.objectContaining({ code: "no-watch-history", found: ["me.jpg"] }));
});
test("extract: corrupted .zip → unreadable-zip", () => {
  expect(() => extractTakeoutFiles("t.zip", new Uint8Array([1,2,3]))).toThrowError(expect.objectContaining({ code: "unreadable-zip" }));
});
```

- [ ] **Step 3: Run** `pnpm test tests/takeout`. Expected: FAIL.

- [ ] **Step 4: Implement.** `extract.ts` uses fflate `unzipSync(bytes, { filter })`. The filter decompresses only paths matching `/(^|\/)(watch|search)-history\.(json|html)$/i` and records every path it sees for `found` (cap 20). Decode text with `TextDecoder`. If both formats are present, JSON wins. `parse-json.ts`: an entry with no `titleUrl` counts as removed and is skipped. An entry with a `details` name of `From Google Ads` is skipped. Strip a leading `Watched ` / `Searched for `. `videoId` comes from the `v` param of `titleUrl`. `channel` is `subtitles?.[0]?.name ?? null`, with an empty string becoming null. Unparseable `time` values are skipped.

- [ ] **Step 5: Run** `pnpm test tests/takeout`. Expected: PASS.

- [ ] **Step 6: Commit** with `git commit -am "feat: takeout extraction and JSON parsing"` (use `git add` for the new files first)

---

### Task 4: HTML parser

**Files:**
- Create: `src/lib/takeout/parse-html.ts`, `src/lib/takeout/index.ts`
- Test: `tests/takeout/parse-html.test.ts`, `tests/fixtures/watch-history.html`, `tests/fixtures/search-history.html`

**Interfaces:**
- Consumes: Task 3 types, `parseWatchJson`, `parseSearchJson`
- Produces:
```ts
export function parseTakeoutDate(s: string): Date | null;   // wall-clock in the runtime's local tz
export function parseWatchHtml(html: string): { entries: WatchEntry[]; skipped: number };
export function parseSearchHtml(html: string): { entries: SearchEntry[]; skipped: number };
export function parseTakeout(files: ExtractedFiles): { watches: WatchEntry[]; searches: SearchEntry[]; skipped: number };
```

- [ ] **Step 1: Write fixtures** mirroring Takeout's markup. Each entry is a `div.outer-cell` → `div.content-cell` containing `Watched <a href="https://www.youtube.com/watch?v=ID">Title</a><br><a href="https://www.youtube.com/channel/UC…">Channel</a><br>DATE`, and a later `content-cell` that contains `From Google Ads` for ads. Include:
  - a US date with a narrow no-break space: `Mar 5, 2024, 3:30:00 AM IST`
  - an en-GB date: `5 Sept 2024, 23:10:04 BST`
  - title `Tom &amp; Jerry 😂`
  - one ad
  - `Watched a video that has been removed`
  - one entry with no channel link
  - one entry with a garbage date

- [ ] **Step 2: Write failing tests**:
```ts
test.each([
  ["Mar 5, 2024, 3:30:00 AM IST", "2024-03-05T03:30:00.000Z"],
  ["Mar 5, 2024, 12:05:00 PM PST",     "2024-03-05T12:05:00.000Z"],
  ["Dec 31, 2023, 12:00:01 AM GMT",    "2023-12-31T00:00:01.000Z"],
  ["5 Sept 2024, 23:10:04 BST",        "2024-09-05T23:10:04.000Z"],
])("date %s", (s, iso) => expect(parseTakeoutDate(s)?.toISOString()).toBe(iso)); // TZ=UTC
test("date garbage → null", () => expect(parseTakeoutDate("yesterday-ish")).toBeNull());
test("html: decodes entities, drops ads/removed/bad-date, null channel", () => {
  const { entries, skipped } = parseWatchHtml(fixture("watch-history.html"));
  expect(entries.map(e => e.title)).toContain("Tom & Jerry 😂");
  expect(skipped).toBe(3);
  expect(entries.find(e => e.title === "No Channel Vid")?.channel).toBeNull();
});
test("search html: query text", () => expect(parseSearchHtml(fixture("search-history.html")).entries[0].query).toBe("how to fix my life"));
test("parseTakeout dispatches on format and sums skipped", () => { /* json watch + html search → both populated */ });
```

- [ ] **Step 3: Run** `pnpm test tests/takeout/parse-html`. Expected: FAIL.

- [ ] **Step 4: Implement.** Use htmlparser2 `parseDocument` with `domutils` (`findAll`, `textContent`) and `entities` `decodeHTML`. In each outer-cell the first content-cell holds the entry: first `<a>` = title/video, second `<a>` = channel, last text node = date. Normalise ` ` and ` ` to plain spaces before matching the date. Month names use their first 3 letters. The timezone abbreviation is ignored, because the wall clock is what the user lived. Build the result with `new Date(y, m, d, h, min, s)`.

- [ ] **Step 5: Run** `pnpm test`. Expected: all PASS.

- [ ] **Step 6: Commit** with `git add -A && git commit -m "feat: takeout HTML parsing"`

---

### Task 5: Stats engine → Summary

**Files:**
- Create: `src/lib/stats/time.ts`, `src/lib/stats/build-summary.ts`
- Test: `tests/stats/build-summary.test.ts`

**Interfaces:**
- Consumes: `WatchEntry`, `SearchEntry` (Task 3), `Summary` (Task 1)
- Produces:
```ts
export function localDateKey(d: Date): string;   // "2024-03-05", local tz
export function quarterKey(d: Date): string;     // "2024-Q1"
export function buildTakeoutSummary(watches: WatchEntry[], searches: SearchEntry[]): Summary;
```

- [ ] **Step 1: Write failing tests.** `w(title, channel, iso, videoId?)` is a local helper. Write one test per rule:
```ts
test("top channels: count desc, name asc tie-break, null channel excluded", () => {
  const s = buildTakeoutSummary([w("a","B","2024-01-01T10:00Z"), w("b","A","2024-01-01T11:00Z"), w("c","B","2024-01-02T10:00Z"), w("d",null,"2024-01-02T11:00Z")], []);
  expect(s.topChannels).toEqual([{ name: "B", count: 2 }, { name: "A", count: 1 }]);
  expect(s.totals).toMatchObject({ videos: 4, channels: 2, spanDays: 1 });
});
test("rewatched groups by videoId (else title), count ≥ 2 only", ...);       // 3× id X with differing titles → one entry count 3, title of latest watch
test("hours/weekdays/afterMidnightPct", ...);                                // 03:30Z Tue → hours[3]=1, weekdays[2]=1; 1 of 4 in 0–4h → 25
test("lateNights counts distinct dates with 02:00–04:59", ...);               // 2×03:00 same day + 1×02:10 other day + 1×05:00 → 2
test("longestBinge: max per-day count, earliest date on tie, ≤5 distinct titles in time order", ...);
test("eras: quarter keys ascending, last 12 only, top 3 channels, 3 sample titles", ...); // 14 quarters in → first key is the 3rd quarter
test("searches: null when none; topRepeated count ≥ 2; lateNight = 0–4h, ≤10, newest first", ...);
test("samples.latestNight: 5 watches in 0–4h with latest clock time first", ...);
test("samples.oneOffs: channels watched exactly once, ≤10, evenly spaced through history", ...);
test("thinData true under 50 videos", ...);
test("titles truncated to 120 chars with …", ...);
test("100k entries: < 2000 ms and JSON < 30000 chars", () => {
  const big = Array.from({ length: 100_000 }, (_, i) => w(`video ${i % 7000} ${"x".repeat(i % 200)}`, `ch${i % 1900}`, new Date(Date.UTC(2020,0,1) + i * 1_800_000).toISOString(), `id${i % 7000}`));
  const t = performance.now(); const s = buildTakeoutSummary(big, []);
  expect(performance.now() - t).toBeLessThan(2000);
  expect(JSON.stringify(s).length).toBeLessThan(30_000);
});
test("empty input → zeros, nulls, thinData true, no throw", ...);
```
Every `...` test above has its expected values given in the comment or the test name. Write them out as `expect` assertions.

- [ ] **Step 2: Run** `pnpm test tests/stats`. Expected: FAIL.

- [ ] **Step 3: Implement.** Do a single pass over `watches` into Maps (channel counts, video counts, per-date counts, per-quarter channel counts, sample buckets), then sort and slice. All hours and dates use local time (`getHours`, `getDay`, `localDateKey`). `afterMidnightPct = Math.round(100 * hours0to4 / videos)`, or 0 when there are no videos. Timestamps in the Summary are ISO strings. `oneOffs` picks every `⌈n/10⌉`-th entry from the once-watched channels in time order.

- [ ] **Step 4: Run** `pnpm test`. Expected: all PASS.

- [ ] **Step 5: Commit** with `git add -A && git commit -m "feat: stats engine builds Summary from takeout entries"`

---

### Task 6: Real-data summarize CLI + spike rerun

**Files:**
- Create: `scripts/summarize.ts`

**Interfaces:**
- Consumes: `extractTakeoutFiles`, `parseTakeout`, `buildTakeoutSummary`

- [ ] **Step 1: Write `scripts/summarize.ts`.** Usage is `pnpm summarize <path-to-takeout.zip|json|html> [label]`. It reads the file, runs extract → parse → summary, and writes `spike/summaries/real-<label or basename>.json`. It prints the counts (videos, channels, skipped), the elapsed ms and the summary size in KB. On `TakeoutError` it prints the code and `found`, then exits with code 1.

- [ ] **Step 2: Verify the error path.** Run `pnpm summarize package.json`. Expected: `no-watch-history` with `found: ["package.json"]`, exit code 1.

- [ ] **Step 3: Verify with real data (owner).** Ask the owner for their Takeout export (and any friends' exports they have permission to use). Run `pnpm summarize <file>` for each. Expected: the summary is < 30 KB, and the channels and titles look right to the owner.

- [ ] **Step 4: Rerun the spike** with `pnpm spike`, which picks up `spike/summaries`. The owner judges roasts written from their own real data. Update `2026-10-17-spike-decision.md` if the verdict changes.

- [ ] **Step 5: Commit** with `git add scripts/summarize.ts package.json && git commit -m "feat: summarize CLI for real takeout exports"`. Never commit `spike/summaries/real-*` or `spike/out/`.
