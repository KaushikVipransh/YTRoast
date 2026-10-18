import type { ErrorEvent } from "@sentry/nextjs";

const withoutFragment = (url: string) => url.replace(/#.*$/, "");
// Breadcrumb URLs lose their query too: page tokens, playlist ids, and any token a revoke call might carry.
const withoutQuery = (url: string) => url.replace(/[?#].*$/, "");

/**
 * Error reports must never carry watch data or an owner key:
 * - request bodies, cookies and query strings are dropped;
 * - URL fragments (the secret claim link is /claim#key=…) are cut from the request and breadcrumbs;
 * - database error messages lose their "params:" part (Drizzle puts the inserted summary there);
 * - free-form extras are dropped.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
    if (event.request.url) event.request.url = withoutFragment(event.request.url);
    if (event.request.headers) {
      delete event.request.headers.cookie;
      delete event.request.headers.Cookie;
    }
  }
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = ex.value.replace(/\n\s*params:[\s\S]*$/, "");
  }
  for (const crumb of event.breadcrumbs ?? []) {
    if (!crumb.data) continue;
    for (const key of ["from", "to", "url"]) {
      if (typeof crumb.data[key] === "string") crumb.data[key] = withoutQuery(crumb.data[key]);
    }
  }
  delete event.extra;
  if (event.contexts) delete event.contexts.cause;
  return event;
}
