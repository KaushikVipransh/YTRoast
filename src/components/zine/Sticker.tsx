"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { seededTilt } from "@/lib/zine/tilt";

const FILLS = { sky: "bg-sky", butter: "bg-butter", tangerine: "bg-tangerine", leaf: "bg-leaf" } as const;

/** Die-cut reaction sticker (design Part 4). Pure decoration: hidden from screen readers. */
export function Sticker({
  children,
  seed,
  fill = "butter",
  className = "",
}: {
  children: ReactNode;
  seed: string;
  fill?: keyof typeof FILLS;
  className?: string;
}) {
  const tilt = seededTilt(seed, 12);
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden="true"
      className={`label inline-block rounded-md border-[3px] border-ink px-3 py-1 text-base text-ink shadow-[0_0_0_4px_white,0_7px_0_0_rgba(31,42,68,0.25)] ${FILLS[fill]} ${className}`}
      initial={reduce ? false : { scale: 0, rotate: 0 }}
      animate={{ scale: 1, rotate: tilt }}
      style={{ rotate: tilt }}
      transition={{ type: "spring", stiffness: 420, damping: 14 }}
    >
      {children}
    </motion.span>
  );
}
