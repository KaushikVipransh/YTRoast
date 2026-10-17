import type { ErrorEvent } from "@sentry/nextjs";

/** Error reports must never carry a summary, roast, or owner cookie: drop request bodies, cookies and query strings. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
    if (event.request.headers) {
      delete event.request.headers.cookie;
      delete event.request.headers.Cookie;
    }
  }
  return event;
}
