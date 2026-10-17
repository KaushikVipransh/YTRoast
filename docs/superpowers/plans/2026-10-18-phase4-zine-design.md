# Caught Watching — Phase 4: The Evidence Zine (design, report spreads, motion, story image)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (native, autonomous). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn the plain Phase 2 pages into the design doc's "Evidence Zine":
- paper and ink tokens, chunky outlined display type, stickers, torn colour bands, marker circles and a rotating stamp
- a staggered roast reveal and report spreads with hand-made SVG charts
- a VHS loader, a downloadable 1080×1920 story image (PRD F18)
- the accessibility fixes deferred from the Phase 2/5 reviews

**Architecture:** A small design kit under `src/components/zine/` holds presentational components (no data fetching): `Display`, `Button`/`LinkButton`, `Sticker`, `Band`, `Stamp`, `Sparkle`, `Tape`, `MarkerCircle`, `GraphPatch`, `EvidenceCard`, `StatBlock`, `RansomStrip`, `VhsLoader`, and illustrations (`VhsTape`, `CrtTv`, `CrumpledPaper`, `EvidenceBag`) as inline SVG.

Pages compose the kit. The data → layout logic that is worth testing lives in pure helpers in `src/lib/zine/`, unit-tested: clock-chart geometry, story-image line selection and font sizing, the random-but-stable tilt from an id, and YouTube thumbnail URLs.

Motion uses `motion` (Motion for React) with `useReducedMotion`. Visual quality is checked by Playwright screenshots at 390 px and 1280 px that the executor views and critiques (Task 9).

**Tech Stack:** next/font/google (Bowlby One, Barlow Condensed 600/800, Barlow 400/600, Permanent Marker, Space Mono) · Tailwind v4 tokens (already in globals.css) · motion 12 · next/og for the story image · Playwright screenshots.

**Spec:** `docs/superpowers/specs/2026-10-17-design.md` (binding for tokens, components, screens 5.1–5.11, Part 6 share images, Part 7 motion, Part 8 accessibility, Part 9 illustrations).

## Global Constraints

- **Colours:** only the design tokens (`--paper #F6F4EE`, `--paper-shade #E9E4D8`, `--ink #1F2A44`, `--ink-soft #4A5470`, `--sky #5AA9D6`, `--butter #F3D66B`, `--tangerine #EE9A5C`, `--leaf #93C572`, `--brick #D9583B`, `--marker #E2362B`). Flat fills, no gradients. Light only.
- **Contrast:** body text is ink or ink-soft on light fills. **No small text in marker red**: errors use ink text with a marker-red border or icon. Never white text on sky or butter. Display text with an outline counts as large text.
- **Tilt:** at most ±3° on anything people must read. Stickers may tilt ±12°. Tilt is stable per element (derived from a seed), not random on every render, so there is no hydration mismatch.
- **Decoration** (stickers, sparkles, tape, textures, illustrations) is `aria-hidden`. Roast lines are real text, never images.
- **Tap targets** are at least 48 px. Focus rings are visible everywhere (`outline: 3px solid var(--ink); outline-offset: 2px`), including the file input's label. Dialogs move focus into themselves and close with Escape.
- **Motion:** stickers spring-pop; bands slide up 24 px; marker strokes draw on over 400–700 ms; roast lines stagger 600 ms apart with a 2° wobble; buttons press 3 px; the stamp rotates once every 30 s. With `prefers-reduced-motion`, everything becomes an instant appearance, the stamp stops, and all lines show at once.
- **Performance:** fonts subset to Latin via next/font, no texture images over 120 KB total (prefer CSS and inline SVG; grain is an inline SVG `feTurbulence` filter), thumbnails `loading="lazy"`.
- **YouTube:** thumbnails come from `https://i.ytimg.com/vi/<videoId>/mqdefault.jpg` (a plain `<img>`, no next/image remote config) and **link back to the video on YouTube**. The YouTube logo is never used as our mark.
- **Copy:** existing user-facing strings asserted by tests or e2e stay word-for-word, unless this plan changes them on purpose. These include the privacy line, error messages, the "nothing here" / "burned" pages, "only you can see this", "you're reading someone's file", "roast me next", "template roast", "burn it", "share", "make private", and the secret link testid. Uppercase is done with CSS `text-transform`, so the text in the DOM keeps its lowercase source.
- No new paid services. No external image or font CDNs beyond next/font's self-hosting and i.ytimg.com thumbnails.

