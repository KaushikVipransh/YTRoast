import { useId } from "react";

/**
 * Rotating circular text badge, e.g. "OFFICIALLY ROASTED · NO REFUNDS ·" (design Part 4). Stops for reduced motion.
 * Position it with `className` (e.g. "absolute -right-3 -top-4"); size it with `size` (px).
 */
export function Stamp({ text, center, size = 112, className = "" }: { text: string; center: string; size?: number; className?: string }) {
  const id = useId();
  return (
    <div aria-hidden="true" className={className} style={{ width: size, height: size }}>
      <div className="relative grid h-full w-full place-items-center">
        <svg viewBox="0 0 100 100" className="spin-slow absolute inset-0 h-full w-full" data-stamp>
          <defs>
            <path id={id} d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0" />
          </defs>
          <circle cx="50" cy="50" r="48" fill="var(--paper)" stroke="var(--ink)" strokeWidth="3" />
          <circle cx="50" cy="50" r="27" fill="var(--butter)" stroke="var(--ink)" strokeWidth="3" />
          <text fill="var(--marker)" style={{ font: "800 10.5px var(--nf-ui)", letterSpacing: "0.12em" }}>
            {/* textLength fits the phrase exactly once around the ring (circumference ≈ 232) */}
            <textPath href={`#${id}`} textLength="228" lengthAdjust="spacingAndGlyphs">
              {text}
            </textPath>
          </text>
        </svg>
        <span className="relative" style={{ fontSize: size * 0.22 }}>
          {center}
        </span>
      </div>
    </div>
  );
}
