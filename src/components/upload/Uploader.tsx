"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { processInWorker } from "@/lib/takeout/client";
import { errorMessage } from "@/lib/takeout/messages";
import { uploadErrorMessage } from "@/lib/upload-messages";

type State =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "roasting"; videos: number; channels: number }
  | { kind: "error"; message: string };

const STATUS_LINES = (videos: number) => [
  `reading ${videos.toLocaleString("en-US")} videos…`,
  "found the 3am stuff…",
  "consulting your therapist…",
  "writing the roast…",
];

export function Uploader() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const [tick, setTick] = useState(0);
  const busy = state.kind === "reading" || state.kind === "roasting";

  useEffect(() => {
    if (state.kind !== "roasting") return;
    const timer = setInterval(() => setTick((t) => t + 1), 1500);
    return () => clearInterval(timer);
  }, [state.kind]);

  async function handle(file: File | undefined) {
    // One roast at a time: drops while busy are ignored, so a double drop can't create two roasts.
    if (!file || busy) return;
    setState({ kind: "reading" });

    const result = await processInWorker(file).catch(() => null);
    if (!result) return setState({ kind: "error", message: errorMessage("unknown", []) });
    if (!result.ok) return setState({ kind: "error", message: errorMessage(result.code, result.found) });

    setTick(0);
    setState({ kind: "roasting", videos: result.counts.videos, channels: result.counts.channels });
    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(result.summary),
      });
      if (res.status !== 201) return setState({ kind: "error", message: uploadErrorMessage(res.status) });
      const { id } = (await res.json()) as { id: string };
      router.push(`/r/${id}`);
    } catch {
      setState({ kind: "error", message: uploadErrorMessage(0) });
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void handle(e.dataTransfer.files[0]);
  }

  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 border-4 border-dashed border-ink p-6 text-center ${dragging ? "bg-butter" : "bg-white"}`}
      >
        <span className="text-2xl font-black uppercase">drop the evidence here</span>
        <span className="text-sm">your takeout .zip, or watch-history.json / .html</span>
        <input
          ref={input}
          type="file"
          accept=".zip,.json,.html"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            void handle(e.target.files?.[0]);
            // Reset so picking the same file again after an error still fires a change event.
            e.target.value = "";
          }}
        />
      </label>

      <div role="status" aria-live="polite" className="min-h-12 font-mono text-sm">
        {state.kind === "reading" && <p>reading your file on your device…</p>}
        {state.kind === "roasting" && (
          <>
            <p>
              {state.videos.toLocaleString("en-US")} videos · {state.channels.toLocaleString("en-US")} channels
            </p>
            <p>{STATUS_LINES(state.videos)[Math.min(tick, 3)]}</p>
          </>
        )}
        {state.kind === "error" && <p className="font-sans text-base font-semibold text-marker">{state.message}</p>}
      </div>
    </div>
  );
}
