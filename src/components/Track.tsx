"use client";

import { useEffect } from "react";
import { track, type EventName, type EventProps } from "@/lib/analytics";

/** Sends one page-level event when it mounts. Renders nothing. */
export function Track({ event, path }: { event: EventName; path?: EventProps["path"] }) {
  useEffect(() => track(event, path ? { path } : undefined), [event, path]);
  return null;
}
