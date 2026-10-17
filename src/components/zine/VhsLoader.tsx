import { VhsTape } from "./illustrations";

/** Full loader: a VHS tape with spinning reels and a mono status line (design Part 4 progress/loading). */
export function VhsLoader({ status, detail }: { status: string; detail?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 py-6 text-center">
      <VhsTape label="REWINDING" reelClass="spin-reel" className="w-56 max-w-full" />
      {detail && <p className="font-mono text-sm">{detail}</p>}
      <p className="font-mono text-base font-bold">{status}</p>
    </div>
  );
}
