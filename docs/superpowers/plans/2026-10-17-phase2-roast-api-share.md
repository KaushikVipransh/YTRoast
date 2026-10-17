# Caught Watching — Phase 2: Roast API, Storage, Share Page, Upload Flow

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A person can drop their Takeout file on the site, get a roast written by the approved AI chain (or a template if every AI fails), see it privately, share it as a link with a preview image, and unshare or delete it. All of it is deployed on Vercel Hobby with Supabase.

**Architecture:** A Web Worker turns the file into a `Summary` in the browser. `POST /api/roast` validates the Summary with Zod, runs the generation chain (Gemini 3.8 Flash → Gemini 3.1 Flash-Lite → Groq gpt-oss-120b → template), stores it in Postgres through Drizzle, and sets an httpOnly owner cookie. `/r/[id]` is server-rendered, so chat apps can read its preview tags. Route logic lives in plain functions that take `(Request, deps)` so tests can call them with an in-memory PGlite database and a fake generator.

**Tech Stack:** Next.js 16 App Router · Drizzle ORM 0.45 · postgres (postgres-js) · @electric-sql/pglite (tests and local dev) · Zod 4 · Vercel AI SDK 7 · Comlink · next/og · nanoid · Playwright

**Spec:** `docs/superpowers/specs/2026-10-17-prd.md`, `docs/superpowers/specs/2026-10-17-tech-stack.md`, `docs/superpowers/specs/2026-10-17-design.md` (copy only; visual design is Phase 4), `docs/superpowers/specs/2026-10-17-spike-decision.md` (approved provider order)

**Out of scope (later phases):** rate limits, the oven-full state, the DB keep-alive cron, privacy/terms pages and analytics (Phase 5) · the quick path and `/api/enrich` (Phase 3) · the zine visual design, report spreads, motion, story image and illustrated Takeout guide (Phase 4).

## Global Constraints

- $0/month. Free tiers only.
- The raw history never leaves the browser. The server accepts only a `Summary`, with a request body of at most 64,000 bytes.
- Every roast is **private by default**. To anyone who isn't the owner, a private roast and an id that doesn't exist look identical (same 404, same generic preview image).
- On delete, the `summary` and `roast` columns are wiped immediately. The row stays as a tombstone so the link can say "this file was burned."
- The owner token is 32 random bytes, base64url-encoded. The DB stores only its SHA-256 hex. The browser holds it in an httpOnly cookie `cw_o_<id>` (`Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`, plus `Secure` in production). Compare hashes with `crypto.timingSafeEqual`.
- Roast ids are 12-character `nanoid` strings.
- Generation chain (approved 2026-10-17):
  - `gemini` = `GEMINI_MODEL` (default `gemini-3.8-flash`), 20 s timeout
  - `gemini-lite` = `GEMINI_LITE_MODEL` (default `gemini-3.1-flash-lite`), 15 s
  - `groq` = `GROQ_MODEL` (default `openai/gpt-oss-120b`), 15 s
  - `template`

  The overall deadline is 45 s. `ROAST_GENERATOR=template` skips the AI entirely (used by e2e and local dev).
- A template roast is always labelled: `generator = "template"`, and the page shows a `TEMPLATE ROAST` stamp.
- Privacy wording never says "nothing leaves your device". Exact copy: `your full history stays on your device. a summary with stats and some video titles is sent to write your roast.`
- Public roast pages have no login wall and always show a `ROAST ME NEXT →` link to `/roast`.
- All `/r/*` pages are `noindex`.
- Light theme only. Phase 2 UI is plain semantic HTML using the existing Tailwind setup; Phase 4 restyles it, so don't build visual flourishes.
- Next.js 16: `params` is a Promise, and `cookies()` is async. Read the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js file (AGENTS.md).
- Vitest runs with `TZ=UTC`. DB tests use a fresh PGlite instance per test file, never a network database.
- Never print secrets. `.env.local` stays untracked.

## Review Focus

1. **Private-roast leakage.** A stranger requests `/r/<private-id>`, its preview image, or `PATCH/DELETE /api/roast/<id>`. They must get exactly the same result as for a random id: 404 and a generic image. Tests are in Tasks 6, 7 and 8.
2. **Forged or oversized Summary posted directly to the API.** It must get 400/413 and must never reach the AI or the DB. Tests are in Tasks 2 and 7.
3. **An AI provider hangs or returns junk.** The user still gets a roast within the 45 s deadline (the template at worst). Tests are in Task 4.
4. **Deleted roast.** Content is gone from the DB row, not just hidden; the page says burned; the preview image is generic. Tests are in Tasks 6 and 8.
5. **Owner loses the cookie** (new phone, cleared cookies). The "secret link" restores ownership, and a wrong key grants nothing. Tests are in Tasks 7 and 10.

---

## File Structure

