import type { ReactNode } from "react";
import { seededTilt } from "@/lib/zine/tilt";

/** Chunky outlined headline (design Part 3). Children may use <span className="alt|hot"> per line. */
export function Display({ as: Tag = "h1", size, children, className = "", id }: { as?: "h1" | "h2" | "p"; size: "xl" | "l"; children: ReactNode; className?: string; id?: string }) {
  return (
    <Tag id={id} className={`display ${size === "xl" ? "display-xl" : "display-l"} ${className}`}>
      {children}
    </Tag>
  );
}

/** Red marker circle drawn around evidence inside a line; the text stays plain and readable. */
export function MarkerCircle({ children, evidence }: { children: ReactNode; evidence?: string }) {
  return (
    <span data-evidence={evidence ?? ""} className="relative inline px-0.5">
      {children}
      <svg
        aria-hidden="true"
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="pointer-events-none absolute -left-2 -top-1.5 h-[calc(100%+12px)] w-[calc(100%+16px)] overflow-visible"
      >
        <path
          className="marker-draw"
          pathLength={1}
          d="M7 22 C4 8 90 2 96 18 C100 33 22 40 6 26 C3 22 9 12 20 9"
          fill="none"
          stroke="var(--marker)"
          strokeWidth="3"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}

/** Evidence card: paper/butter fill, ink outline, hard shadow, slight tilt, mono "EXHIBIT" label. */
export function EvidenceCard({ label, children, seed, fill = "paper", className = "" }: { label: string; children: ReactNode; seed: string; fill?: "paper" | "butter"; className?: string }) {
  return (
    <div
      className={`relative rounded-md border-[3px] border-ink p-4 shadow-hard ${fill === "butter" ? "bg-butter" : "bg-paper"} ${className}`}
      style={{ transform: `rotate(${seededTilt(seed, 1.5)}deg)` }}
    >
      <p className="font-mono text-[13px] uppercase tracking-wide text-ink-soft">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/** A giant number with a label and a handwritten aside (design Part 4 stat block). */
export function StatBlock({ value, label, aside }: { value: string; label: string; aside?: string }) {
  return (
    <div className="text-center">
      <p className="display display-l">{value}</p>
      <p className="label mt-2">{label}</p>
      {aside && <p className="mt-1 font-marker text-base text-ink">{aside}</p>}
    </div>
  );
}
