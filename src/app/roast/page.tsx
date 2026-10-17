import type { Metadata } from "next";
import { Uploader } from "@/components/upload/Uploader";
import { PRIVACY_LINE } from "@/lib/copy";

export const metadata: Metadata = { title: "Roast me · Caught Watching" };

export default function RoastPage() {
  return (
    <main className="mx-auto w-full max-w-xl space-y-10 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-4xl font-black uppercase">full roast</h1>
        <p>your actual watch history. no survivors.</p>
      </header>

      <Uploader />
      <p className="font-mono text-sm">🔒 {PRIVACY_LINE}</p>

      <section className="space-y-3">
        <h2 className="text-xl font-black uppercase">get your history from google</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            open{" "}
            <a className="underline" href="https://takeout.google.com" target="_blank" rel="noreferrer">
              google takeout
            </a>{" "}
            and click <b>deselect all</b>.
          </li>
          <li>
            tick <b>youtube and youtube music</b>.
          </li>
          <li>
            click <b>all youtube data included</b> and keep only <b>history</b>.
          </li>
          <li>
            in <b>multiple formats</b>, set history to <b>json</b> (html works too, json is faster).
          </li>
          <li>export once, as a .zip. google emails you when it&apos;s ready. go touch grass, we&apos;ll be here.</li>
          <li>come back and drop the zip above.</li>
        </ol>
      </section>
    </main>
  );
}
