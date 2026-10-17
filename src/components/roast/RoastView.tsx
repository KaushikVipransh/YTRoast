import type { Generator } from "@/lib/roast/generate";
import type { RoastOutput } from "@/lib/roast/schema";

/** Wraps the first case-insensitive occurrence of the evidence in <mark> (Phase 4 turns it into a marker circle). */
function Evidence({ text, evidence }: { text: string; evidence: string }) {
  const at = evidence ? text.toLowerCase().indexOf(evidence.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-butter px-0.5">{text.slice(at, at + evidence.length)}</mark>
      {text.slice(at + evidence.length)}
    </>
  );
}

export function RoastView({ roast, generator }: { roast: RoastOutput; generator: Generator }) {
  return (
    <section aria-labelledby="verdict">
      <p className="text-sm font-bold uppercase tracking-wide">the verdict</p>
      {generator === "template" && (
        <p className="mt-2 inline-block border-2 border-ink px-2 text-xs font-bold uppercase">template roast</p>
      )}
      <h1 id="verdict" className="mt-2 text-3xl font-black uppercase leading-tight">
        {roast.headline}
      </h1>
      <ol className="mt-6 space-y-3">
        {roast.lines.map((line, i) => (
          <li key={i} className="border-2 border-ink bg-white p-3 text-lg font-semibold">
            <Evidence text={line.text} evidence={line.evidence} />
          </li>
        ))}
      </ol>
      <div className="mt-8 border-2 border-ink bg-butter p-4">
        <p className="text-2xl font-black uppercase">{roast.personality.label}</p>
        <p className="mt-2">{roast.personality.description}</p>
      </div>
    </section>
  );
}
