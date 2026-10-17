import { MarkerCircle } from "@/components/zine/bits";
import { RansomStrip } from "@/components/zine/RansomStrip";
import { Stamp } from "@/components/zine/Stamp";
import { Sticker } from "@/components/zine/Sticker";
import { templateNotice } from "@/lib/copy";
import type { Generator } from "@/lib/roast/generate";
import type { RoastOutput } from "@/lib/roast/schema";

const STICKERS = ["BRO.", "3AM???", "CAUGHT", "SEEN IT", "SKIP AD", "TOUCH GRASS", "NO WAY", "💀", "EXHIBIT A"];
const STICKER_FILLS = ["sky", "tangerine", "leaf", "butter"] as const;

/** Circles the first case-insensitive occurrence of the evidence in red marker; the text stays real text. */
function Evidence({ text, evidence }: { text: string; evidence: string }) {
  const at = evidence ? text.toLowerCase().indexOf(evidence.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <MarkerCircle evidence={evidence}>{text.slice(at, at + evidence.length)}</MarkerCircle>
      {text.slice(at + evidence.length)}
    </>
  );
}

/** The headline moment (design 5.5): case number, the verdict, then the lines dropping in one by one. */
export function RoastView({ roast, generator, isOwner, caseId }: { roast: RoastOutput; generator: Generator; isOwner: boolean; caseId: string }) {
  const words = roast.headline.split(" ");
  const half = Math.ceil(words.length / 2);
  return (
    <section aria-labelledby="verdict" className="space-y-8">
      <div className="relative">
        <p className="font-mono text-sm">CASE #{caseId.toUpperCase()}</p>
        <p className="label mt-4">the verdict:</p>
        <h1 id="verdict" className="display display-l mt-2 pr-16 sm:pr-28">
          {words.slice(0, half).join(" ")} <span className="alt">{words.slice(half).join(" ")}</span>
        </h1>
        <Stamp text="OFFICIALLY ROASTED · NO REFUNDS · " center="🔥" size={96} className="absolute -right-2 -top-6" />
      </div>

      {generator === "template" && (
        <div className="space-y-2">
          {isOwner && (
            <>
              <Sticker seed="capacity" fill="butter">
                WE&apos;RE AT CAPACITY
              </Sticker>
              <p className="text-sm">{templateNotice()}</p>
            </>
          )}
          <p className="label inline-block rounded border-[3px] border-ink px-2">template roast</p>
        </div>
      )}

      <ol className="space-y-6">
        {roast.lines.map((line, i) => (
          <li key={i} data-roast-line className="roast-line relative" style={{ animationDelay: `${i * 600}ms` }}>
            <RansomStrip index={i}>
              <Evidence text={line.text} evidence={line.evidence} />
            </RansomStrip>
            {i % 3 === 2 && (
              <span className="absolute -right-2 -top-4">
                <Sticker seed={`${caseId}-${i}`} fill={STICKER_FILLS[i % 4]}>
                  {STICKERS[(caseId.charCodeAt(0) + i) % STICKERS.length]}
                </Sticker>
              </span>
            )}
          </li>
        ))}
      </ol>

      <div className="rounded-md border-[3px] border-ink bg-butter p-5 shadow-hard">
        <p className="label">your personality</p>
        <p className="display display-l mt-2 text-[clamp(28px,7vw,48px)]">{roast.personality.label}</p>
        <p className="mt-3">{roast.personality.description}</p>
      </div>
    </section>
  );
}
