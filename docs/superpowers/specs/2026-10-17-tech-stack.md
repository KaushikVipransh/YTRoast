# Caught Watching — Tech Stack

Date: 2026-10-17 · Companion to [the PRD](2026-10-17-prd.md)

**Constraint that drives everything: $0/month.** Every choice below has a free tier that covers a hobby launch, and the design degrades gracefully when one runs out. Free-tier numbers change often. Check each provider's console at build time and do not hard-code quotas.

---

## 1. Architecture at a glance

```
                 ┌──────────────────── USER'S BROWSER ────────────────────┐
 Quick path:     │ Google sign-in (token client) ──► YouTube Data API     │
                 │   likes · subs · playlists                              │
 Full path:      │ Takeout .zip ──► Web Worker (unzip + parse) ──► entries │
                 │                                                         │
                 │            Stats engine (TypeScript, runs here)        │
                 │                     │  Summary (~10–30 KB JSON)         │
                 └─────────────────────┼───────────────────────────────────┘
                                       ▼
                 ┌────────────── NEXT.JS ON VERCEL (server) ──────────────┐
                 │ POST /api/enrich  → YouTube API (server key, sample)    │
                 │ POST /api/roast   → rate limit (Upstash Redis)          │
                 │                   → AI: Gemini ─fallback→ Groq          │
                 │                   ─fallback→ template roast             │
                 │                   → save to Postgres (Supabase)         │
                 │ GET  /r/[id]      → roast + report page                 │
                 │ GET  /r/[id]/og   → share images (Satori)               │
                 └─────────────────────────────────────────────────────────┘
```

**The core idea:** raw data never leaves the browser. The browser computes the stats and sends a compact **Summary**. The server only writes jokes from it and stores the result.

---

## 2. The stack

| Layer | Choice | Free tier |
|---|---|---|
| Framework | **Next.js 16** (App Router) + **TypeScript** | open source |
| Hosting | **Vercel Hobby** | free |
| Styling | **Tailwind CSS v4** + CSS variables for design tokens | open source |
| Animation | **Motion** (formerly Framer Motion) | open source |
| Google sign-in | **Google Identity Services** token client (browser) | free |
| YouTube data | **YouTube Data API v3** | 10,000 units/day default quota |
| Takeout unzip | **fflate** | open source |
| Takeout HTML parse | **htmlparser2** (works inside Web Workers) | open source |
| Worker plumbing | **Comlink** | open source |
| AI SDK | **Vercel AI SDK** (`ai`) with structured output + **Zod** schema | open source |
| AI provider #1 | **Google Gemini API**, Flash-class model, free tier | free, rate-limited |
| AI provider #2 | **Groq**, open-weight model (Llama / gpt-oss class), free tier | free, rate-limited |
| Database | **Supabase Postgres** (free) via **Drizzle ORM** | free (500 MB DB) |
| Rate limiting | **Upstash Redis** + `@upstash/ratelimit` | free |
| Share images | **next/og** (`ImageResponse`, Satori) | included |
| Analytics | **PostHog** (cloud free tier) | free |
| Errors | **Sentry** (free developer plan) | free |
| Testing | **Vitest** (unit), **Playwright** (one end-to-end flow) | open source |
| Package manager | **pnpm** | — |

---

## 3. Why each choice

### Next.js 16 + TypeScript on Vercel
- One codebase for the marketing page, the app, the API routes, and the server-rendered share pages. Share pages **must** be server-rendered so chat apps can read the preview tags; a pure single-page app can't do that well.
- `next/og` generates the share images on the same platform at no extra cost.
- The owner has built many sites this way, so nothing new to learn.
- Vercel Hobby is free and deploys on `git push`. It's for non-commercial use, which this is.
- *Considered:* **Cloudflare Workers + OpenNext** (more generous free limits under heavy traffic, but more setup friction with Next.js). If a viral spike ever outgrows Vercel Hobby, moving here is the escape hatch. **Astro** (great for static pages, weaker for this app-like flow).

### Tailwind v4 + CSS variables
- The design (see the design doc) is token-heavy: paper colours, thick outlines, offset shadows. Tokens as CSS variables + Tailwind utilities keeps them consistent.
- *Considered:* a component library (shadcn/ui). Rejected for the visible UI because the collage look is fully custom. Its unstyled primitives (dialog, toast) are fine to borrow.

