# Caught Watching — Phase 3: Quick Roast (Google sign-in)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (native, autonomous). Steps use checkbox (`- [ ]`) syntax.

**Goal:** A visitor can tap "quick roast", sign in with Google (read-only YouTube), and get roasted from their liked videos, subscriptions and playlists in under 25 s (PRD F1, US-3, US-4, US-5). It uses the same AI chain, storage, share page and story image as the Takeout path, and ends with a "that was the warm-up" upsell to the full roast.

**Architecture:**
- The browser gets a one-time access token from the Google Identity Services token client (`youtube.readonly`), calls the YouTube Data API **directly from the browser**, and builds a `QuickSummary` with a pure function. The user's likes and subscriptions never pass through our server; only the summary is POSTed, exactly like the Takeout summary.
- `Summary` becomes a union, `TakeoutSummary | QuickSummary`, discriminated by `source`. The schema, prompt, templates, report spreads and story image branch on `source`.
- The feature is invisible until `NEXT_PUBLIC_QUICK_PATH_ENABLED=1` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` are set. It is fully tested with mocked Google: a fake GIS script and YouTube API fixtures via Playwright route interception.

**Tech Stack:** Google Identity Services token client (script `https://accounts.google.com/gsi/client`) · YouTube Data API v3 (`videos.list?myRating=like`, `subscriptions.list?mine=true`, `playlists.list?mine=true`, `playlistItems.list`) · existing stack.

**Spec:** `docs/superpowers/specs/2026-10-17-prd.md` (F1, §5.2 quick-path column, US-3/4/5), `docs/superpowers/specs/2026-10-17-tech-stack.md` (GIS token client, page caps), `docs/superpowers/specs/2026-10-17-design.md` (5.2 path picker, 5.6 quick-path spreads + "THAT WAS THE WARM-UP" upsell, 5.11 "you blinked" error).

**Out of scope:** `/api/enrich` (F6, P1: durations and categories for Takeout hours) is deferred to a later phase because it needs `YOUTUBE_API_KEY`. Google OAuth verification is an owner/Google process.

## Global Constraints

- Scope `https://www.googleapis.com/auth/youtube.readonly` only. The token lives in memory only: never stored, never sent to our server, and revoked (`google.accounts.oauth2.revoke`) once the summary is built.
- Page caps (tech stack): at most **500 likes** (10 pages × 50), **500 subscriptions** (10 × 50), **10 playlists** with at most **50 items each**. Every request carries `maxResults=50`, and pagination stops at the cap.
- The `QuickSummary` stays under 30 KB, and its strings are clipped to 120 chars / 160 bytes with the same `clip` as Takeout. `thinData` is true when `likes + subscriptions < 20` (PRD US-4: the emptiness is the joke).
- Errors:
  - The user closes the popup or denies access → design 5.11: `you blinked. we need read-only YouTube access to roast you.` with a `TRY AGAIN` button.
  - A YouTube API error (403 or quota) → `youtube said no. try again in a bit, or do the full roast with your takeout file.`
  - The account has no YouTube channel → `this google account has no youtube channel. sign in with the one you actually watch on.`
- Copy: the quick ticket reads `QUICK ROAST · 30 seconds · from your likes & subs · mild-ish`, and the full ticket `FULL ROAST · 5–10 min setup · your actual watch history · no survivors` (design 5.2). The upsell reads `THAT WAS THE WARM-UP.` → `want the real damage? do the full roast →`.
- Google branding: the button reads `Sign in with Google` with the official "G" logo, wrapped in our outline frame but otherwise not restyled (design Part 4).
- When the flag is off, `/roast/quick` returns the not-found page and the landing page shows no quick button. Nothing else changes.

## Review Focus

1. **Token handling:** the token must never leave the browser, never reach logs or analytics, and must be revoked after use. Grep test plus unit test.
2. **Huge accounts:** 5,000 subscriptions or 3,000 likes → the caps hold (exactly 10 pages each), and the build stays under 30 KB. Test in Task 2.
3. **Empty accounts:** 0 likes, 0 subs, 0 playlists → a thin-data quick summary that still roasts (templates pass validation). Tests in Tasks 2 and 3.
4. **A forged quick summary posted to the API** is validated by `QuickSummarySchema` exactly as strictly as Takeout: unknown keys, oversize arrays and malformed strings are rejected. Test in Task 1.
5. **Flag off:** no quick UI and a 404 on `/roast/quick`. Flag on without a client id → the button is disabled with a clear message (no crash). Test in Task 5.

---

### Task 1: Summary union and QuickSummarySchema

