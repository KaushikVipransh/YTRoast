import type { ReactNode } from "react";

const TONES = { paper: "bg-paper", butter: "bg-butter", sky: "bg-sky", tangerine: "bg-tangerine" } as const;
const FILL = { paper: "var(--paper)", butter: "var(--butter)", sky: "var(--sky)", tangerine: "var(--tangerine)" } as const;

// Four hand-torn top edges, so no two neighbouring bands match (design Part 3).
const EDGES = [
  "M0 14 L40 6 L72 15 L118 4 L160 13 L205 3 L250 12 L290 5 L330 14 L372 4 L400 10 V20 H0 Z",
  "M0 8 L30 15 L80 5 L120 14 L170 6 L210 15 L260 4 L300 12 L350 5 L400 13 V20 H0 Z",
  "M0 12 L55 4 L95 13 L140 7 L190 15 L235 5 L280 14 L325 6 L365 15 L400 7 V20 H0 Z",
  "M0 5 L45 13 L90 4 L135 12 L180 3 L228 14 L270 6 L318 13 L360 4 L400 12 V20 H0 Z",
];

/** A full-width colour band with a torn paper top edge. */
export function Band({
  tone,
  edge = 0,
  children,
  className = "",
  id,
}: {
  tone: keyof typeof TONES;
  edge?: 0 | 1 | 2 | 3;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`relative ${TONES[tone]} ${tone === "sky" ? "on-sky" : tone === "butter" ? "on-butter" : ""} ${className}`}>
      <svg
        aria-hidden="true"
        viewBox="0 0 400 20"
        preserveAspectRatio="none"
        className="absolute -top-[18px] left-0 h-5 w-full"
      >
        <path d={EDGES[edge]} fill={FILL[tone]} stroke="var(--ink)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      {children}
    </section>
  );
}
