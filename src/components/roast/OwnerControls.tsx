"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { track } from "@/lib/analytics";

type Props = {
  id: string;
  visibility: "private" | "public";
  feedback: -1 | 1 | null;
  shareUrl: string;
  secretLink: string;
};

const button = "border-2 border-ink bg-paper px-4 py-2 font-bold uppercase disabled:opacity-50";

export function OwnerControls({ id, visibility, feedback, shareUrl, secretLink }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [vote, setVote] = useState(feedback);

  async function call(path: string, init: RequestInit): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(path, { ...init, headers: { "content-type": "application/json" } });
      if (!res.ok) setNote("that didn't work. try again.");
      return res.ok;
    } finally {
      setBusy(false);
    }
  }

  async function toggleShare() {
    const next = visibility === "private" ? "public" : "private";
    if (await call(`/api/roast/${id}`, { method: "PATCH", body: JSON.stringify({ visibility: next }) })) {
      track(next === "public" ? "roast_shared" : "roast_unshared");
      setNote(next === "public" ? "it's public. send it." : "private again. only you can see it.");
      router.refresh();
    }
  }

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNote(done);
    } catch {
      setNote(text);
    }
  }

  async function share() {
    if (navigator.share) await navigator.share({ url: shareUrl, title: "i got caught watching" }).catch(() => {});
    else await copy(shareUrl, "link copied.");
  }

  async function sendFeedback(value: -1 | 1) {
    if (await call(`/api/roast/${id}/feedback`, { method: "POST", body: JSON.stringify({ value }) })) {
      setVote(value);
      track("feedback", { value });
    }
  }

  async function burn() {
    if (await call(`/api/roast/${id}`, { method: "DELETE" })) {
      track("roast_deleted");
      router.refresh();
    }
  }

  return (
    <aside aria-label="owner controls" className="space-y-4 border-2 border-ink bg-white p-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${button} bg-butter`} onClick={toggleShare} disabled={busy}>
          {visibility === "private" ? "share" : "make private"}
        </button>
        {visibility === "public" && (
          <>
            <button type="button" className={button} onClick={() => copy(shareUrl, "link copied.")} disabled={busy}>
              copy link
            </button>
            <button type="button" className={button} onClick={share} disabled={busy}>
              send
            </button>
          </>
        )}
        <button type="button" className={`${button} text-marker`} onClick={() => setConfirming(true)} disabled={busy}>
          delete
        </button>
      </div>

      {confirming && (
        <div role="alertdialog" aria-label="burn the evidence?" className="space-y-2 border-2 border-marker p-3">
          <p className="font-bold">burn the evidence?</p>
          <div className="flex gap-2">
            <button type="button" className={`${button} bg-marker text-white`} onClick={burn} disabled={busy}>
              burn it
            </button>
            <button type="button" className={button} onClick={() => setConfirming(false)} disabled={busy}>
              keep
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span>did this hit?</span>
        <button type="button" aria-pressed={vote === 1} className={button} onClick={() => sendFeedback(1)} disabled={busy}>
          👍
        </button>
        <button type="button" aria-pressed={vote === -1} className={button} onClick={() => sendFeedback(-1)} disabled={busy}>
          👎
        </button>
      </div>

      <details>
        <summary className="cursor-pointer font-bold">your secret link</summary>
        <p className="mt-2 text-sm">save this. it&apos;s the only way back in if you clear cookies.</p>
        <p className="mt-1 break-all font-mono text-xs" data-testid="secret-link">
          {secretLink}
        </p>
        <button type="button" className={`${button} mt-2`} onClick={() => copy(secretLink, "secret link copied.")}>
          copy secret link
        </button>
      </details>

      {note && (
        <p role="status" className="text-sm">
          {note}
        </p>
      )}
    </aside>
  );
}