**Files:** Modify `src/lib/summary.ts`, `src/lib/summary-schema.ts`, and every consumer narrowed by `source` (`src/lib/db/schema.ts` type, `src/lib/roasts/*`). Test `tests/summary-schema.test.ts`.

**Interfaces:**
```ts
export type TakeoutSummary = { …the existing Summary fields…; source: "takeout" };
export type QuickSummary = {
  version: 1; source: "quick";
  totals: { likes: number; subscriptions: number; playlists: number };
  topChannels: Named[];                          // ≤10, from likes (count desc, name asc)
  likedSamples: TitleRef[];                      // ≤15, spread evenly through the likes list
  subscriptions: { oldest: { name: string; since: string }[]; abandoned: string[] }; // oldest ≤5 (YYYY-MM-DD), abandoned ≤10 = subscribed channels with zero likes
  playlists: { title: string; count: number; sampleTitles: string[] }[];             // ≤10, ≤3 titles each
  thinData: boolean;
};
export type Summary = TakeoutSummary | QuickSummary;
export const QuickSummarySchema; export const SummarySchema; // SummarySchema = z.discriminatedUnion("source", [...])
```

- [ ] **Step 1: Write failing tests.**
  - A valid quick summary fixture (`tests/fixtures/quick-summary.json`) parses.
  - These are rejected: an unknown key, 11 top channels, 16 liked samples, a malformed `since`, a lone surrogate, and `source: "quick"` carrying Takeout fields.
  - All existing Takeout tests still pass.
- [ ] **Step 2: Implement.** `parseSummary` returns the union. TypeScript narrowing replaces any code that assumed Takeout fields: run `tsc` and fix each error with an explicit `source` check.
- [ ] **Step 3: Run** `pnpm test`. Commit `feat: QuickSummary type and schema`.

### Task 2: YouTube client and quick summary builder

**Files:** Create `src/lib/quick/youtube.ts` (fetch layer) and `src/lib/quick/build.ts` (pure). Test `tests/quick/youtube.test.ts`, `tests/quick/build.test.ts`, and fixtures `tests/fixtures/youtube/*.json`.

**Interfaces:**
```ts
export type YouTubeData = { likes: { title: string; videoId: string; channel: string | null }[]; subscriptions: { name: string; since: string }[]; playlists: { title: string; items: string[] }[] };
export class YouTubeError extends Error { code: "no-channel" | "forbidden" | "network" }
export function fetchYouTubeData(token: string, fetchFn?: typeof fetch): Promise<YouTubeData>; // caps per Global Constraints
export function buildQuickSummary(data: YouTubeData): QuickSummary;
```

- [ ] **Step 1: Write failing tests.**
  - **Fetch layer** (with a fake `fetchFn` serving fixtures by URL):
    - Paginates `nextPageToken` and stops at 10 pages for likes and subs (the fake keeps returning tokens forever).
    - Playlists are capped at 10 with 50 items each.
    - Sends `Authorization: Bearer <token>` and never puts the token in the URL.
    - 401/403 → `YouTubeError("forbidden")`.
    - A `youtubeSignupRequired` / `channelNotFound` error reason → `"no-channel"`.
  - **Builder:**
    - `topChannels` counts likes by channel.
    - `abandoned` = subscriptions with zero likes (≤10).
    - `oldest` = the 5 earliest `since` dates.
    - `likedSamples` are evenly spaced.
    - `thinData` is true for 3 likes + 2 subs.
    - Strings are clipped to 120.
    - 500 likes + 500 subs + 10 × 50 playlist items → under 30,000 UTF-8 bytes.
    - Empty data → valid against `QuickSummarySchema`.
- [ ] **Step 2: Implement.** Use the `clip` helper (move it from `build-summary.ts` to `src/lib/stats/clip.ts` and share it).
- [ ] **Step 3: Run** `pnpm test`. Commit `feat: youtube fetch layer and quick summary builder`.

### Task 3: Prompt and templates for quick summaries

**Files:** Modify `src/lib/roast/prompt.ts` and `src/lib/roast/templates.ts`. Test `tests/roast/prompt.test.ts` and `tests/roast/templates.test.ts`.

- [ ] **Step 1: Write failing tests.**
  - `buildRoastPrompt(quick)` contains `QUICK ROAST` guidance: this is likes, subs and playlists, not watch history, so don't mention watch times or counts of videos watched.
  - `generateTemplateRoast(quick)` passes `RoastOutputSchema` and `validateRoast` for the fixture, a thin (3 likes) summary, and an all-empty summary. It is deterministic, and its eras are `[]`.