### Motion
- The roast reveal, sticker drops, and report card transitions are the "wow" moments. Motion handles spring physics and scroll-linked animation with little code.

### Google Identity Services token client (no auth library)
- The quick path needs a **one-time** read-only access token, not accounts or sessions. GIS's token client gets an access token for `youtube.readonly` directly in the browser. No client secret, no session database, no auth library.
- The browser calls the YouTube API itself, so the user's likes and subscriptions never pass through our server. That keeps the privacy story honest.
- *Considered:* **Auth.js / Supabase Auth.** Both are built for persistent logins we don't need and would route tokens through the server.
- ⚠️ **Verification:** `youtube.readonly` is a *sensitive* scope. Until Google verifies the app: 100 test users max and an "unverified app" warning. Verification is free but needs a homepage, privacy policy, and an authorised domain verified in Search Console. A `*.vercel.app` subdomain may not be accepted, so plan for a cheap custom domain (~$10/yr) as the **only potential cost**. Start verification in week 1. The Takeout path needs none of this.
- **Current decision (2026-10-17):** no custom domain. The quick path stays in Google's testing mode (100 test users). Build it so the "Sign in with Google" button can be shown to test users only or hidden behind a flag (`NEXT_PUBLIC_QUICK_PATH_ENABLED`), and lead the public launch with Takeout.

