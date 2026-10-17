# Caught Watching — Phase 5: Guardrails, Legal, Analytics (safe to share)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (owner chose native, autonomous execution). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make https://ytroast.vercel.app safe to share publicly. Free AI quota can't be drained, the site says when it's "at capacity", privacy and terms pages exist, errors and funnel metrics are visible, and the free database never pauses.

**Architecture:** A small `Limiter` interface with two implementations: Upstash Redis in production and in-memory for tests and dev. It backs two things:
1. a per-visitor daily roast limit in `handleCreate`
2. per-provider daily budgets plus short cooldowns after quota errors inside the generation chain, so known-exhausted providers are skipped instantly

PostHog (client, events without watch data) and Sentry (server and client errors) switch on only when their env vars exist. A daily Vercel cron pings the DB.

**Tech Stack:** @upstash/ratelimit 2 + @upstash/redis 1 · posthog-js · @sentry/nextjs 11 · Vercel Cron (Hobby: daily)

**Spec:** `docs/superpowers/specs/2026-10-17-prd.md` (F21–F25, US-19, §6 metrics, §9 privacy wording), `docs/superpowers/specs/2026-10-17-tech-stack.md` (Upstash, PostHog, Sentry, keep-alive), `docs/superpowers/specs/2026-10-17-design.md` §5.10 (oven full copy).

## Global Constraints

- $0. Every service is on its free tier, and missing env vars **degrade, never crash**: no Upstash → in-memory limiter + one `console.warn`; no PostHog key → no analytics; no Sentry DSN → no Sentry.
- **Analytics events never contain watch data.** No titles, channels, queries, summary fields, roast text or roast ids. Allowed properties: `generator`, `source`, counts bucketed to `"<50" | "50-1k" | "1k-10k" | "10k+"`, `status` codes, and step names.
- **Per-visitor limit:** `ROAST_DAILY_LIMIT` (default **3**) roasts per IP per rolling 24 h. Over the limit → **429** `{error:"rate-limited"}`, and the AI is never called. The IP comes from `x-real-ip`, then the first `x-forwarded-for` entry, then `"unknown"`.
- **Provider budgets** (calls per UTC day): `GEMINI_DAILY_BUDGET` (default **15**), `GEMINI_LITE_DAILY_BUDGET` (default **400**), `GROQ_DAILY_BUDGET` (default **40**). A step whose budget is used up is skipped without a call. A provider error matching `/quota|rate.?limit|429|RESOURCE_EXHAUSTED|high demand|overloaded/i` puts that provider in a **10-minute cooldown**.
- **Oven full:** when the chain returns a template because every provider was skipped or failed, the roast page shows the design §5.10 copy and the `TEMPLATE ROAST` stamp. The DB schema does not change.
- Privacy page wording follows PRD §9 exactly, and must say that free-tier AI providers may use inputs to improve their models (F23). Terms say users must be **13+** and the content is intentionally offensive (F24).
- Contact email and product name are owner decisions. Use the constants `CONTACT_EMAIL` and `PRODUCT_NAME` in `src/lib/copy.ts`, defaulting to `kaushikvipransh1504@gmail.com` and `Caught Watching` **only after the owner confirms**. Until then use `CONTACT_EMAIL = null`, which hides the contact line.

## Review Focus

1. **The limit is bypassed** by a spoofed `x-forwarded-for` header. On Vercel, `x-real-ip` is set by the platform and wins. Test: if both headers are present, `x-real-ip` is used.
2. **Upstash is down or slow:** a roast must still be created. The limiter fails **open**, with a 1 s timeout and a warning. Test in Task 1.
3. **Budget counters drift** across UTC midnight. The key includes the UTC date. Test in Task 1.
4. **Analytics leaks.** Grep-style test: no `capture(` call passes a property outside the allowed list.
5. **A cron hits the endpoint without the secret** → 401. Test in Task 7.

---

### Task 1: Limiter, budgets, cooldowns (core)

**Files:** Create `src/lib/limits/limiter.ts`, `src/lib/limits/budget.ts`. Modify `src/lib/roast/generate.ts`. Test `tests/limits/*.test.ts`, `tests/roast/generate.test.ts`.

