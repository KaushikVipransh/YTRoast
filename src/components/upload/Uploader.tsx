"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { bucket, track } from "@/lib/analytics";
import { processInWorker } from "@/lib/takeout/client";
import { errorMessage } from "@/lib/takeout/messages";
import { uploadErrorMessage } from "@/lib/upload-messages";
import { Button } from "@/components/zine/Button";
import { EvidenceBag } from "@/components/zine/illustrations";
import { VhsLoader } from "@/components/zine/VhsLoader";

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
    track("upload_started", { path: "takeout" });

    const result = await processInWorker(file).catch(() => null);
    if (!result) {
      track("upload_failed", { code: "unknown", path: "takeout" });
      return setState({ kind: "error", message: errorMessage("unknown", []) });
    }
    if (!result.ok) {
      track("upload_failed", { code: result.code, path: "takeout" });
      return setState({ kind: "error", message: errorMessage(result.code, result.found) });
    }

    setTick(0);
    setState({ kind: "roasting", videos: result.counts.videos, channels: result.counts.channels });
    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(result.summary),
      });
      if (res.status !== 201) {
        track("upload_failed", { status: res.status, path: "takeout" });
        return setState({ kind: "error", message: uploadErrorMessage(res.status) });
      }
      const { id, ovenFull } = (await res.json()) as { id: string; ovenFull: boolean };
      track("roast_created", { ovenFull, videos: bucket(result.counts.videos), path: "takeout" });
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

  if (state.kind === "reading" || state.kind === "roasting") {
    return (
      <div className="rounded-xl border-[3px] border-ink bg-sky shadow-hard">
        {state.kind === "reading" ? (
          <VhsLoader status="reading your file on your device…" />
        ) : (
          <VhsLoader
            detail={`${state.videos.toLocaleString("en-US")} videos · ${state.channels.toLocaleString("en-US")} channels`}
            status={STATUS_LINES(state.videos)[Math.min(tick, 3)]}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-4 border-dashed border-ink p-6 text-center transition-colors has-[input:focus-visible]:outline has-[input:focus-visible]:outline-[3px] has-[input:focus-visible]:outline-offset-4 has-[input:focus-visible]:outline-ink ${dragging ? "wiggle bg-butter" : "bg-paper"}`}
      >
        <EvidenceBag className="w-28" />
        <span className="display display-l text-[clamp(28px,7vw,44px)]">drop the evidence here</span>
        <span className="font-mono text-sm">your takeout .zip, or watch-history.json / .html · tap to choose</span>
        <input
          ref={input}
          type="file"
          accept=".zip,.json,.html"
          className="sr-only"
          onChange={(e) => {
            void handle(e.target.files?.[0]);
            // Reset so picking the same file again after an error still fires a change event.
            e.target.value = "";
          }}
        />
      </label>

      {state.kind === "error" && (
        <div role="alert" className="space-y-3 rounded-md border-[3px] border-marker bg-paper p-4 shadow-hard">
          <p className="label">
            <span aria-hidden="true" className="text-marker">
              ✖{" "}
            </span>
            objection
          </p>
          <p className="font-semibold">{state.message}</p>
          <Button variant="secondary" onClick={() => input.current?.click()}>
            try another file
          </Button>
        </div>
      )}
    </div>
  );
}