```
src/lib/summary-schema.ts            Zod SummarySchema + parseSummary (server trust boundary)
src/lib/roast/templates.ts           generateTemplateRoast: ~60 hand-written templates
src/lib/roast/generate.ts            generateRoast chain, repairRoast, deadlines
src/lib/db/schema.ts                 roasts table
src/lib/db/client.ts                 getDb(): postgres-js or PGlite by DATABASE_URL
src/lib/roasts/ownership.ts          token, hash, cookie name/serialise/read
src/lib/roasts/service.ts            createRoast, getRoastView, setVisibility, deleteRoast, setFeedback
src/lib/roasts/http.ts               handleCreate/handleUpdate/handleDelete/handleFeedback/handleClaim (Request → Response)
src/app/api/roast/route.ts           POST
src/app/api/roast/[id]/route.ts      PATCH, DELETE
src/app/api/roast/[id]/feedback/route.ts  POST
src/app/r/[id]/claim/route.ts        GET ?key=
src/app/r/[id]/page.tsx              roast + report page
src/app/r/[id]/not-found.tsx         "nothing here" page
src/app/r/[id]/opengraph-image.tsx   1200×630 preview
src/components/roast/*.tsx           RoastView, ReportView, OwnerControls, BurnedView
src/lib/takeout/process.ts           processTakeout (the worker body, pure)
src/lib/takeout/messages.ts          errorMessage(code, found)
src/workers/takeout.worker.ts        Comlink expose
src/lib/takeout/client.ts            processInWorker(file)
src/app/roast/page.tsx + src/components/upload/Uploader.tsx
src/app/page.tsx                     minimal landing
drizzle.config.ts, drizzle/*.sql     migrations
e2e/takeout-flow.spec.ts, playwright.config.ts
```

---

### Task 1: Parser and validator hardening (Phase 1 deferred minors)

**Files:**
- Modify: `src/lib/takeout/parse-json.ts`, `src/lib/takeout/parse-html.ts`, `src/lib/takeout/extract.ts`, `src/lib/takeout/types.ts`, `src/lib/roast/validate.ts`, `src/lib/stats/build-summary.ts`
- Test: the existing test files under `tests/`

**Interfaces:**
- Produces: `TakeoutErrorCode` gains `"unsupported-archive"`. Everything else keeps its signature.

- [ ] **Step 1: Write failing tests:**
  - JSON and HTML: channel `"   "` → `null`.
  - JSON and HTML: a title that is just a URL (`Watched https://www.youtube.com/watch?v=abc`) is skipped and counted in `skipped`.
  - extract: a zip holding both `watch-history.json` and `watch-history (1).json` picks the unsuffixed one, in either zip order. When only suffixed copies exist, the larger file wins.
  - extract: `takeout.tgz` and `takeout.tar.gz` throw `unsupported-archive` with `found: [name]`.
  - `findBannedPhrases("yeah, nice")` → `[]`, and `findBannedPhrases("ah, so")` → `["ah,"]`.
  - `validateRoast` does not flag `journey` when it is inside the line's evidence (`evidence: "Journey - Don't Stop Believin'"`), but does flag it outside.
  - `topRewatched`: two videos with equal count and equal title give the same output for both input orders, tie-broken by `videoId` ascending.

- [ ] **Step 2: Run** `pnpm test`. Expected: the new tests FAIL.

- [ ] **Step 3: Implement.**
  - Trim channels before `|| null`. Treat `/^https?:\/\//` titles as removed.
  - In extract, rank candidate files: unsuffixed first, then by byte length descending. Check for `.tgz`/`.tar.gz` before the zip branch.
  - Word-bounded banned phrases: build a regex per phrase that has letters, `(?<![a-z])<escaped>(?![a-z])`. `—` still matches anywhere.
  - `validateRoast` checks each line's text with its evidence substring removed (case-insensitive, first occurrence).
  - Fix the comparator to compare count, then title, then `videoId ?? ""`.

- [ ] **Step 4: Run** `pnpm test`. Expected: all PASS.

- [ ] **Step 5: Commit** `fix: phase-1 deferred parser and validator edge cases`

---

### Task 2: SummarySchema (the server's trust boundary)

**Files:**
- Create: `src/lib/summary-schema.ts`
- Test: `tests/summary-schema.test.ts`

**Interfaces:**
- Consumes: `Summary` (`src/lib/summary.ts`)
- Produces:
```ts
export const SummarySchema: z.ZodType<Summary>;     // .strict() objects throughout
export function parseSummary(input: unknown): Summary | null;
```

- [ ] **Step 1: Write failing tests:**
  - Each of the 5 `spike/personas/*.json` passes.
  - `buildTakeoutSummary` output for `tests/fixtures/watch-history.json` passes.
  - Each of these returns `null`:
    - an unknown top-level key
    - `hours` of length 25
    - a negative count
    - 11 `topChannels`
    - a 201-char title
    - `version: 2`
    - `afterMidnightPct: 101`
    - a `time` that isn't in `YYYY-MM-DDTHH:mm:ss±HH:MM` format
    - a string containing a lone surrogate (`"a\ud83d"`)
  - A compile-time check: `const _: Summary = {} as z.infer<typeof SummarySchema>`.

