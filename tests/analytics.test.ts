import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { bucket, track } from "@/lib/analytics";

test.each([
  [0, "<50"],
  [49, "<50"],
  [50, "50-1k"],
  [999, "50-1k"],
  [1000, "1k-10k"],
  [9999, "1k-10k"],
  [10_000, "10k+"],
] as const)("bucket(%i) = %s", (n, expected) => {
  expect(bucket(n)).toBe(expected);
});

test("track is a silent no-op without a PostHog key", () => {
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  expect(() => track("landing_view")).not.toThrow();
});

// Analytics must never carry watch data: every track() call may only use the allowed property names.
const ALLOWED = new Set(["generator", "status", "code", "videos", "value", "ovenFull", "path"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

test("no track() call sends a property outside the allowed list", () => {
  const offenders: string[] = [];
  for (const file of sourceFiles(join(__dirname, "..", "src"))) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\btrack\(\s*"[a-z_]+"\s*,\s*\{([^}]*)\}/g)) {
      for (const key of match[1].matchAll(/([A-Za-z_]+)\s*(?::|,|$)/g)) {
        if (!ALLOWED.has(key[1])) offenders.push(`${file}: ${key[1]}`);
      }
    }
  }
  expect(offenders).toEqual([]);
});

test("sentry scrubber drops bodies, cookies and query strings", async () => {
  const { scrubEvent } = await import("@/lib/sentry");
  const event = scrubEvent({
    type: undefined,
    request: { url: "https://x/api/roast", data: '{"summary":1}', cookies: { cw_o_a: "t" }, query_string: "key=t", headers: { cookie: "cw_o_a=t", "user-agent": "ua" } },
  });
  expect(event.request).toEqual({ url: "https://x/api/roast", headers: { "user-agent": "ua" } });
});

// Review fixes 1–3: nothing user-identifying leaves through Sentry or PostHog.
test("sentry scrubber cuts query params out of database error messages", async () => {
  const { scrubEvent } = await import("@/lib/sentry");
  const event = scrubEvent({
    type: undefined,
    exception: { values: [{ type: "DrizzleQueryError", value: 'Failed query: insert into "roasts"\nparams: {"topChannels":[{"name":"secret channel"}]}' }] },
    extra: { params: "secret" },
  });
  expect(event.exception?.values?.[0].value).toBe('Failed query: insert into "roasts"');
  expect(event.extra).toBeUndefined();
});

test("sentry scrubber removes URL fragments (secret claim keys) from the request and breadcrumbs", async () => {
  const { scrubEvent } = await import("@/lib/sentry");
  const event = scrubEvent({
    type: undefined,
    request: { url: "https://x/r/abc/claim#key=SECRET" },
    breadcrumbs: [{ category: "navigation", data: { from: "/r/abc/claim#key=SECRET", to: "/r/abc" } }, { category: "fetch", data: { url: "https://x/api/roast/abc/claim#key=SECRET" } }],
  });
  expect(JSON.stringify(event)).not.toContain("SECRET");
  expect(event.request?.url).toBe("https://x/r/abc/claim");
});

test("posthog events are reduced to route patterns, no referrer", async () => {
  const { sanitizeProperties } = await import("@/lib/analytics");
  expect(
    sanitizeProperties({
      $current_url: "https://ytroast.vercel.app/r/AbC123xyz_-9/claim#key=SECRET",
      $pathname: "/r/AbC123xyz_-9",
      $referrer: "https://chat.example/thread/42",
      $referring_domain: "chat.example",
      $initial_referrer: "x",
      $initial_referring_domain: "x",
      ovenFull: false,
    }),
  ).toEqual({ $current_url: "https://ytroast.vercel.app/r/[id]/claim", $pathname: "/r/[id]", ovenFull: false });
});

test("sentry scrubber drops query strings from breadcrumb urls (tokens, page tokens, playlist ids)", async () => {
  const { scrubEvent } = await import("@/lib/sentry");
  const event = scrubEvent({ type: undefined, breadcrumbs: [{ category: "fetch", data: { url: "https://oauth2.googleapis.com/revoke?token=SECRET" } }] });
  expect(JSON.stringify(event)).not.toContain("SECRET");
});