**Interfaces:**
```ts
// limiter.ts
export interface Store {               // minimal KV with atomic increment + expiry
  incr(key: string, ttlSec: number): Promise<number>;
  get(key: string): Promise<number>;
  set(key: string, value: number, ttlSec: number): Promise<void>;
}
export function memoryStore(now?: () => number): Store;
export function upstashStore(url: string, token: string): Store;           // @upstash/redis, 1 s timeout per call
export function getStore(): Store;                                        // env → upstash, else memory (+ one warn), cached on globalThis
export function failOpen<T>(p: Promise<T>, fallback: T, label: string): Promise<T>; // timeout 1 s or error → fallback + warn
// budget.ts
export type Budgets = Record<Exclude<Generator, "template">, number>;
export function defaultBudgets(): Budgets;                                  // env with defaults 15/400/40
export function utcDay(now: Date): string;                                  // "2026-10-18"
export function makeProviderGate(store: Store, budgets: Budgets, now?: () => Date): {
  canUse(g: ChainStep["generator"]): Promise<boolean>;  // false if over budget or cooling down
  recordCall(g): Promise<void>;                         // incr day counter
  recordQuotaError(g): Promise<void>;                   // 10-min cooldown
};
export const QUOTA_ERROR: RegExp;
// generate.ts: generateRoast(summary, opts?: { …existing, gate?: ProviderGate }) → { roast, generator, ovenFull: boolean }
```

- [ ] **Step 1: Write failing tests:**
  - `memoryStore`: `incr` counts and expires after the TTL (inject `now`).
  - `failOpen`: a promise that never settles → fallback after about 1 s (use fake timers). A rejection → fallback.
  - `utcDay(new Date("2026-10-18T23:59:59+05:30"))` → `"2026-10-18"`; `utcDay(new Date("2026-10-19T00:30:00+05:30"))` → `"2026-10-18"`.
  - gate: with budget 2, `canUse` is true, true, then false after 2 `recordCall`s, and true again the next UTC day. `recordQuotaError` → false for 10 minutes, then true.
  - `QUOTA_ERROR` matches `"You exceeded your current quota"`, `"Rate limit reached for model"`, `"This model is currently experiencing high demand"` and `"429"`. It does not match `"timed out after 25000 ms"`.
  - chain:
    - A gate that says gemini is unavailable → gemini is never called, and gemini-lite is used.
    - A quota-style error → `recordQuotaError` is called for that step.
    - Every call is recorded with `recordCall`.
    - All steps unavailable → `{generator:"template", ovenFull:true}` with zero calls.
    - All steps throw a non-quota error → `ovenFull:true`. (The template is used, so the user sees capacity copy either way.)
    - Success → `ovenFull:false`.
- [ ] **Step 2: Run** `pnpm test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `pnpm add @upstash/redis @upstash/ratelimit`.
  - Counter keys: `cw:budget:<generator>:<utcDay>` (TTL 2 days) and `cw:cool:<generator>` (TTL 600 s).
  - The gate wraps every store call in `failOpen`. If the store is unreachable, providers are allowed.
  - `generateRoast` asks `gate.canUse` before each step. It calls `recordCall` before the request, and `recordQuotaError` when a thrown message matches `QUOTA_ERROR`. The default gate is `makeProviderGate(getStore(), defaultBudgets())`.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: provider budgets, quota cooldowns and a fail-open limiter store`.

### Task 2: Per-visitor daily limit

**Files:** Modify `src/lib/roasts/http.ts`, `src/app/api/roast/route.ts`, `src/lib/upload-messages.ts`, `src/components/upload/Uploader.tsx`. Test `tests/roasts/http.test.ts`, `tests/upload/messages.test.ts`.

**Interfaces:** `Deps` gains `limit: (ip: string) => Promise<boolean>` (true = allowed). Add `export function clientIp(req: Request): string` and `export function makeVisitorLimit(store: Store, perDay: number): (ip: string) => Promise<boolean>`. The latter uses `@upstash/ratelimit` sliding window when the store is Upstash, and a store counter `cw:rl:<ip>:<utcDay>` otherwise. It fails open.

- [ ] **Step 1: Write failing tests:**
  - `limit` returns false → **429** `{error:"rate-limited"}`, and `generate` is not called and no row is written.
  - `limit` is called with the IP after the summary validates. A bad summary does not burn a slot.
  - `clientIp`: when both `x-real-ip` and `x-forwarded-for` are set, `x-real-ip` wins. Otherwise the first `x-forwarded-for` entry is used. With neither → `"unknown"`.
  - `makeVisitorLimit(memoryStore(), 3)` → true ×3, then false.
  - `uploadErrorMessage(429)` contains `you've been roasted 3 times today. come back tomorrow, you need the rest.`
  - A `content-length` header over 64,000 → 413 before the body is read (review M5).