- [ ] **Step 2: Run** `pnpm test tests/summary-schema.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** Limits:
  - Strings: ≤ 200 chars and `.refine(s => s.isWellFormed())`.
  - Counts: integers 0–10,000,000.
  - `hours`: exactly 24. `weekdays`: exactly 7.
  - `topChannels`, `topRewatched`, `searches.topRepeated`, `searches.lateNight` and `samples.oneOffs`: ≤ 10 each. `eras` ≤ 12, `latestNight` ≤ 5, binge titles ≤ 5, per-era lists ≤ 3.
  - Time regex: `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/`.
  - `longestBinge.date`: `/^\d{4}-\d{2}-\d{2}$/`. Era `period`: `/^\d{4}-Q[1-4]$/`.

- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.

- [ ] **Step 5: Commit** `feat: SummarySchema for untrusted summaries`

---

### Task 3: Template roast engine (PRD F13)

**Files:**
- Create: `src/lib/roast/templates.ts`
- Test: `tests/roast/templates.test.ts`

**Interfaces:**
- Consumes: `Summary`, `RoastOutput`, `RoastOutputSchema`, `validateRoast`
- Produces: `export function generateTemplateRoast(summary: Summary): RoastOutput;`

- [ ] **Step 1: Write failing tests.** Test inputs: each persona, plus a 1-video summary (built via `buildTakeoutSummary([oneWatch], [])`), plus a summary with `searches: null` and empty `samples`. For each input:
  - `RoastOutputSchema.parse(out)` succeeds.
  - `validateRoast(out, s).ok === true`.
  - `out.lines.length` is between 6 and 10.
  - Two calls give deep-equal output (deterministic).

  Also:
  - The gym-bro and 3am-philosopher outputs have different headlines.
  - `TEMPLATE_COUNT >= 60` (exported constant).

- [ ] **Step 2: Run** `pnpm test tests/roast/templates.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** A template is `(s: Summary) => { text: string; evidence: string } | null`. It returns null when its data is missing. Group templates by slot, with these minimums:

  | Slot | Minimum | Notes |
  |---|---|---|
  | headline | 8 | |
  | topChannel | 6 | |
  | rewatch | 6 | |
  | lateNight | 6 | uses `samples.latestNight` and `lateNights` |
  | binge | 5 | |
  | search | 6 | |
  | oneOff | 5 | |
  | era | 4 | |
  | thin | 6 | for `thinData` |
  | personality | 8 | label + description pairs |
  | captions | one set | |

  Pick one variant per slot with a seed, the FNV-1a hash of `JSON.stringify(summary)`. Fill lines in slot order (topChannel, rewatch, lateNight, binge, search, oneOff, era), using up to 2 from the richest slots, until there are 8 lines. Top up with thin lines until there are at least 6.

  Write the copy in the PRD §7 voice (lowercase, one evidence per line, ≤ 25 words, no banned phrases, no em dashes). Evidence is always a verbatim channel, title, query, or the number rendered as `String(n)`. Times are written as `4:12am`, derived from the Summary's local time string. Example: `you watched {channel} {count} times. {count}. you need a hobby that isn't {channel}.`

  Captions are null when there's no data for them. `eras` are named from each era's top channel (`the {channel} era`).

- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.

- [ ] **Step 5: Commit** `feat: template roast fallback`

---

### Task 4: Generation chain with repair, timeouts, fallback

**Files:**
- Create: `src/lib/roast/generate.ts`
- Modify: `src/lib/roast/providers.ts` (add the `signal` parameter)
- Test: `tests/roast/generate.test.ts`

**Interfaces:**
- Consumes: `generateRoastWith`, `validateRoast`, `generateTemplateRoast`
- Produces:
```ts
export type Generator = "gemini" | "gemini-lite" | "groq" | "template";
export type ChainStep = { generator: Exclude<Generator, "template">; provider: ProviderName; model: string; timeoutMs: number };
export function defaultChain(): ChainStep[];  // reads env per Global Constraints
export type CallFn = (step: ChainStep, summary: Summary, signal: AbortSignal) => Promise<RoastOutput>;
export function repairRoast(out: RoastOutput, summary: Summary): RoastOutput | null;
export function generateRoast(summary: Summary, opts?: { chain?: ChainStep[]; call?: CallFn; deadlineMs?: number }): Promise<{ roast: RoastOutput; generator: Generator }>;
// providers.ts:
export function generateRoastWith(provider: ProviderName, summary: Summary, modelId?: string, signal?: AbortSignal): Promise<RoastOutput>;
```

- [ ] **Step 1: Write failing tests**, using an injected `call` and a chain with `timeoutMs: 50`:
  - The first step returns a valid roast → `generator: "gemini"`, and `call` ran once.
  - The first step throws → `"gemini-lite"`.
  - The first step never resolves → `"gemini-lite"` within 200 ms. The first call's `signal.aborted` is true.
  - All steps throw → `"template"`, and the output passes `validateRoast`.
  - `deadlineMs: 80` with three 50 ms steps that hang → `"template"` in under 200 ms.
  - `ROAST_GENERATOR=template` (set `process.env` in the test) → `"template"`, and `call` is never invoked.
  - repair: a line containing `" — "` comes back with `", "` instead and passes.
  - repair: 8 lines where 1 has missing evidence → 7 lines.
  - repair: 6 lines where 1 is bad → `null`, because it can't drop below 6.
  - repair: a banned phrase in the headline → `null`.
  - repair: a banned phrase in a caption → that caption becomes `null`.
  - The chain uses the repaired roast when repair succeeds.
  - The chain moves to the next step when repair returns `null`.
  - `defaultChain()` returns gemini/gemini-lite/groq with timeouts 20000/15000/15000 and the default model ids.

- [ ] **Step 2: Run** `pnpm test tests/roast/generate.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - Each step gets an `AbortController`, aborted at `min(step.timeoutMs, deadline - elapsed)`. Skip a step when less than 1,000 ms remains.
  - Pass the signal as `abortSignal` to `generateText` and set `maxRetries: 0`, so the chain owns retries.
  - Log `console.warn("[roast] <generator> failed: <message>")`. Never log the summary.
  - Repair order: replace `—` in lines and captions → null out bad captions → drop bad lines (only while more than 6 remain) → re-validate → return the result, or `null` if it still has problems.

- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.

- [ ] **Step 5: Commit** `feat: generation chain with repair, deadlines and template fallback`

---

### Task 5: Database schema, client, migrations

**Files:**
- Create: `src/lib/db/schema.ts`, `src/lib/db/client.ts`, `drizzle.config.ts`, `drizzle/` (generated), `tests/db/helpers.ts`
- Modify: `package.json` (scripts `db:generate`, `db:migrate`), `next.config.ts` (`serverExternalPackages: ["@electric-sql/pglite"]`)
- Test: `tests/db/schema.test.ts`

**Interfaces:**
- Produces:
```ts
// schema.ts
export const roasts = pgTable("roasts", { id, ownerHash, source, visibility, summary, roast, generator, feedback, createdAt, deletedAt });
export type RoastRow = typeof roasts.$inferSelect;
// client.ts
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export function getDb(): Promise<Db>;     // singleton on globalThis
// tests/db/helpers.ts
export function testDb(): Promise<Db>;    // fresh in-memory PGlite, migrations applied
```

- [ ] **Step 1: Install.** Run `pnpm add drizzle-orm postgres @electric-sql/pglite nanoid` and `pnpm add -D drizzle-kit`.

- [ ] **Step 2: Write failing tests** against `testDb()`:
  - Insert and select round-trips `summary`/`roast` JSONB unchanged.
  - The `visibility` default is `"private"`.
  - Inserting `visibility: "secret"` throws (check constraint).
  - `generator: "openai"` throws.
  - `feedback: 2` throws.
  - A row with `deletedAt` set but `summary` not null throws (invariant check).
  - `createdAt` is filled automatically.

- [ ] **Step 3: Run** `pnpm test tests/db`. Expected: FAIL.

- [ ] **Step 4: Implement the schema.** Columns:

  | Column | Type | Constraint |
  |---|---|---|
  | `id` | text | pk |
  | `owner_hash` | text | not null |
  | `source` | text | not null, check in (`takeout`, `quick`) |
  | `visibility` | text | not null, default `private`, check in (`private`, `public`) |
  | `summary` | jsonb | nullable |
  | `roast` | jsonb | nullable |
  | `generator` | text | not null, check in (`gemini`, `gemini-lite`, `groq`, `template`) |
  | `feedback` | smallint | nullable, check in (-1, 1) |
  | `created_at` | timestamptz | not null, default now() |
  | `deleted_at` | timestamptz | nullable |

  Add a table check: `(deleted_at IS NULL) = (summary IS NOT NULL AND roast IS NOT NULL)`.

  Then generate the migration with `pnpm db:generate`.

- [ ] **Step 5: Implement the client.**
  - `DATABASE_URL` starting with `pglite:` → PGlite in-memory (`pglite://memory`), with migrations applied via `drizzle-orm/pglite/migrator` on first use.
  - Otherwise use postgres-js with `{ prepare: false, max: 1 }` (Supabase transaction pooler).
  - Missing `DATABASE_URL` → throw `"DATABASE_URL is not set"`.
  - Add `.env.local` → `DATABASE_URL=pglite://memory` for local dev.

