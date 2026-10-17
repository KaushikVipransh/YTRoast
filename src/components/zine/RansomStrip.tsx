import type { ReactNode } from "react";

/** A roast line on its own torn strip of paper; tilt alternates ±1° (design Part 4 "roast line"). */
export function RansomStrip({ children, index, className = "" }: { children: ReactNode; index: number; className?: string }) {
  const tilt = index % 2 === 0 ? 1 : -1;
  const fill = index % 3 === 1 ? "bg-butter" : "bg-paper";
  return (
    <div
      className={`relative border-y-[3px] border-ink px-5 py-3 text-[clamp(18px,4.8vw,26px)] font-semibold leading-snug shadow-[4px_4px_0_var(--ink)] [clip-path:polygon(0_6%,2%_0,98%_4%,100%_0,99%_50%,100%_100%,97%_96%,3%_100%,0_94%,1%_50%)] ${fill} ${className}`}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      {children}
    </div>
  );
}