- [ ] **Step 2: Run tests.** Expected: FAIL.
- [ ] **Step 3: Implement.** The route wires `limit: makeVisitorLimit(getStore(), Number(process.env.ROAST_DAILY_LIMIT ?? 3))`.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: per-visitor daily roast limit`.

### Task 3: Oven-full experience

**Files:** Modify `src/app/api/roast/route.ts` (passes `ovenFull` through to the response body `{id, ovenFull}`) and `src/components/roast/RoastView.tsx`. Test `tests/roast/oven.test.ts`.

**Interfaces:** `export function templateNotice(): string` in `src/lib/copy.ts` returns `too many people getting roasted right now. here's a quick one from your stats, come back later for the real thing.`

- [ ] **Step 1: Write failing tests.** The `templateNotice()` copy is exact. `handleCreate` returns `ovenFull` in the 201 body.
- [ ] **Step 2: Implement.** `RoastView` shows the notice, a `WE'RE AT CAPACITY` sticker (plain styled `<p>`) and the stamp whenever `generator === "template"`.
- [ ] **Step 3: Run** `pnpm test && pnpm build`. Expected: PASS.
- [ ] **Step 4: Commit** `feat: oven-full notice on template roasts`.

### Task 4: Hardening from the Phase 2 review (M6, M8, M9)

**Files:**
- Create `src/app/r/[id]/claim/page.tsx` (client) and `src/app/api/roast/[id]/claim/route.ts`.
- Delete `src/app/r/[id]/claim/route.ts`.
- Modify `src/lib/roasts/http.ts`, `src/app/r/[id]/page.tsx` (the secret link becomes `/r/<id>/claim#key=<token>`), `src/lib/db/client.ts`, `src/app/r/[id]/opengraph-image.tsx`, `e2e/takeout-flow.spec.ts`.

- [ ] **Step 1: Write failing tests:**
  - `handleClaim` becomes **POST** with body `{key}` → 200 + `Set-Cookie` for the right key, and 404 with no cookie for a wrong key or unknown id.
  - `getDb()` throws `"pglite is not allowed in production"` when `VERCEL_ENV=production` and the URL starts with `pglite:`.
- [ ] **Step 2: Implement.**
  - The claim page reads `location.hash`, POSTs the key, then calls `router.replace("/r/<id>")`. On failure it shows `that secret link didn't work. it may be from a deleted roast.`
  - Because the key is in the fragment, it never reaches server logs or `Referer` headers.
  - Add `await connection()` at the start of the OG image function.
  - Update the e2e secret-link step: the link now contains `#key=`.
- [ ] **Step 3: Run** `pnpm test && pnpm e2e`. Expected: PASS.
- [ ] **Step 4: Commit** `fix: secret link key moves to the URL fragment; guard pglite in production`.

### Task 5: Privacy and terms pages

**Files:** Create `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/components/SiteFooter.tsx`. Modify `src/app/layout.tsx` and `src/lib/copy.ts`. Test `tests/legal.test.ts` (renders the page components to static markup with `react-dom/server`).

- [ ] **Step 1: Write failing tests.** The privacy page contains:
  - `PRIVACY_LINE`
  - `your full history never reaches our servers`
  - `free AI providers (Google Gemini, Groq) may use what we send them to improve their models`
  - `private until you share it`
  - `deleting a roast wipes it from our database immediately`
  - `analytics never include what you watched`

  The terms page contains `you must be at least 13`, `intentionally offensive`, and `don't upload someone else's history without their permission`. Both pages render the contact line only when `CONTACT_EMAIL` is non-null.
- [ ] **Step 2: Implement.** Plain, short sections in the site's lowercase voice. The footer on every page has `privacy · terms`. The `/roast` page links to the privacy page next to the privacy line.
- [ ] **Step 3: Run** `pnpm test && pnpm build`. Expected: PASS.
- [ ] **Step 4: Commit** `feat: privacy and terms pages`.

### Task 6: Analytics (PostHog) and error tracking (Sentry)

