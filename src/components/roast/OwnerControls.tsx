"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, buttonClass } from "@/components/zine/Button";
import { track } from "@/lib/analytics";

type Props = {
  id: string;
  visibility: "private" | "public";
  feedback: -1 | 1 | null;
  shareUrl: string;
  secretLink: string;
};

export function OwnerControls({ id, visibility, feedback, shareUrl, secretLink }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const keep = useRef<HTMLButtonElement>(null);

  // Focus the safe choice explicitly: autoFocus does nothing on a client-rendered closed dialog, and the
  // browser would otherwise focus the first button, "burn it".
  function openBurnDialog() {
    dialog.current?.showModal();
    keep.current?.focus();
  }
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
    const burned = await call(`/api/roast/${id}`, { method: "DELETE" });
    // Close either way: on failure the error note outside the modal must be visible and announced.
    dialog.current?.close();
    if (burned) {
      track("roast_deleted");
      router.refresh();
    }
  }

  return (
    <aside aria-label="owner controls" className="relative space-y-5 rounded-md border-[3px] border-ink bg-paper p-5 shadow-hard">
      <p className="label absolute -top-4 left-4 rounded border-[3px] border-ink bg-butter px-2">your file</p>
      <div className="flex flex-wrap gap-3 pt-2">
        <Button variant="primary" onClick={toggleShare} disabled={busy}>
          {visibility === "private" ? "share" : "make private"}
        </Button>
        {visibility === "public" && (
          <>
            <Button variant="secondary" onClick={() => copy(shareUrl, "link copied.")} disabled={busy}>
              copy link
            </Button>
            <Button variant="secondary" onClick={share} disabled={busy}>
              send
            </Button>
          </>
        )}
        <a className={buttonClass("secondary")} href={`/r/${id}/story`} download={`caught-watching-${id}.png`}>
          download story
        </a>
        <Button variant="danger" onClick={openBurnDialog} disabled={busy}>
          delete
        </Button>
      </div>

      <dialog
        ref={dialog}
        aria-labelledby={`burn-${id}`}
        className="m-auto max-w-sm rounded-md border-[3px] border-marker bg-paper p-6 text-ink shadow-hard backdrop:bg-ink/60"
      >
        <p id={`burn-${id}`} className="display display-l text-[32px]">
          burn the <span className="hot">evidence?</span>
        </p>
        <p className="mt-2">this wipes the roast for good. the link will say it was burned.</p>
        <div className="mt-5 flex gap-3">
          <Button variant="danger" onClick={burn} disabled={busy}>
            burn it
          </Button>
          <Button ref={keep} variant="secondary" onClick={() => dialog.current?.close()} disabled={busy}>
            keep
          </Button>
        </div>
      </dialog>

      <div className="flex flex-wrap items-center gap-3">
        <span className="label">did this hit?</span>
        <Button variant="secondary" aria-label="yes, it hit" aria-pressed={vote === 1} onClick={() => sendFeedback(1)} disabled={busy} className="min-w-14 px-3">
          👍
        </Button>
        <Button variant="secondary" aria-label="no, it missed" aria-pressed={vote === -1} onClick={() => sendFeedback(-1)} disabled={busy} className="min-w-14 px-3">
          👎
        </Button>
      </div>

      <details className="rounded border-[3px] border-dashed border-ink p-3">
        <summary className="label flex min-h-12 cursor-pointer items-center">your secret link</summary>
        <p className="mt-2 text-sm">save this. it&apos;s the only way back in if you clear cookies.</p>
        <p className="mt-1 break-all font-mono text-xs" data-testid="secret-link">
          {secretLink}
        </p>
        <Button variant="secondary" className="mt-3" onClick={() => copy(secretLink, "secret link copied.")}>
          copy secret link
        </Button>
      </details>

      {note && (
        <p role="status" className="font-mono text-sm">
          {note}
        </p>
      )}
    </aside>
  );
}