## Review Focus

1. **Hydration mismatches** from random tilts or time-based content. Test: tilts come from `seededTilt(seed)`, which is pure.
2. **Reduced motion:** nothing animates and all content is visible. An e2e run with `reducedMotion: "reduce"` asserts every roast line is visible right away.
3. **Long content:** 140-character headlines, 120-character titles, 10 roast lines, empty sections. Story image and OG must not overflow (Task 7 tests), and spreads must not break layout at 390 px (screenshot review).
4. **Shared viewers on a template roast:** they see only the stamp, never "come back later" (Phase 5 review M12). Test in Task 5.
5. **Keyboard-only users:** they can upload, share, delete (dialog focus trap + Escape) and vote. An e2e check tabs to the drop zone label and sees a visible focus ring.

---

### Task 1: Fonts, tokens, base styles, focus rings

**Files:** Modify `src/app/layout.tsx` and `src/app/globals.css`. Create `src/lib/zine/tilt.ts`. Test `tests/zine/tilt.test.ts`.

**Interfaces:** `export function seededTilt(seed: string, max: number): number`, a deterministic value in [-max, max] with 1 decimal place, from an FNV-1a hash.

- [ ] **Step 1: Write failing tests.** `seededTilt` is deterministic, stays within bounds for 1,000 seeds, and different seeds usually differ (fewer than 5% collisions over 1,000 seeds).
- [ ] **Step 2: Implement `seededTilt`.**
- [ ] **Step 3: Set up fonts and base styles.**
  - Load the 5 families with next/font (`display: "swap"`, `subsets: ["latin"]`) as CSS variables `--font-display`, `--font-ui`, `--font-body`, `--font-marker`, `--font-mono`, and wire them into `@theme` (`font-display`, `font-ui`, `font-body`, `font-marker`, `font-mono`).
  - Base styles: `body` uses font-body 17px/1.5 in ink on paper; a global `:focus-visible` ring; and utilities `.display` (design Part 3 treatment: sky fill, 3px ink stroke, `paint-order: stroke fill`, 4px hard ink shadow, uppercase), `.display .alt` (butter), `.display .hot` (marker), `.label` (UI 800, 14px, 0.06em, uppercase), `.grain` (an inline SVG noise background at 15% via a data URI).
  - Drop the Geist fonts.
- [ ] **Step 4: Run** `pnpm test && pnpm build`. Commit `feat: zine fonts, tokens and focus styles`.

### Task 2: Design kit (presentational components)

**Files:** Create `src/components/zine/*.tsx`: Display, Button, Sticker, Band, Stamp, Sparkle, Tape, MarkerCircle, GraphPatch, EvidenceCard, StatBlock, RansomStrip, VhsLoader, plus `illustrations.tsx` (VhsTape, CrtTv, CrumpledPaper, EvidenceBag). Test `tests/zine/kit.test.tsx` (react-dom/server render checks). Vitest must include `tests/**/*.test.tsx`.

**Interfaces** (props only; bodies are free within the Global Constraints):
```ts
Display({ as?: "h1"|"h2"|"p"; size: "xl"|"l"; children }) // lines may contain <span className="alt|hot">
Button({ variant: "primary"|"secondary"|"danger"; ...buttonProps }) / LinkButton({ variant, href, ...})  // min-h 56px, press translate(3px,3px)
Sticker({ children; fill?: "sky"|"butter"|"tangerine"|"leaf"; seed: string })   // aria-hidden, die-cut white border, tilt seededTilt(seed, 12), spring pop
Band({ tone: "paper"|"butter"|"sky"|"tangerine"; edge?: 0|1|2|3; children })     // torn top edge via one of 4 SVG clip paths
Stamp({ text: string; center: string })                                          // rotating circular SVG text, aria-hidden, stops when reduced motion
Sparkle({ size; color; seed }) · Tape({ seed }) · GraphPatch({ className })       // decoration, aria-hidden
MarkerCircle({ children })   // wraps inline text; draws an SVG ellipse with stroke-dashoffset animation; text stays readable
EvidenceCard({ label: string; children; seed: string; fill?: "paper"|"butter" }) // mono label "EXHIBIT C · …", tilt ≤ 1.5°
StatBlock({ value: string; label: string; aside?: string })                     // display number + label + marker aside
RansomStrip({ children; index: number })     // roast line strip, alternating ±1°, torn left/right edges
VhsLoader({ status: string; detail?: string }) // spinning reels + mono status; role="status"
```