- [ ] **Step 2: Implement.** Write quick template slots (≥20 templates) in the same voice:
  - top liked channel
  - abandoned subscriptions
  - oldest subscription
  - playlist names
  - liked samples
  - thin-data lines ("3 liked videos in 6 years. who hurt you")
  - quick personalities

  The captions use only quick fields.
- [ ] **Step 3: Run** `pnpm test`. Commit `feat: quick roast prompt and templates`.

### Task 4: Report, story and OG for quick roasts

**Files:** `src/components/roast/ReportView.tsx`, `src/components/report/spreads.tsx` (quick spreads), `src/lib/zine/story.ts`. Test `tests/zine/story.test.ts` and `tests/zine/quick-report.test.tsx`.

- [ ] **Step 1: Write failing tests.**
  - `ReportView` with a quick summary renders the spreads `the numbers` (likes/subs/playlists), `top channels`, `subscriptions you abandoned`, `playlists exposed` and `that was the warm-up.` (with a `/roast` link), and none of the Takeout-only spreads.
  - `storyContent(roast, quickSummary).stat` is `"<top channel> · <n> likes"`, or `"<likes> likes"` without a top channel.
- [ ] **Step 2: Implement** with the existing kit.
- [ ] **Step 3: Run** `pnpm test && pnpm build`. Commit `feat: quick roast report spreads and story stat`.

### Task 5: Quick roast page, Google sign-in, flag

**Files:** Create `src/app/roast/quick/page.tsx`, `src/components/quick/QuickRoaster.tsx` (client), `src/lib/quick/gis.ts` (script loader + token request, injectable for tests) and `src/lib/quick/messages.ts`. Modify `src/app/roast/page.tsx` (the design 5.2 path picker tickets when the flag is on) and `src/app/page.tsx` (already gated). Test `tests/quick/messages.test.ts`, `tests/quick/flag.test.tsx`, `e2e/quick-flow.spec.ts`.

**Interfaces:**
```ts
export function quickPathEnabled(): boolean;            // NEXT_PUBLIC_QUICK_PATH_ENABLED === "1"
export function requestToken(clientId: string): Promise<string>; // loads GIS once; rejects with "denied" | "popup_closed"
export function revokeToken(token: string): void;
export function quickErrorMessage(code: "denied" | "popup_closed" | "no-channel" | "forbidden" | "network" | "no-client-id"): string;
```

- [ ] **Step 1: Write failing tests:**
  - `quickErrorMessage` copy for each code, matching Global Constraints.
  - `/roast/quick` calls `notFound()` when the flag is off.
  - The page shows the disabled message `quick roast isn't set up yet. use the full roast.` when the flag is on and the client id is missing.
- [ ] **Step 2: Write `e2e/quick-flow.spec.ts`.** The webServer env gets `NEXT_PUBLIC_QUICK_PATH_ENABLED=1` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID=test-client`. Then:
  - Route `https://accounts.google.com/gsi/client` to a fake script, where `initTokenClient({callback})` returns `{requestAccessToken: () => callback({access_token: "fake-token"})}` and `revoke` records the call on `window`.
  - Route `https://www.googleapis.com/youtube/v3/**` to the fixtures.
  - Assert: click `Sign in with Google` → the VHS loader → URL `/r/<id>` → the h1 is visible, `that was the warm-up.` is visible, and the revoke was called.
  - A second test with a callback `{error: "access_denied"}` shows `you blinked.` and the `try again` button.
- [ ] **Step 3: Implement.**
  - The GIS loader injects the script once.
  - `QuickRoaster`: states idle → signing-in → fetching → roasting → error. It POSTs the summary like the Uploader (same 429/400/413 messages) and tracks `upload_started` / `roast_created` with `generator`-free props.
  - The token is revoked in `finally`.
  - The `/roast` page shows both tickets when the flag is on.
- [ ] **Step 4: Run** `pnpm test && pnpm e2e && pnpm e2e:prod`. Commit `feat: quick roast with google sign-in (flagged)`.

### Task 6: Review, merge, deploy, owner hand-off

- [ ] **Step 1: Final review.** Fresh reviewer, plus the fix pass.
- [ ] **Step 2: Ship.** Merge, push, and verify production with the flag **off** (no quick UI, `/roast/quick` 404, Takeout flow unaffected: one roast, then delete).
- [ ] **Step 3: Owner hand-off.** List exactly what's needed to switch it on:
  - the OAuth client id (JS origins as listed)
  - adding test users
  - setting `NEXT_PUBLIC_GOOGLE_CLIENT_ID` + `NEXT_PUBLIC_QUICK_PATH_ENABLED=1` in Vercel
  - a redeploy