**Files:** Create `src/lib/analytics.ts`, `src/components/Analytics.tsx`, `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts` (if the @sentry/nextjs 11 docs require it). Modify `src/app/layout.tsx`, `Uploader.tsx`, `OwnerControls.tsx`, `src/app/r/[id]/page.tsx` (shared-view event via a small client component), `next.config.ts`. Test `tests/analytics.test.ts`.

**Interfaces:**
```ts
export type EventName = "landing_view" | "guide_view" | "upload_started" | "upload_failed" | "roast_created"
  | "roast_shared" | "roast_unshared" | "roast_deleted" | "shared_view" | "roast_me_next_click" | "feedback";
export type EventProps = { generator?: Generator; status?: number; code?: string; videos?: "<50" | "50-1k" | "1k-10k" | "10k+"; value?: 1 | -1; ovenFull?: boolean };
export function track(event: EventName, props?: EventProps): void;   // no-op without NEXT_PUBLIC_POSTHOG_KEY
export function bucket(videos: number): EventProps["videos"];
```

- [ ] **Step 1: Write failing tests:**
  - `bucket` boundaries: 49 → `"<50"`, 50 → `"50-1k"`, 1000 → `"1k-10k"`, 10000 → `"10k+"`.
  - `track` is a no-op (no throw, no import of posthog) without a key.
  - A source scan (read every file under `src/`) finds no `track(` call whose object literal has a key outside `EventProps`.
- [ ] **Step 2: Implement.**
  - PostHog: init with `{ api_host, person_profiles: "identified_only", autocapture: false, capture_pageview: false, disable_session_recording: true }`. Track only these events.
  - Sentry: read `node_modules/@sentry/nextjs` README / docs for v11 + Next 16 before wiring. `Sentry.init({ dsn, tracesSampleRate: 0 })` only when `NEXT_PUBLIC_SENTRY_DSN` is set. No source-map upload, since that needs an auth token.
  - The roast route captures exceptions automatically through instrumentation.
- [ ] **Step 3: Run** `pnpm test && pnpm build && pnpm e2e`. Expected: PASS.
- [ ] **Step 4: Commit** `feat: privacy-safe analytics and optional sentry`.

### Task 7: Database keep-alive cron

**Files:** Create `src/app/api/cron/keepalive/route.ts`, `vercel.json` (`crons: [{ path: "/api/cron/keepalive", schedule: "0 3 * * *" }]`). Test `tests/cron.test.ts` via `handleKeepalive(req, deps)` in `src/lib/cron.ts`.

- [ ] **Step 1: Write failing tests.** Without `Authorization: Bearer <CRON_SECRET>` → 401. With it → 200 `{ok:true}` after a `select 1` on the DB. When `CRON_SECRET` is unset → 401 (fail closed).
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run** `pnpm test && pnpm build`. Expected: PASS.
- [ ] **Step 4: Commit** `feat: daily database keep-alive cron`.

### Task 8: Production-build e2e (review M12)

**Files:** Modify `playwright.config.ts` (a second project, `prod-build`, enabled with `E2E_PROD=1`: webServer `pnpm build && pnpm start --port 3200`) and `package.json` (`"e2e:prod": "E2E_PROD=1 playwright test"` via cross-env-free syntax that works on Windows: a small `scripts/e2e-prod.mjs` that sets the env and spawns playwright).

- [ ] **Step 1: Run** `pnpm e2e:prod`. Expected: 2 passed against `next start`.
- [ ] **Step 2: Commit** `test: e2e against a production build`.

### Task 9: Deploy and verify ⚠️ needs owner accounts (Upstash, PostHog, Sentry)

- [ ] **Step 1: Set the env vars in Vercel** (production + preview): non-secret ones by connector (`ROAST_DAILY_LIMIT`, budgets, `NEXT_PUBLIC_POSTHOG_*`, `NEXT_PUBLIC_SENTRY_DSN`) and generate `CRON_SECRET` (random 32 bytes, set by connector as sensitive; it never leaves Vercel). The owner sets the Upstash ones.
- [ ] **Step 2: Push to main**, wait for READY, then verify on production:
  1. 4 roasts from one IP → the 4th returns 429 with the message. Clean up the rows.
  2. `/privacy` and `/terms` load.
  3. The cron endpoint without the secret → 401.
  4. PostHog live events show `landing_view` (if the key is set).
  5. A Sentry test error appears (if the DSN is set).
- [ ] **Step 3: README** env table update, commit, push.