- [ ] **Step 6: Run** `pnpm test && pnpm build`. Expected: PASS, and the build succeeds.

- [ ] **Step 7: Commit** `feat: roasts table, drizzle client, migrations`

---

### Task 6: Ownership and roast service

**Files:**
- Create: `src/lib/roasts/ownership.ts`, `src/lib/roasts/service.ts`
- Test: `tests/roasts/service.test.ts`, `tests/roasts/ownership.test.ts`

**Interfaces:**
- Consumes: `Db`, `roasts`, `Summary`, `RoastOutput`, `Generator`
- Produces:
```ts
// ownership.ts
export function newOwnerToken(): string;                       // 43-char base64url
export function hashToken(token: string): string;              // sha256 hex
export function tokenMatches(token: string, hash: string): boolean;
export const ownerCookieName: (id: string) => string;          // "cw_o_<id>"
export function ownerCookie(id: string, token: string): string;  // full Set-Cookie value
export function readOwnerToken(cookieHeader: string | null, id: string): string | null;
// service.ts
export type RoastView =
  | { kind: "missing" }
  | { kind: "deleted" }
  | { kind: "roast"; id: string; isOwner: boolean; visibility: "private" | "public"; summary: Summary; roast: RoastOutput; generator: Generator; feedback: -1 | 1 | null; createdAt: string };
export type OwnerResult = "ok" | "forbidden" | "missing";
export function createRoast(db: Db, input: { summary: Summary; roast: RoastOutput; generator: Generator }): Promise<{ id: string; ownerToken: string }>;
export function getRoastView(db: Db, id: string, ownerToken: string | null): Promise<RoastView>;
export function setVisibility(db: Db, id: string, ownerToken: string | null, visibility: "private" | "public"): Promise<OwnerResult>;
export function deleteRoast(db: Db, id: string, ownerToken: string | null): Promise<OwnerResult>;
export function setFeedback(db: Db, id: string, ownerToken: string | null, value: -1 | 1): Promise<OwnerResult>;
```

- [ ] **Step 1: Write failing tests:**
  - ownership:
    - The token is 43 url-safe chars, and two tokens differ.
    - `tokenMatches(t, hashToken(t))` is true. A wrong token is false. A hash of a different length is false, not a throw.
    - `ownerCookie` contains `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=31536000`, and contains `Secure` only when `NODE_ENV=production`.
    - `readOwnerToken("a=1; cw_o_abc=TOKEN", "abc")` is `"TOKEN"`.
  - service:
    - create → the id is 12 chars, and the stored `owner_hash` is not equal to the token.
    - The owner sees `{kind:"roast", isOwner:true, visibility:"private"}`.
    - A stranger (`null` token, or a wrong token) sees `{kind:"missing"}`.
    - An unknown id is `{kind:"missing"}`.
    - After `setVisibility(…,"public")` a stranger sees `isOwner:false`.
    - A wrong token on setVisibility/delete/feedback → `"forbidden"`, and nothing changes.
    - delete → the view is `{kind:"deleted"}` for everyone, and a raw select shows `summary` and `roast` are `null` and `deleted_at` is set.
    - Deleting a second time → `"missing"`. Changing visibility or feedback on a deleted roast → `"missing"`.
    - Feedback `-1` is stored and shown in the owner view.

- [ ] **Step 2: Run** `pnpm test tests/roasts`. Expected: FAIL.

