# Voice spike decision

Date: 2026-10-17 · Status: **APPROVED by the owner (2026-10-17)** · Plan: Phase 1, Task 2

## Setup
- 5 hand-written persona Summaries (`spike/personas/`): gym-bro, 3am-philosopher, minecraft-adult, self-help-addict, thin-data.
- Same system prompt for every model (`src/lib/roast/prompt.ts`), structured output via the AI SDK + Zod, Gemini safety filters `OFF`.
- Validator counts banned phrases plus evidence that is missing from the line or from the data.

## Results

| Model (free tier) | Success | Mean time | Validator problems | Verdict |
|---|---|---|---|---|
| **gemini-3.8-flash** (default thinking) | 5/5 | 42 s (18–100 s) | 0 | Funniest and most specific. Hits the r/RoastMe bar. Far too slow. |
| **gemini-3.8-flash**, thinking `low` | 4/5 | ~7–8 s (one 99 s outlier, one timeout) | 1 | Same voice and much faster. **Free daily quota ran out after ~17 calls.** |
| **gemini-3.1-flash-lite**, thinking `low` | 5/5 | 8 s | 2 | Good and specific. A bit wordier, repeats "cry for help", uses some capital letters. Separate quota. |
| gemini-3.5-flash | 2/5 | 12 s | 0 | "High demand" errors on 3 of 5. Unreliable today. |
| groq openai/gpt-oss-120b | 3/5 | 7 s | 1 | OK, but pasted raw ISO timestamps (fixed in the prompt since then). **200k tokens/day ≈ 50 roasts/day.** |
| groq qwen/qwen3.8-27b | 4/5 | 2.5 s | 4 | Fastest. Invents numbers ("700 hours", "0.5% body fat"). **1,000 output tokens/min ≈ 1 roast/min.** |

No model refused or softened on the brutal topics (breakups, loneliness, 4am depression searches, hair loss).

### Sample lines
- 3.8-flash: "searching how to stop procrastinating 28 times is an elite form of procrastination." · "you rewatched All Too Well (10 Minute Version) 44 times. they've moved on."
- 3.1-flash-lite: "201 Andrew Tate Clips and yet you still have the charisma of a wet paper towel." · "Watching "How To Wake Up At 5AM" at 4:56am is the exact moment your dignity died."
- gpt-oss-120b: "you rewatched 'So long nerds' 31 times like it's therapy." · "you Google 'is creatine safe for hair' like it's a personality trait."
- qwen3.8-27b: "44 views of 'All Too Well (10 Minute Version)'. you are doing this to yourself." · "searched 'is creatine safe for hair' 14 times. you're terrified of side effects you haven't even taken yet."

## Provider order (approved, for Phase 2's fallback chain)
1. **Gemini 3.8 Flash**, thinking `low`, with a hard 20 s timeout. Best voice.
2. **Gemini 3.1 Flash-Lite**, thinking `low`. Separate quota, still good, fast.
3. **Groq gpt-oss-120b**. Third quota pool, about 50 roasts/day.
4. Template fallback (F13).

Config: `GEMINI_MODEL=gemini-3.8-flash`, `GEMINI_THINKING=low`, `GROQ_MODEL=openai/gpt-oss-120b`.

## Open risks
- **The free quota is the binding limit.** 3.8-flash ran out after about 17 calls in one day. Check the real per-model RPD numbers in AI Studio before Phase 2 sizes the "oven full" threshold (PRD F22).
- The 3am-philosopher profile (depression-adjacent searches) took 99 s or timed out on 3.8-flash. A timeout plus fallback is required, not optional.
- Numeric evidence (e.g. "6") passes the validator too easily. Tighten this when F14 retry logic is built in Phase 2.
