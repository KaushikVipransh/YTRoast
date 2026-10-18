import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QuickRoaster } from "@/components/quick/QuickRoaster";
import { SiteNav } from "@/components/SiteNav";
import { Track } from "@/components/Track";
import { Display } from "@/components/zine/bits";
import { googleClientId, quickPathEnabled } from "@/lib/quick/config";
import { quickErrorMessage } from "@/lib/quick/messages";

export const metadata: Metadata = { title: "Quick roast · Caught Watching" };

/** PRD F1: roast from likes, subscriptions and playlists via Google sign-in (read-only). Dark unless flagged on. */
export default function QuickRoastPage() {
  if (!quickPathEnabled()) notFound();
  const clientId = googleClientId();

  return (
    <main className="flex-1 overflow-x-clip">
      <SiteNav current="roast" />
      <div className="mx-auto max-w-2xl space-y-8 px-4 pb-16 pt-4">
        <header className="space-y-3">
          <Display size="l">
            quick <span className="alt">roast</span>
          </Display>
          <p className="text-xl font-semibold">30 seconds · from your likes &amp; subs · mild-ish</p>
        </header>

        <Track event="guide_view" />
        {clientId ? (
          <QuickRoaster clientId={clientId} />
        ) : (
          <p className="rounded-md border-[3px] border-ink bg-paper p-4 font-semibold shadow-hard">{quickErrorMessage("no-client-id")}</p>
        )}

        <p className="font-mono text-sm">
          🔒 read-only access to your youtube likes, subscriptions and playlists. it&apos;s read in your browser; a summary
          with names and titles is sent to write your roast.{" "}
          <Link href="/privacy" className="underline">
            details
          </Link>
        </p>
        <p>
          want the real damage?{" "}
          <Link href="/roast" className="font-semibold underline">
            do the full roast with your watch history →
          </Link>
        </p>
      </div>
    </main>
  );
}
