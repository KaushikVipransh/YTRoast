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
const ALLOWED = new Set(["generator", "status", "code", "videos", "value", "ovenFull"]);

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