- [ ] **Step 3: Implement.** Use `crypto.randomBytes(32).toString("base64url")`, `createHash("sha256")` and `timingSafeEqual` on equal-length buffers. Delete runs a single `UPDATE … SET summary = NULL, roast = NULL, deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, after the ownership check.

- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.

- [ ] **Step 5: Commit** `feat: roast ownership and service`

---

### Task 7: API route handlers

**Files:**
- Create: `src/lib/roasts/http.ts`, `src/app/api/roast/route.ts`, `src/app/api/roast/[id]/route.ts`, `src/app/api/roast/[id]/feedback/route.ts`, `src/app/r/[id]/claim/route.ts`
- Test: `tests/roasts/http.test.ts`

**Interfaces:**
- Consumes: Task 2 `parseSummary`, Task 4 `generateRoast`, Task 6 service and ownership, Task 5 `getDb`
- Produces:
```ts
export type Deps = { db: Db; generate: (s: Summary) => Promise<{ roast: RoastOutput; generator: Generator }> };
export function handleCreate(req: Request, deps: Deps): Promise<Response>;            // 201 {id} + Set-Cookie
export function handleUpdate(req: Request, id: string, deps: Pick<Deps, "db">): Promise<Response>;   // PATCH {visibility}
export function handleDelete(req: Request, id: string, deps: Pick<Deps, "db">): Promise<Response>;
export function handleFeedback(req: Request, id: string, deps: Pick<Deps, "db">): Promise<Response>; // POST {value}
export function handleClaim(req: Request, id: string, deps: Pick<Deps, "db">): Promise<Response>;    // GET ?key= → 307 /r/<id>
```
Route files are one-liners: `export const POST = async (req: Request) => handleCreate(req, { db: await getDb(), generate: generateRoast })`, plus `export const maxDuration = 60` on the create route.

- [ ] **Step 1: Write failing tests** with `testDb()` and a fake `generate` that records its calls:

  **Create**
  - A persona body → 201 `{id}`, and the `Set-Cookie` header is `cw_o_<id>=…; HttpOnly`.
  - The response body does **not** contain the owner token.
  - Malformed JSON → 400 `{error:"bad-json"}`.
  - A schema-invalid summary → 400 `{error:"bad-summary"}`, with `generate` never called and no row written.
  - A 70,000-byte body → 413, with `generate` not called.
  - A `GET` or other method isn't routed here (skip; the route file only exports POST).

  **Update / delete**
  - PATCH with no cookie → 404.
  - PATCH with a wrong cookie → 404.
  - PATCH with the owner cookie and `{visibility:"public"}` → 200, and a stranger's view becomes `roast`.
  - PATCH `{visibility:"secret"}` → 400.
  - DELETE with the owner cookie → 200, and the view is deleted.
  - DELETE with no cookie → 404.

  **Feedback**
  - `{value: 1}` with the owner cookie → 200.
  - `{value: 5}` → 400.

  **Claim**
  - The correct `?key=` → 307 to `/r/<id>` with an owner `Set-Cookie`.
  - A wrong key → 307 with no `Set-Cookie`.
  - An unknown id → 307 with no `Set-Cookie`.

- [ ] **Step 2: Run** `pnpm test tests/roasts/http.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** Read the body with `await req.text()` and reject when `new TextEncoder().encode(body).length > 64_000`. Map service results as `ok` → 200 `{ok:true}`, and `forbidden` or `missing` → 404 `{error:"not-found"}`. Read the cookie with `readOwnerToken(req.headers.get("cookie"), id)`. Before writing the route files, check `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`; params are `Promise<{ id: string }>`.

- [ ] **Step 4: Run** `pnpm test && pnpm build`. Expected: PASS, and the build succeeds.

- [ ] **Step 5: Commit** `feat: roast API routes`

---

### Task 8: Roast page, preview image, owner controls

**Files:**
- Create: `src/app/r/[id]/page.tsx`, `src/app/r/[id]/not-found.tsx`, `src/app/r/[id]/opengraph-image.tsx`, `src/components/roast/RoastView.tsx`, `src/components/roast/ReportView.tsx`, `src/components/roast/OwnerControls.tsx`, `src/components/roast/BurnedView.tsx`, `src/lib/roasts/og.ts`, `src/assets/fonts/BowlbyOne-Regular.ttf`, `src/lib/site.ts`
- Test: `tests/roasts/og.test.ts`

**Interfaces:**
- Consumes: `getRoastView`, `getDb`, `ownerCookieName`
- Produces:
```ts
export function ogHeadline(view: RoastView): string | null; // headline only for kind "roast" && visibility "public"
export function siteUrl(): string;  // NEXT_PUBLIC_SITE_URL ?? https://$VERCEL_PROJECT_PRODUCTION_URL ?? http://localhost:3000
```

- [ ] **Step 1: Write failing tests** for `ogHeadline`: missing → null, deleted → null, a private roast viewed by its owner → null, public → the headline. Write `siteUrl` tests for each env combination.

- [ ] **Step 2: Run** `pnpm test tests/roasts/og.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `og.ts` and `site.ts`.** Run `pnpm test`. Expected: PASS.

- [ ] **Step 4: Build the page.** Read the Next docs for `page.md`, `not-found.md`, `generate-metadata.md` and `01-metadata/opengraph-image.md` first.
  - **Page:** `await cookies()` → `getRoastView(db, id, token)`.
    - `missing` → `notFound()`.
    - `deleted` → `<BurnedView>`, with the copy `this file was burned.` and a `ROAST ME` link to `/roast`.
    - `roast` → `<RoastView>` (headline as `<h1>`, numbered lines with the evidence substring wrapped in `<mark>`, personality label + description, a `TEMPLATE ROAST` stamp when `generator === "template"`), then `<ReportView>` (plain sections, each rendered only when its data exists: numbers, top channels, most rewatched, clock as 24 plain bars, eras with AI names, longest binge, searches, captions).
    - Owner → a banner `🔒 only you can see this. share when ready.` while private, plus `<OwnerControls>`.
    - Non-owner → a banner `👀 YOU'RE READING SOMEONE'S FILE` and a sticky `ROAST ME NEXT →` link.
  - **`generateMetadata`:** set `metadataBase: new URL(siteUrl())` and `robots: { index: false }` always. The title is `<headline> · Caught Watching` only when public; otherwise `Caught Watching`.
  - **`not-found.tsx`:** `nothing here. or someone's hiding something.` plus a `ROAST ME` link.
  - **`opengraph-image.tsx`** (1200×630, `image/png`): a paper `#F6F4EE` background, a sky `#5AA9D6` band on the left third, the headline in Bowlby One in navy `#1F2A44` (max 2 lines, shrinking from 72 px to 44 px based on length), and a `CAUGHT WATCHING` stamp. When `ogHeadline` is null, render the generic `YOUR YOUTUBE HISTORY IS EVIDENCE.` instead. Download Bowlby One from the Google Fonts GitHub repo (`ofl/bowlbyone/BowlbyOne-Regular.ttf`, OFL licence) and read it with `readFile`.
  - **`OwnerControls`** (`"use client"`):
    - Share / make-private toggle (PATCH, then `router.refresh()`).
    - Copy link (`navigator.clipboard`).
    - Native share (`navigator.share` when available).
    - A secret link `siteUrl()/r/<id>/claim?key=<token>` (the page passes the token from the cookie), with the copy `save this. it's the only way back in if you clear cookies.`
    - 👍/👎 "did this hit?" (POST feedback).
    - Delete → confirm dialog `burn the evidence?` with `[BURN IT]` / `[keep]` → DELETE, then `router.refresh()`.

