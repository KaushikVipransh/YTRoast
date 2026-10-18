"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/zine/Button";
import { VhsLoader } from "@/components/zine/VhsLoader";
import { track } from "@/lib/analytics";
import { buildQuickSummary } from "@/lib/quick/build";
import { prepareTokenClient, revokeToken, type TokenClient } from "@/lib/quick/gis";
import { quickErrorMessage, quickServerMessage, type QuickErrorCode } from "@/lib/quick/messages";
import { YouTubeError, fetchYouTubeData } from "@/lib/quick/youtube";

type State =
  | { kind: "idle" }
  | { kind: "signing-in" }
  | { kind: "fetching" }
  | { kind: "roasting"; likes: number; subs: number }
  | { kind: "error"; message: string };

const STATUS = ["counting your likes…", "judging your subscriptions…", "reading your playlist names out loud…", "writing the roast…"];
const TOKEN_ERRORS = ["denied", "popup_closed", "popup_blocked", "network"];

/** The official Google "G", unmodified, as Google's sign-in branding guidelines require. */
function GoogleG() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function QuickRoaster({ clientId }: { clientId: string }) {
  const router = useRouter();
  const client = useRef<TokenClient | null>(null);
  const retry = useRef<HTMLButtonElement>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [tick, setTick] = useState(0);

  // Prepare Google's token client up front so the popup can open synchronously inside the tap.
  useEffect(() => {
    let alive = true;
    prepareTokenClient(clientId)
      .then((c) => {
        if (!alive) return;
        client.current = c;
        setReady(true);
      })
      .catch(() => alive && setState({ kind: "error", message: quickErrorMessage("network") }));
    return () => {
      alive = false;
    };
  }, [clientId]);

  useEffect(() => {
    if (state.kind !== "roasting") return;
    const timer = setInterval(() => setTick((t) => t + 1), 1500);
    return () => clearInterval(timer);
  }, [state.kind]);

  // Errors replace the button that had focus: move focus to the way forward.
  useEffect(() => {
    if (state.kind === "error") retry.current?.focus();
  }, [state]);

  function start() {
    const c = client.current;
    if (!c || (state.kind !== "idle" && state.kind !== "error")) return;
    const token = c.request(); // synchronous: still inside the user's tap
    void run(token);
  }

  async function run(tokenPromise: Promise<string>) {
    setState({ kind: "signing-in" });
    track("upload_started", { path: "quick" });
    try {
      const token = await tokenPromise;
      setState({ kind: "fetching" });
      let data;
      try {
        data = await fetchYouTubeData(token);
      } finally {
        // Revoke as soon as the likes are read, before the (slow) roast request.
        revokeToken(token);
      }
      const summary = buildQuickSummary(data);
      setTick(0);
      setState({ kind: "roasting", likes: summary.totals.likes, subs: summary.totals.subscriptions });

      let res: Response;
      try {
        res = await fetch("/api/roast", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(summary) });
      } catch {
        return setState({ kind: "error", message: quickServerMessage(0) });
      }
      if (res.status !== 201) {
        track("upload_failed", { status: res.status, path: "quick" });
        return setState({ kind: "error", message: quickServerMessage(res.status) });
      }
      const { id, ovenFull } = (await res.json()) as { id: string; ovenFull: boolean };
      track("roast_created", { ovenFull, path: "quick" });
      router.push(`/r/${id}`);
    } catch (err) {
      const code: QuickErrorCode =
        err instanceof YouTubeError
          ? err.code
          : err instanceof Error && TOKEN_ERRORS.includes(err.message)
            ? (err.message as QuickErrorCode)
            : "network";
      track("upload_failed", { code, path: "quick" });
      setState({ kind: "error", message: quickErrorMessage(code) });
    }
  }

  if (state.kind === "signing-in" || state.kind === "fetching" || state.kind === "roasting") {
    return (
      <div className="rounded-xl border-[3px] border-ink bg-sky shadow-hard">
        <VhsLoader
          status={state.kind === "roasting" ? STATUS[Math.min(tick, 3)] : state.kind === "fetching" ? "reading your likes on your device…" : "waiting for google…"}
          detail={state.kind === "roasting" ? `${state.likes.toLocaleString("en-US")} likes · ${state.subs.toLocaleString("en-US")} subscriptions` : undefined}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Google's button styling stays as-is; our outline frame wraps it (design Part 4). */}
      <div className="inline-block rounded-[14px] border-[3px] border-ink bg-paper p-2 shadow-hard">
        <button
          type="button"
          onClick={start}
          disabled={!ready}
          className="flex min-h-12 items-center gap-3 rounded-md border border-[#747775] bg-white px-4 font-[Roboto,Arial,sans-serif] text-[15px] font-medium text-[#1F1F1F] disabled:opacity-60"
        >
          <GoogleG />
          Sign in with Google
        </button>
      </div>

      {state.kind === "error" && (
        <div role="alert" className="space-y-3 rounded-md border-[3px] border-marker bg-paper p-4 shadow-hard">
          <p className="label">
            <span aria-hidden="true" className="text-marker">
              ✖{" "}
            </span>
            objection
          </p>
          <p className="font-semibold">{state.message}</p>
          <Button ref={retry} variant="secondary" onClick={start} disabled={!ready}>
            try again
          </Button>
        </div>
      )}
    </div>
  );
}