### YouTube Data API v3
- Quick path (browser, user's token): `videos.list?myRating=like`, `subscriptions.list?mine=true`, `playlists.list?mine=true`, `playlistItems.list`. Cap pages fetched (e.g., 500 likes, 500 subs, 10 playlists × 50 items) to keep it fast and within quota.
- Full path enrichment (server, API key): `videos.list` takes 50 IDs per call for **1 unit**. Enriching the **top ~200 most-watched videos = 4 units** per roast, so thousands of roasts per day fit inside the default quota. Never try to enrich all of a user's history.
- Takeout entries have title, URL, channel and timestamp but **no duration or category**, so durations and "hours watched" are estimates from the enriched sample and must be labelled that way.

### fflate + htmlparser2 + Comlink in a Web Worker
- Takeout comes as a zip, and heavy users have 50–200 MB of history. **fflate** is the fastest small unzip library and streams, so we pull out only `watch-history.*` and `search-history.*`.
- Google exports HTML by default (JSON if the user picks it). **htmlparser2** parses HTML inside a worker, where the browser's `DOMParser` isn't available.
- Running in a **Web Worker** keeps the phone's UI responsive during parsing (PRD US-10). **Comlink** makes the worker feel like a normal async function.

### Vercel AI SDK + Zod
- One interface for both Gemini and Groq. Switching providers is a one-line change, and the fallback chain (Gemini → Groq → template) is simple.
- **Structured output with a Zod schema** forces the AI to return exactly `{ headline, lines[], personality, eras[], sectionCaptions{} }`. No parsing free text, and outputs that fail the schema get retried.
- *Considered:* each provider's own SDK. More code, harder fallback.

### Gemini (primary) and Groq (backup)
- These are the two strongest **free** API tiers available today. Claude and OpenAI have no free API tier, so they're out under the $0 rule.
- **Gemini Flash-class** writes well, handles long prompts (a big Summary plus many examples of the voice), and the free tier allows several hundred requests per day *(check the current limit in AI Studio)*. Its safety settings can be lowered for harassment/hate/sexual/dangerous categories, which the raw-roast requirement needs.
- **Groq** has very fast inference on open-weight models with a separate free quota. Open-weight models also tend to refuse edgy humour less often.
- ⚠️ **Spike before building:** run 10 real summaries with the full brutal prompt through both providers. If Gemini softens or refuses too often, swap the order and make Groq primary. This is the biggest product risk (PRD §8).
- ⚠️ **Privacy disclosure:** Free tiers may use inputs to improve the provider's models. The privacy page must say so.

### Template fallback (in-house code)
- When both providers are over quota or refuse, a deterministic joke-template engine fills slots from the stats ("you watched {topChannel} {count} times. {count} times."). It's less funny, but the user always gets something. Write ~60 templates by hand in the house voice.

### Supabase Postgres + Drizzle
- We need to store roasts for shareable links: a single table, read-mostly. Postgres is the boring, correct choice.
- Supabase's free tier is the easiest free Postgres with a dashboard. Access it **only from the server** through the connection pooler with Drizzle. No browser-side Supabase client and no Row Level Security complexity.
- ⚠️ Free projects **pause after 7 days of inactivity**. Any real traffic prevents it. For quiet stretches, a free Vercel cron that pings the DB daily is enough.
- *Considered:* **Neon** (also good, scale-to-zero cold starts), **Cloudflare D1** (only natural if hosting moves to Cloudflare), **Turso**. All fine; Supabase wins on dashboard and familiarity.

**Schema sketch**
```
roasts
  id            text  pk      -- 12-char random, unguessable (nanoid)
  owner_hash    text          -- sha256 of the owner's secret token
  source        text          -- 'quick' | 'takeout'
  visibility    text          -- 'private' | 'public'
  summary       jsonb         -- stats used to render the report (no raw history)
  roast         jsonb         -- AI (or template) output
  generator     text          -- 'gemini' | 'groq' | 'template'
  feedback      smallint null -- 👍 1 / 👎 -1
  created_at    timestamptz
  deleted_at    timestamptz null  -- content nulled on delete, row kept so the link can say "deleted"
```
On delete, `summary` and `roast` are wiped immediately. Only the tombstone remains.

### Ownership without accounts
- On creation the server returns a random **owner token**. The browser stores it in an httpOnly cookie (keyed by roast id) and the DB stores only its hash. Owner actions (share, unshare, delete) check the cookie.
- If the user clears cookies, they lose control of that roast. That's accepted for v1. The UI offers a "save your secret delete link" as a backup.

### Upstash Redis rate limiting
- Serverless-friendly (HTTP API), free tier, and `@upstash/ratelimit` is a drop-in. Limits per IP (e.g., 3 roasts/day) plus a global daily counter that flips the site into "oven is full" mode before the AI quota is gone.
- *Considered:* counting in Postgres. It works, but adds write load to the free DB and gets fiddly under concurrency.

### next/og for share images
- Renders JSX to PNG at the edge: `/r/[id]/og` (1200×630 link preview) and `/r/[id]/story` (1080×1920 download). Cached after the first render. Display fonts are bundled so images match the site.

### PostHog + Sentry
- PostHog's free tier covers the PRD funnel metrics (share rate, viral loop, Takeout completion). **Events never contain watch data**, only steps and counts.
- Sentry catches parser crashes on weird Takeout files, which will happen.

### Vitest + Playwright
- Test where bugs would hurt: the **Takeout parser** (fixtures from real JSON and HTML exports, including other locales' date formats) and the **stats engine** (pure functions, easy to test). One Playwright run of the full Takeout flow with the AI mocked.
- AI output quality is checked by hand during the spike and with the banned-phrase validator, not by unit tests.

---

## 4. Request budget per roast (free-tier fit)

| Resource | Quick path | Full path |
|---|---|---|
| YouTube API units | ~10–30 (user's token, our project quota) | ~4 (enrichment) |
| AI calls | 1 (+1 on retry/fallback) | 1 (+1) |
| DB writes | 1 | 1 |
| Redis commands | ~3 | ~3 |

The binding limit is **AI requests per day**. Size the global "oven is full" threshold to ~90% of whichever provider quota is lower.

---

## 5. Environment variables

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID      # GIS token client
YOUTUBE_API_KEY                   # server-only, for enrichment
GEMINI_API_KEY
GROQ_API_KEY
DATABASE_URL                      # Supabase pooler connection string
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
NEXT_PUBLIC_POSTHOG_KEY
SENTRY_DSN
```

---

## 6. Build order (suggested)
1. **AI voice spike.** Can free Gemini/Groq be brutal and human? Decide provider order.
2. Takeout parser + stats engine (with tests). Uses no external services.
3. Roast API + DB + share page + OG image.
4. Quick path (GIS + YouTube API). Submit OAuth verification on day one of this step.
5. Design polish, report sections, animations.
6. Rate limits, fallback templates, privacy/terms pages, analytics.
