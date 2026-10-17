import { SiteNav } from "@/components/SiteNav";
import { Track } from "@/components/Track";
import { Band } from "@/components/zine/Band";
import { Display, EvidenceCard } from "@/components/zine/bits";
import { LinkButton } from "@/components/zine/Button";
import { GraphPatch, Sparkle } from "@/components/zine/decor";
import { CrtTv, VhsTape } from "@/components/zine/illustrations";
import { Stamp } from "@/components/zine/Stamp";
import { Sticker } from "@/components/zine/Sticker";
import { PRIVACY_LINE } from "@/lib/copy";

const QUICK_PATH = process.env.NEXT_PUBLIC_QUICK_PATH_ENABLED === "1";

const STEPS = [
  { n: "01", title: "drop your history", body: "export it from google takeout. it's read on your device." },
  { n: "02", title: "we count everything", body: "top channels, 3am habits, rewatches, the searches." },
  { n: "03", title: "you get destroyed", body: "a roast and a full report. share it if you dare." },
];

export default function Home() {
  return (
    <main className="flex-1 overflow-x-clip">
      {/* Paper band: nav + the headline */}
      <section className="relative">
        <GraphPatch className="right-0 top-0 h-40 w-40 opacity-70" />
        <SiteNav />
        <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-6 md:text-center">
          <Sparkle size={34} color="sky" seed="l1" className="absolute left-4 top-0 md:left-24" />
          <Sparkle size={22} color="tangerine" seed="l2" className="absolute right-10 top-24 md:right-40" />
          <Display size="xl">
            your
            <br />
            <span className="alt">youtube</span>
            <br />
            history is
            <br />
            <span className="hot">evidence.</span>
          </Display>
          <div className="absolute right-3 top-28 hidden sm:block md:right-24">
            <Sticker seed="lol" fill="leaf">
              LOL 😂
            </Sticker>
          </div>
        </div>
      </section>

      {/* Butter band: the collage and the pitch */}
      <Band tone="butter" edge={1}>
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-14 md:grid-cols-2">
          <div className="relative mx-auto w-full max-w-sm">
            <CrtTv className="w-full" />
            <div className="absolute -left-2 top-6">
              <Sticker seed="3am" fill="sky">
                3AM???
              </Sticker>
            </div>
            <div className="absolute -right-2 bottom-10">
              <Sticker seed="bro" fill="tangerine">
                BRO.
              </Sticker>
            </div>
            <Stamp text="OFFICIALLY ROASTED · NO REFUNDS · " center="🔥" className="absolute -bottom-10 -right-6" />
          </div>

          <div className="space-y-6">
            <p className="text-[clamp(22px,5vw,30px)] font-semibold leading-tight">
              we read what you watched. then we roast you for it.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <LinkButton variant="primary" href="/roast">
                roast me <span aria-hidden="true">📼</span>
              </LinkButton>
              {QUICK_PATH && (
                <LinkButton variant="secondary" href="/roast/quick">
                  quick roast <span aria-hidden="true">⚡</span>
                </LinkButton>
              )}
            </div>
            <p className="font-mono text-sm">🔒 {PRIVACY_LINE}</p>
          </div>
        </div>
      </Band>

      {/* Tangerine band: how it works + a sample */}
      <Band tone="tangerine" edge={2} id="how-it-works">
        <div className="mx-auto max-w-5xl space-y-10 px-4 py-14">
          <h2 className="display display-l">how it works</h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.n}>
                <EvidenceCard label={`step ${step.n}`} seed={step.n}>
                  <p className="label text-xl">{step.title}</p>
                  <p className="mt-1">{step.body}</p>
                </EvidenceCard>
              </li>
            ))}
          </ol>

          <div className="relative mx-auto max-w-xl">
            <EvidenceCard label="sample roast · case #A7F3K2" seed="sample" fill="butter">
              <div aria-hidden="true" className="select-none space-y-3 blur-[5px]">
                <p className="text-xl font-bold">a man with 4 self-help playlists and zero self</p>
                <p>you watched how to wake up at 5am at 4:12am. twice.</p>
                <p>31 rewatches of the same minecraft ending. it&apos;s not getting better.</p>
              </div>
              <p className="sr-only">a blurred sample roast</p>
            </EvidenceCard>
            <div className="absolute -right-2 -top-5">
              <Sticker seed="could-be-you" fill="sky">
                THIS COULD BE YOU
              </Sticker>
            </div>
            <VhsTape label="YOUR NAME" className="absolute -bottom-10 -left-6 hidden w-36 -rotate-6 sm:block" />
          </div>
        </div>
      </Band>
      <Track event="landing_view" />
    </main>
  );
}
