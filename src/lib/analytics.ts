// Product analytics for the PRD §6 funnel. Events NEVER carry watch data: no titles, channels, searches,
// roast text or ids. Only the property names in EventProps are allowed (a test scans every call site).
import type { PostHog } from "posthog-js";
import type { Generator } from "@/lib/roast/generate";

export type EventName =
  | "landing_view"
  | "guide_view"
  | "upload_started"
  | "upload_failed"
  | "roast_created"
  | "roast_shared"
  | "roast_unshared"
  | "roast_deleted"
  | "shared_view"
  | "roast_me_next_click"
  | "feedback";

export type EventProps = {
  generator?: Generator;
  status?: number;
  code?: string;
  videos?: "<50" | "50-1k" | "1k-10k" | "10k+";
  value?: 1 | -1;
  ovenFull?: boolean;
};

export function bucket(videos: number): NonNullable<EventProps["videos"]> {
  if (videos < 50) return "<50";
  if (videos < 1000) return "50-1k";
  if (videos < 10_000) return "1k-10k";
  return "10k+";
}

let client: Promise<PostHog | null> | undefined;

function load(key: string): Promise<PostHog | null> {
  client ??= import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        person_profiles: "identified_only",
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
      });
      return posthog;
    })
    .catch(() => null);
  return client;
}

/** Fire-and-forget; a silent no-op on the server or without NEXT_PUBLIC_POSTHOG_KEY. */
export function track(event: EventName, props?: EventProps): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || typeof window === "undefined") return;
  void load(key).then((posthog) => posthog?.capture(event, props));
}
