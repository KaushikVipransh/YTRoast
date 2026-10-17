import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry";

// Server-side error tracking; off unless NEXT_PUBLIC_SENTRY_DSN is set (free Sentry developer plan).
export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn, tracesSampleRate: 0, beforeSend: scrubEvent });
}

export const onRequestError = Sentry.captureRequestError;
