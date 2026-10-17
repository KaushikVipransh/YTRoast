import Link from "next/link";
import { Track } from "@/components/Track";
import { PRIVACY_LINE } from "@/lib/copy";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 px-4 py-16">
      <h1 className="text-5xl font-black uppercase leading-none">
        your youtube history is <span className="text-marker">evidence.</span>
      </h1>
      <p className="text-xl">we read what you watched. then we roast you for it.</p>
      <Link href="/roast" className="self-start border-2 border-ink bg-butter px-8 py-4 text-xl font-black uppercase">
        roast me
      </Link>
      <p className="font-mono text-sm">🔒 {PRIVACY_LINE}</p>
      <Track event="landing_view" />
    </main>
  );
}