- [ ] **Step 5: Run** `pnpm test && pnpm build`. Expected: PASS, and the build succeeds.

- [ ] **Step 6: Verify the page by hand.** Run `pnpm dev`. Seed a persona roast with a scratch script that calls `createRoast` against `pglite://memory`, or wait for Task 9's upload flow, which this check can fold into. Check four views: the owner's private view, the public view in a private window, the deleted view, and the not-found view. Fetch `/r/<id>/opengraph-image` for a public roast and a private one, and look at both PNGs.

- [ ] **Step 7: Commit** `feat: roast page, preview image, owner controls`

---

### Task 9: Upload flow (worker, uploader, landing)

**Files:**
- Create: `src/lib/takeout/process.ts`, `src/lib/takeout/messages.ts`, `src/workers/takeout.worker.ts`, `src/lib/takeout/client.ts`, `src/app/roast/page.tsx`, `src/components/upload/Uploader.tsx`
- Modify: `src/app/page.tsx` (replace the scaffold), `src/app/layout.tsx` (title `Caught Watching`, description)
- Test: `tests/takeout/process.test.ts`, `tests/takeout/messages.test.ts`

**Interfaces:**
- Consumes: `extractTakeoutFiles`, `parseTakeout`, `buildTakeoutSummary`, `TakeoutError`
- Produces:
```ts
export type ProcessResult =
  | { ok: true; summary: Summary; counts: { videos: number; channels: number; searches: number } }
  | { ok: false; code: TakeoutErrorCode | "unknown"; found: string[] };
export function processTakeout(name: string, bytes: Uint8Array): ProcessResult;  // never throws
export function errorMessage(code: TakeoutErrorCode | "unknown", found: string[]): string;
export function processInWorker(file: File): Promise<ProcessResult>;
```

- [ ] **Step 1: Write failing tests:**
  - **`processTakeout`:** a zip built from both JSON fixtures → `ok:true` with `counts.videos === 4`. `me.jpg` → `{ok:false, code:"no-watch-history", found:["me.jpg"]}`. `"[]"` as `watch-history.json` → `no-entries`. A non-Takeout throw (simulated with a mocked `buildTakeoutSummary`) → `code:"unknown"`.
  - **`errorMessage`:**

    | Code | Message |
    |---|---|
    | `no-watch-history` with `["me.jpg"]` | contains `that's not your watch history, that's me.jpg. we need watch-history.json.` |
    | `no-entries` | `your history is empty. either you're a saint or you turned history off. both are suspicious.` |
    | `unreadable-zip` | contains `that zip is broken` |
    | `unreadable-history` | contains `that file is corrupted` |
    | `unsupported-archive` | contains `export it again as .zip` |
    | `unknown` | contains `something broke on our side` |

    Every message ends with a fix the user can act on.

- [ ] **Step 2: Run** `pnpm test tests/takeout`. Expected: FAIL.

- [ ] **Step 3: Implement `process.ts` and `messages.ts`.** Run `pnpm test`. Expected: PASS.

