import { useId } from "react";

/** Rotating circular text badge, e.g. "OFFICIALLY ROASTED · NO REFUNDS ·" (design Part 4). Stops for reduced motion. */
export function Stamp({ text, center, className = "" }: { text: string; center: string; className?: string }) {
  const id = useId();
  return (
    <div aria-hidden="true" className={`relative grid h-28 w-28 place-items-center ${className}`}>
      <svg viewBox="0 0 100 100" className="spin-slow absolute inset-0 h-full w-full" data-stamp>
        <defs>
          <path id={id} d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0" />
        </defs>
        <circle cx="50" cy="50" r="48" fill="var(--paper)" stroke="var(--ink)" strokeWidth="3" />
        <circle cx="50" cy="50" r="27" fill="var(--butter)" stroke="var(--ink)" strokeWidth="3" />
        <text fill="var(--marker)" style={{ font: "800 10.5px var(--nf-ui)", letterSpacing: "0.12em" }}>
          <textPath href={`#${id}`}>{text}</textPath>
        </text>
      </svg>
      <span className="relative text-2xl">{center}</span>
    </div>
  );
}
