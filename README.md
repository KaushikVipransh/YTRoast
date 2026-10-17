# Caught Watching

People upload their YouTube watch history and get a savage, specific roast plus a Wrapped-style report, then share it as a link.

- The whole Takeout file is parsed **in the browser** (Web Worker). Only a compact stats summary goes to the server and the AI.
- Roasts are **private by default**. The owner shares, unshares or deletes them. Deleting wipes the content.
- AI chain: Gemini 3.8 Flash → Gemini 3.1 Flash-Lite → Groq gpt-oss-120b → hand-written template roast.

Specs and plans live in [`docs/superpowers/`](docs/superpowers/).

## Setup

Requires Node 24+ and pnpm 10.

```bash
pnpm install
```

Create `.env.local`:

```bash
GEMINI_API_KEY=...            # https://aistudio.google.com (free tier)
GROQ_API_KEY=...              # https://console.groq.com (free tier)
GEMINI_MODEL=gemini-3.8-flash
GEMINI_LITE_MODEL=gemini-3.1-flash-lite
GEMINI_THINKING=low
GROQ_MODEL=openai/gpt-oss-120b
DATABASE_URL=pglite://memory  # in-memory Postgres for local dev; a Supabase URL in production
SUPABASE_POOLER_URL=...       # transaction pooler (6543): becomes DATABASE_URL on Vercel
SUPABASE_SESSION_URL=...      # session pooler (5432): for pnpm db:migrate only
# ROAST_GENERATOR=template    # skip the AI entirely (offline dev)
# --- Phase 5 guardrails (all optional locally; each degrades gracefully when unset) ---
# UPSTASH_REDIS_REST_URL=...     # rate limits + AI budgets shared across instances (else in-memory per instance)
# UPSTASH_REDIS_REST_TOKEN=...
# ROAST_DAILY_LIMIT=3            # roasts per visitor per day (template "oven full" roasts don't count)
# GEMINI_DAILY_BUDGET=15  GEMINI_LITE_DAILY_BUDGET=400  GROQ_DAILY_BUDGET=40   # calls/UTC day per provider
# NEXT_PUBLIC_POSTHOG_KEY=phc_... NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
# NEXT_PUBLIC_SENTRY_DSN=https://...
# CRON_SECRET=...                # Vercel Cron bearer for /api/cron/keepalive (daily DB ping)
# NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Then run `pnpm dev`. With `pglite://memory`, the data resets whenever the dev server restarts.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server on http://localhost:3000 |
| `pnpm test` | Unit and integration tests (Vitest, in-memory Postgres). The heavy perf tests run last, one file at a time |
| `pnpm e2e:prod` | Same browser run against `next build && next start` (what Vercel serves) |
| `pnpm e2e` | One real-browser run of the whole flow (Playwright; template roasts, in-memory DB). Run `pnpm exec playwright install chromium` once first |
| `pnpm build` | Production build |
| `pnpm spike [dir]` | Voice spike: roast every summary in `spike/personas` (and `spike/summaries`) with every model and write a report to `spike/out/` |
| `pnpm summarize <takeout.zip> [label]` | Turn a real Takeout export into `spike/summaries/real-<label>.json` (gitignored, since it's personal data) |
| `pnpm db:generate` | Generate a SQL migration from `src/lib/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations to `DATABASE_URL`. Use a **direct or session** connection string here, not the transaction pooler |

## Deploying (Vercel Hobby + Supabase, $0)

1. **Supabase:** create a free project. Copy two connection strings:
   - the **transaction pooler** URL (port 6543), for the app's `DATABASE_URL`
   - the **session or direct** URL, for migrations
2. **Migrate:** run `DATABASE_URL="<SUPABASE_SESSION_URL>" pnpm db:migrate`. Don't point `DATABASE_URL` in `.env.local` at Supabase, or `pnpm dev` writes test roasts into production.
3. **Vercel:** import the GitHub repo and set the env vars:
   - everything from `.env.local` above, but with the pooler `DATABASE_URL`
   - `NEXT_PUBLIC_SITE_URL=https://<project>.vercel.app`
4. **Check:** after deploying, upload a Takeout file, share the roast, and paste the link into a chat app to see the preview.

Free projects on Supabase pause after 7 days without traffic. A keep-alive cron arrives in Phase 5.
