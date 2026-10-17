import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BurnedView } from "@/components/roast/BurnedView";
import { OwnerControls } from "@/components/roast/OwnerControls";
import { ReportView } from "@/components/roast/ReportView";
import { RoastView } from "@/components/roast/RoastView";
import { getDb } from "@/lib/db/client";
import { ogHeadline } from "@/lib/roasts/og";
import { ownerCookieName } from "@/lib/roasts/ownership";
import { getRoastView } from "@/lib/roasts/service";
import { siteUrl } from "@/lib/site";

type Props = { params: Promise<{ id: string }> };

// Metadata never reads the owner cookie: previews only ever describe public roasts.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Roast state (shared, private, deleted) changes at any time: always read it at request time.
  await connection();
  const { id } = await params;
  const headline = ogHeadline(await getRoastView(await getDb(), id, null));
  return {
    metadataBase: new URL(siteUrl()),
    title: headline ? `${headline} · Caught Watching` : "Caught Watching",
    description: headline ? "someone got caught watching. read the whole file." : undefined,
    robots: { index: false, follow: false },
  };
}

export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<p className="p-8 font-mono">opening the file…</p>}>
      <RoastPage params={params} />
    </Suspense>
  );
}

async function RoastPage({ params }: Props) {
  await connection();
  const { id } = await params;
  const token = (await cookies()).get(ownerCookieName(id))?.value ?? null;
  const view = await getRoastView(await getDb(), id, token);

  if (view.kind === "missing") notFound();
  if (view.kind === "deleted") return <BurnedView />;

  const shareUrl = `${siteUrl()}/r/${id}`;
  return (
    <main className="mx-auto w-full max-w-xl space-y-10 px-4 pb-32 pt-8">
      {view.isOwner ? (
        view.visibility === "private" && (
          <p className="font-mono text-sm">🔒 only you can see this. share when ready.</p>
        )
      ) : (
        <p className="inline-block border-2 border-ink bg-butter px-2 font-bold uppercase">
          👀 you&apos;re reading someone&apos;s file
        </p>
      )}

      <RoastView roast={view.roast} generator={view.generator} />

      {view.isOwner && (
        <OwnerControls
          id={id}
          visibility={view.visibility}
          feedback={view.feedback}
          shareUrl={shareUrl}
          secretLink={`${shareUrl}/claim?key=${token}`}
        />
      )}

      <ReportView summary={view.summary} roast={view.roast} />

      {!view.isOwner && (
        <div className="fixed inset-x-0 bottom-0 border-t-2 border-ink bg-butter p-4 text-center">
          <Link href="/roast" className="text-lg font-black uppercase">
            roast me next →
          </Link>
        </div>
      )}
    </main>
  );
}