- [ ] **Step 1: Write failing tests:**
  - Every decoration component renders `aria-hidden="true"`.
  - `Sticker` with the same seed renders the same transform.
  - `Button` renders a `<button>` with the class that sets `min-height`.
  - `VhsLoader` has `role="status"` and the status text.
  - `RansomStrip` alternates rotation sign by index.
- [ ] **Step 2: Implement** (motion via `motion/react`; `pnpm add motion`).
- [ ] **Step 3: Run** `pnpm test`. Commit `feat: zine design kit`.

### Task 3: Landing, path picker and nav (design 5.1, 5.2, nav)

**Files:** `src/app/page.tsx` and `src/components/SiteNav.tsx`. Modify `src/app/layout.tsx` and `src/components/SiteFooter.tsx`.

- [ ] **Step 1: Build the landing page per 5.1.**
  - Paper band with nav: `📼 caught watching` plus `✦ how it works ✦ privacy ✦ roast me`, with the current page circled in marker.
  - Display headline: YOUR / YOUTUBE / HISTORY IS / EVIDENCE. (alt and hot lines).
  - A butter band with a CRT-TV collage, stickers "3AM???" and "BRO.", and the rotating stamp "OFFICIALLY ROASTED · NO REFUNDS ·".
  - The line `we read what you watched. then we roast you for it.`
  - A primary `ROAST ME` → `/roast`. The quick-path button shows only when `NEXT_PUBLIC_QUICK_PATH_ENABLED === "1"` (Phase 3).
  - The privacy line.
  - A tangerine band "how it works" with 3 sticker cards, plus a sample roast card with blurred lines and the sticker "THIS COULD BE YOU".
  - On desktop the headline is centred and the collage overlaps it.
- [ ] **Step 2: Verify.** Run `pnpm build && pnpm e2e`. Commit `feat: zine landing page`.

### Task 4: Upload page, Takeout guide, VHS loader, errors (design 5.3, 5.4, 5.11)

**Files:** `src/app/roast/page.tsx` and `src/components/upload/Uploader.tsx`.

- [ ] **Step 1: Restyle the upload page.**
  - The drop zone is the "evidence bag" (dashed ink outline, EvidenceBag illustration, `DROP THE EVIDENCE HERE`; it wiggles and turns butter on drag-over). The `<label>` gets the visible focus ring.
  - While reading or roasting, it is replaced by `VhsLoader` with the real counts and the rotating status lines.
  - Errors appear as an EvidenceCard with a marker border and ink text, and a "try another file" button that resets.
  - The guide is 6 numbered zine steps, each a tilted card (≤2°) with a mono step label.
  - Add a `takeout.google.com` LinkButton.
- [ ] **Step 2: Verify.** Run `pnpm build && pnpm e2e`. Commit `feat: zine upload flow and VHS loader`.

### Task 5: Roast reveal (design 5.5) and owner controls (5.8)

**Files:** `src/components/roast/RoastView.tsx`, `OwnerControls.tsx` and `BurnedView.tsx`, `src/app/r/[id]/page.tsx`, `src/app/r/[id]/not-found.tsx`. Test `tests/zine/reveal.test.tsx`.

**Interfaces:** `RoastView({ roast, generator, isOwner, caseId })`. `isOwner` decides whether the capacity notice shows (owner only); everyone else sees only the `TEMPLATE ROAST` stamp.

