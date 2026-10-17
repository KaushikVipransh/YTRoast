import { Suspense } from "react";
import { ClaimClient } from "./ClaimClient";

export default function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <Suspense fallback={<p className="font-mono">getting your file back…</p>}>
        <Claim params={params} />
      </Suspense>
    </main>
  );
}

async function Claim({ params }: { params: Promise<{ id: string }> }) {
  return <ClaimClient id={(await params).id} />;
}
