import { seededTilt } from "@/lib/zine/tilt";

const COLORS = { sky: "var(--sky)", butter: "var(--butter)", tangerine: "var(--tangerine)", leaf: "var(--leaf)", marker: "var(--marker)" };

/** Four-point sparkle star (design Part 3 kit). */
export function Sparkle({ size, color, seed, className = "" }: { size: number; color: keyof typeof COLORS; seed: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={{ transform: `rotate(${seededTilt(seed, 20)}deg)` }}
    >
      <path d="M12 1 C13 9 15 11 23 12 C15 13 13 15 12 23 C11 15 9 13 1 12 C9 11 11 9 12 1Z" fill={COLORS[color]} stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** A strip of semi-transparent tape holding a cutout down. */
export function Tape({ seed, className = "" }: { seed: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute block h-6 w-16 bg-butter/70 shadow-[0_1px_0_rgba(31,42,68,0.15)] ${className}`}
      style={{ transform: `rotate(${seededTilt(seed, 8)}deg)` }}
    />
  );
}

/** A faint graph-paper corner patch. */
export function GraphPatch({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`graph-paper pointer-events-none absolute ${className}`} />;
}
