"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * Respects prefers-reduced-motion for every Motion animation (design Part 7) without changing the
 * server-rendered markup, so components never branch on the preference and hydration always matches.
 */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
