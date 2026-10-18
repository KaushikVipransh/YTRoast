import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { Track } from "@/components/Track";
import { Uploader } from "@/components/upload/Uploader";
import { Band } from "@/components/zine/Band";
import { Display, EvidenceCard } from "@/components/zine/bits";
import { buttonClass } from "@/components/zine/Button";
import { Sticker } from "@/components/zine/Sticker";
import { PRIVACY_LINE } from "@/lib/copy";
import { quickPathEnabled } from "@/lib/quick/config";

export const metadata: Metadata = { title: "Roast me · Caught Watching" };

const STEPS = [
  <>
    open google takeout and click <b>deselect all</b>.
  </>,
  <>
    tick <b>youtube and youtube music</b>.
  </>,
  <>
    click <b>all youtube data included</b> and keep only <b>history</b>.
  </>,
  <>
    in <b>multiple formats</b>, set history to <b>json</b> (html works too, json is faster).
  </>,
  <>export once, as a .zip. google emails you when it&apos;s ready. go touch grass, we&apos;ll be here.</>,
  <>come back and drop the zip above.</>,
];

export default function RoastPage() {
  return (
    <main className="flex-1 overflow-x-clip">
      <SiteNav current="roast" />
      <div className="mx-auto max-w-2xl space-y-8 px-4 pb-16 pt-4">
        <header className="relative space-y-3">
          <Display size="l">
            full <span className="hot">roast</span>
          </Display>
          <p className="text-xl font-semibold">your actual watch history. no survivors.</p>
          <div className="absolute -top-2 right-0">
            <Sticker seed="no-survivors" fill="tangerine">
              💀
            </Sticker>
          </div>
        </header>

        {quickPathEnabled() && (
          <nav aria-label="choose your roast" className="grid gap-4 sm:grid-cols-2">
            <Link href="/roast/quick" className="block rounded-md border-[3px] border-dashed border-ink bg-butter p-4 shadow-hard">
              <p className="label text-xl">quick roast ⚡</p>
              <p className="text-sm">30 seconds · from your likes &amp; subs · mild-ish</p>
            </Link>
            <div aria-current="page" className="rounded-md border-[3px] border-marker bg-paper p-4 shadow-hard">
              <p className="label text-xl">full roast 📼 (you&apos;re here)</p>
              <p className="text-sm">5–10 min setup · your actual watch history · no survivors</p>
            </div>
          </nav>
        )}

        <Track event="guide_view" path="takeout" />
        <Uploader />
        <p className="font-mono text-sm">
          🔒 {PRIVACY_LINE}{" "}
          <Link href="/privacy" className="underline">
            details
          </Link>
        </p>
      </div>

      <Band tone="sky" edge={3}>
        <section className="mx-auto max-w-2xl space-y-6 px-4 py-14" aria-labelledby="guide">
          <h2 id="guide" className="display display-l">
            get your history from google
          </h2>
          <ol className="grid gap-5 sm:grid-cols-2">
            {STEPS.map((step, i) => (
              <li key={i}>
                <EvidenceCard label={`step ${String(i + 1).padStart(2, "0")}`} seed={`guide-${i}`}>
                  <p>{step}</p>
                </EvidenceCard>
              </li>
            ))}
          </ol>
          <a className={buttonClass("primary")} href="https://takeout.google.com" target="_blank" rel="noreferrer">
            open google takeout ↗
          </a>
        </section>
      </Band>
    </main>
  );
}