- [ ] **Step 4: Build the worker and UI.** Run `pnpm add comlink`.
  - **Worker:** `expose({ processTakeout })`.
  - **Client:** `new Worker(new URL("../../workers/takeout.worker.ts", import.meta.url), { type: "module" })`. Pass the bytes with `transfer(bytes, [bytes.buffer])`, and terminate the worker in `finally`.
  - **`Uploader`** (`"use client"`) has the states `idle | reading | roasting | error`:
    - A drop zone and a file input (`accept=".zip,.json,.html"`). Files are ignored unless the state is `idle` or `error`.
    - While roasting, show the real counts and rotate the status lines every 1.5 s: `reading N videos…` → `found the 3am stuff…` → `consulting your therapist…` → `writing the roast…`.
    - POST the summary. On 201 run `router.push("/r/" + id)`. On error, show `errorMessage` or `the roast oven jammed. try again.` for non-201 responses.
  - **`/roast` page:** the Uploader, the privacy line from Global Constraints, and the 6 Takeout steps from design §5.3 as a plain ordered list, with a link to `https://takeout.google.com`.
  - **Landing:** the headline `YOUR YOUTUBE HISTORY IS EVIDENCE.`, the line `we read what you watched. then we roast you for it.`, a `ROAST ME` link to `/roast`, and the privacy line.

- [ ] **Step 5: Run** `pnpm build`, then check by hand with `pnpm dev`. Drop `tests/fixtures/watch-history.json` → you land on `/r/<id>` with a template roast (`ROAST_GENERATOR=template` in `.env.local` for this check). Drop `package.json` → you see the wrong-file message. Throughout, the page stays responsive.

- [ ] **Step 6: Commit** `feat: takeout upload flow with web worker`

---

### Task 10: End-to-end test

**Files:**
- Create: `playwright.config.ts`, `e2e/takeout-flow.spec.ts`
- Modify: `package.json` (script `"e2e": "playwright test"`), `.gitignore` (`test-results/`, `playwright-report/`)

- [ ] **Step 1: Install.** Run `pnpm add -D @playwright/test` and `pnpm exec playwright install chromium`. In `playwright.config.ts`, set `webServer` to `pnpm dev --port 3100` with env `DATABASE_URL=pglite://memory` and `ROAST_GENERATOR=template`, and `baseURL` to `http://localhost:3100`. Use one project, Chromium with a mobile viewport (390×844).

- [ ] **Step 2: Write `e2e/takeout-flow.spec.ts`:**
  - **Happy path:** build a zip in the test with fflate from both fixtures under `Takeout/YouTube and YouTube Music/history/`.
    1. Go to `/roast` and `setInputFiles` with the buffer.
    2. Expect the URL to match `/r/[A-Za-z0-9_-]{12}$`, an `h1` to be visible, and the text `only you can see this` and `TEMPLATE ROAST`.
    3. Open a new context (no cookies) on the same URL → expect a 404 `nothing here`.
    4. As the owner, click `share` → open a new context again → expect the `h1` headline and `ROAST ME NEXT`.
    5. Read the secret link from the owner page. In a third context, open it → owner controls are visible.
    6. As the owner, delete → confirm `BURN IT` → expect `this file was burned.` In the stranger context, reload → `this file was burned.`
  - **Wrong file:** upload `package.json` → expect the text `that's not your watch history`.

- [ ] **Step 3: Run** `pnpm e2e`. Expected: 2 passed.

- [ ] **Step 4: Commit** `test: end-to-end takeout flow`

---

### Task 11: Deploy ⚠️ owner gate

**Files:**
- Modify: `README.md` (setup, env vars, scripts)

- [ ] **Step 1: Owner creates a free Supabase project** in the region nearest the users (e.g. `ap-south-1` Mumbai). Copy two connection strings: the **transaction pooler** URL (port 6543) for `DATABASE_URL`, and the **direct or session** URL for migrations.

- [ ] **Step 2: Run migrations.** Run `DATABASE_URL=<session url> pnpm db:migrate`. Expected: the `roasts` table exists (check in the Supabase table editor).

- [ ] **Step 3: Set up Vercel** (owner approval needed; this publishes the site). Import `KaushikVipransh/YTRoast` into Vercel Hobby, either through the Vercel dashboard or the Vercel MCP tools if the owner authorises them. Set these env vars:
  - `GEMINI_API_KEY`, `GROQ_API_KEY`
  - `GEMINI_MODEL=gemini-3.8-flash`, `GEMINI_LITE_MODEL=gemini-3.1-flash-lite`, `GEMINI_THINKING=low`, `GROQ_MODEL=openai/gpt-oss-120b`
  - `DATABASE_URL` (the pooler URL)
  - `NEXT_PUBLIC_SITE_URL=https://<project>.vercel.app`

  Then deploy.

- [ ] **Step 4: Verify in production:**
  1. Upload `tests/fixtures/watch-history.json` → a roast appears, written by the AI (no `TEMPLATE ROAST` stamp).
  2. Share it, then paste the link into WhatsApp or Discord → the preview shows the headline image.
  3. Delete it → the page says burned.

  Also check the Vercel function logs to confirm no `[roast] … failed` warnings for the gemini step.

- [ ] **Step 5: Write the README** with setup steps, env vars, and the `test` / `e2e` / `spike` / `summarize` / `db:*` scripts. Then commit `docs: README and deploy notes` and push.
