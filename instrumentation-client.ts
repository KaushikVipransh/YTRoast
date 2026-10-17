import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry";

// Browser error tracking (e.g. parser crashes on unusual Takeout files); off without a DSN.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) Sentry.init({ dsn, tracesSampleRate: 0, beforeSend: scrubEvent });