- [ ] **Step 1: Write failing tests** (render to static markup):
  - Owner + template → contains `templateNotice()`.
  - Non-owner + template → contains `template roast` but not `come back later`.
  - Each roast line's evidence substring is inside a MarkerCircle element (`data-evidence`).
- [ ] **Step 2: Implement the reveal.**
  - `CASE #<ID>` in mono, with the stamp overlapping the headline.
  - `THE VERDICT:` label, then the headline as Display L with alternating fills.
  - Lines on RansomStrips, staggered 600 ms by `whileInView`, each with its evidence wrapped in MarkerCircle. A sticker from the roast sticker set appears on every 3rd line (seeded).
  - `did this hit? 👍 👎` (buttons get `aria-label`s "yes, it hit" / "no, it missed").
- [ ] **Step 3: Build the owner controls** as a paper tab: `SHARE / MAKE PRIVATE · COPY LINK · SEND · DOWNLOAD STORY · DELETE`. Delete opens a real `<dialog>` (`showModal()`, so focus is trapped and Escape closes it) with `burn the evidence?`, `[BURN IT]` (marker fill, **ink** text for contrast) and `[keep]`. Keep the secret link section.
- [ ] **Step 4: Restyle the views.**
  - Private banner: mono `🔒 only you can see this. share when ready.`
  - Public: a sticker strip `👀 YOU'RE READING SOMEONE'S FILE` and the sticky butter CTA `ROAST ME NEXT →` (keep `RoastMeNext`'s tracking).
  - Burned and not-found pages: CrumpledPaper illustration plus the existing copy and a ROAST ME button.
- [ ] **Step 5: Run** `pnpm test && pnpm e2e`. Commit `feat: zine roast reveal and owner controls`.

### Task 6: Report spreads (design 5.6)

**Files:** `src/components/roast/ReportView.tsx` (rewritten as spreads in `src/components/report/*.tsx`), `src/lib/zine/clock.ts` and `src/lib/zine/thumbs.ts`. Test `tests/zine/clock.test.ts` and `tests/zine/thumbs.test.ts`.

**Interfaces:**
```ts
// clock.ts: 24 radial bars for the hand-drawn clock face
export function clockBars(hours: number[], radius: { inner: number; outer: number }): { hour: number; path: string; late: boolean }[];
// late = hour 0–4; bar length ∝ count / max; path is an SVG polygon/arc path string; empty data → 24 zero-length bars
// thumbs.ts
export function thumbUrl(videoId: string | null): string | null;          // https://i.ytimg.com/vi/<id>/mqdefault.jpg, null for null/invalid ids (/^[A-Za-z0-9_-]{6,20}$/)
export function watchUrl(videoId: string | null): string | null;          // https://www.youtube.com/watch?v=<id>
```

- [ ] **Step 1: Write failing tests:**
  - 24 bars always.
  - `late` is true exactly for hours 0–4.
  - The bar for the max hour reaches the outer radius; a zero hour has inner = outer length.
  - No NaN with all-zero data.
  - `thumbUrl("dQw4w9WgXcQ")` returns the exact URL. `thumbUrl("x")` and `thumbUrl("<script>")` return null.
- [ ] **Step 2: Implement the spreads.** Alternating bands paper → butter → sky → tangerine, in this order, each rendered only when it has data:
  1. The Numbers (StatBlocks: videos, est. hours **only if** a future field exists, so skip for now; channels; late nights, with the aside "that's N nights after 2am").
  2. Top 5 Channels (EvidenceCards, with a marker crown scribble on #1).
  3. Most Rewatched (halftone thumbnails via CSS `grayscale(1) contrast(1.4)` plus a dot overlay, taped, linking to YouTube, with the count circled).
  4. The Clock (SVG radial chart with tangerine bars and the 12–5am bars in marker with hatching, plus the big "% after midnight").
  5. Your Eras (torn strips with AI era names).
  6. Longest Binge (a film strip of sample titles, "N videos. on a <weekday>.").
  7. What You Searched (ransom-note queries, mixed fonts).
  8. Contradictions (split layout; only when a caption exists).
  9. Your Personality (a giant sticker badge plus the description).
  10. Outro (stamp, share CTA for the owner or "roast a friend → send them this link").
- [ ] **Step 3: Run** `pnpm test && pnpm build`. Commit `feat: zine report spreads`.

### Task 7: Share images: OG redesign and story image (design Part 6, PRD F18)

**Files:** Modify `src/app/r/[id]/opengraph-image.tsx`. Create `src/app/r/[id]/story/route.tsx` (GET → PNG 1080×1920, public roasts only, otherwise 404 for non-owners, and the owner may download a private one using the cookie) and `src/lib/zine/story.ts`. Test `tests/zine/story.test.ts`.

**Interfaces:**
```ts
export function storyContent(roast: RoastOutput, summary: Summary): { headline: string; lines: string[]; personality: string; stat: string; headlineSize: number };
// lines = the 3 shortest roast lines ≤ 140 chars (ties: original order); headlineSize 96 → 56 by length; stat = "<top channel> · <count> videos" or "<videos> videos"
```

- [ ] **Step 1: Write failing tests** for `storyContent`:
  - It picks the 3 shortest lines.
  - It never returns a line over 140 characters.
  - Headline size shrinks monotonically with length.
  - It handles no top channel.
- [ ] **Step 2: Implement.**
  - **Story:** paper background, the headline in display style at the top, 3 ransom strips, the personality sticker, the stat, and `ytroast.vercel.app` on a tape strip at the bottom. Keep 250 px clear at top and bottom. Use `cache-control: no-store` and the same visibility rule as the page (owner via cookie OR public). Fonts are Bowlby One plus Barlow, read from `src/assets/fonts` (download the OFL Barlow 600 TTF).
  - **OG:** add the VHS mascot and 2 stickers, and keep the generic image for non-public roasts.
  - The `DOWNLOAD STORY` owner control links to `/r/<id>/story` with `download`.
- [ ] **Step 3: Run** `pnpm test && pnpm build`, and fetch both images in dev to view them. Commit `feat: story image and zine link preview`.

### Task 8: Motion and reduced motion

**Files:** the kit components, `RoastView` and the spreads. Modify `e2e/takeout-flow.spec.ts` (a reduced-motion test).

- [ ] **Step 1: Write the failing e2e** `reduced motion shows everything at once`: a context with `reducedMotion: "reduce"`, upload, then assert every `[data-roast-line]` is visible within 1 s of the URL change, and that the stamp has no running animation (`getAnimations().length === 0`).
- [ ] **Step 2: Implement.** Wire Part 7 motion through `motion/react` (`useReducedMotion` → instant). CSS animations (stamp rotation, VHS reels, drop-zone wiggle) go behind `@media (prefers-reduced-motion: no-preference)`.
- [ ] **Step 3: Run** `pnpm e2e`. Commit `feat: zine motion with reduced-motion support`.

### Task 9: Visual self-review and accessibility pass

**Files:** Create `scripts/screens.mts` (Playwright: seeds a roast via the dev API with `ROAST_GENERATOR=template`, then screenshots landing, /roast, owner reveal + report, public view, burned and not-found at 390×844 and 1280×800 into `.superpowers/screens/`). Add a keyboard check in `e2e/a11y.spec.ts`.

- [ ] **Step 1: Run the screenshots and view every image.** Fix layout breaks, overflow, unreadable tilts and contrast problems.
- [ ] **Step 2: Write `e2e/a11y.spec.ts`:**
  - Tab from the top of /roast reaches the drop-zone label, with a visible focus ring (computed `outline-style` is not `none`).
  - On the owner page, the delete dialog opens with Enter, focus moves inside, and Escape closes it.
  - The 👍/👎 buttons have accessible names.
- [ ] **Step 3: Run** `pnpm test && pnpm e2e && pnpm e2e:prod`. Commit `test: accessibility checks and visual review fixes`.

### Task 10: Review, merge, deploy, verify

- [ ] **Step 1: Final review.** Fresh reviewer, plus the fix pass.
- [ ] **Step 2: Ship.** Merge to main, push, and wait for READY.
- [ ] **Step 3: Production check.** Screenshot landing and a public roast at 390 px on production, fetch the story image for a public test roast, then delete the test rows.
