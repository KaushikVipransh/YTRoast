"use client";

import { useEffect } from "react";
import { track, type EventName } from "@/lib/analytics";

/** Sends one page-level event when it mounts. Renders nothing. */
export function Track({ event }: { event: EventName }) {
  useEffect(() => track(event), [event]);
  return null;
}
